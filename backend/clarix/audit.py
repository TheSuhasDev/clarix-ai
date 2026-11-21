"""Append-only, hash-chained audit ledger.

hash = HMAC-SHA256( key, prev_hash + canonical_record ), with backward compatibility
for legacy SHA-256 records created prior to CHAIN_UPGRADE.
genesis prev_hash = 64 zeros.
`canonical` is a compact, key-sorted JSON of EVERY field, so editing any field breaks the chain.
Append-only is enforced by SQLite triggers; tamper-evidence is anchored by external signed anchor.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import re
import threading
from typing import Callable

from .classification import CLASSES, RISKS
from .db import Database
from .util import utcstamp

log = logging.getLogger("clarix.audit")

GENESIS = "0" * 64
DECISIONS = ("ALLOW", "BLOCK", "REQUIRE_APPROVAL")
_CTRL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")
FIELDS = ("id", "timestamp", "user", "action", "component", "risk", "decision", "classification", "payload")


def canonical_of(rec: dict) -> str:
    return json.dumps({k: rec[k] for k in FIELDS}, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def chain_hash(prev_hash: str, canonical: str, key: bytes | None = None) -> str:
    msg = (prev_hash + canonical).encode("utf-8")
    if key is not None:
        return hmac.new(key, msg, hashlib.sha256).hexdigest()
    return hashlib.sha256(msg).hexdigest()


def _clean(s: str, n: int) -> str:
    return _CTRL.sub("", str(s))[:n]


class AuditLog:
    def __init__(self, db: Database, key: bytes | None = None, anchor_cb: Callable[[int, str], None] | None = None):
        self.db = db
        self._key = key
        self._anchor_cb = anchor_cb
        self._lock = threading.Lock()
        self._upgrade_seq: int | None = self._find_upgrade_seq()

    def _find_upgrade_seq(self) -> int | None:
        try:
            up = self.db.one("SELECT seq FROM audit_events WHERE action='CHAIN_UPGRADE' ORDER BY seq ASC LIMIT 1")
            return up["seq"] if up else None
        except Exception:
            return None

    def init_keyed(self, key: bytes, anchor_callback: Callable[[int, str], None] | None = None) -> dict:
        """Upgrade or bind active HMAC key and external anchor callback."""
        self._key = key
        self._anchor_cb = anchor_callback
        self._upgrade_seq = self._find_upgrade_seq()
        if self._upgrade_seq is not None:
            return {"upgraded": False, "seq": self._upgrade_seq}

        # If database already has rows, verify legacy chain first
        cnt = self.count()
        if cnt > 0:
            v = self.verify()
            if not v["ok"]:
                log.warning("Cannot upgrade audit chain: legacy rows failed verification (%s)", v.get("problems"))
                return {"upgraded": False, "error": "Legacy chain failed verification"}

        # Write CHAIN_UPGRADE event to seal transition to HMAC
        rec = self.append(
            user="system",
            action="CHAIN_UPGRADE",
            component="Integrity Guard",
            risk="LOW",
            decision="ALLOW",
            classification="INTERNAL",
            payload="algorithm:HMAC-SHA256"
        )
        self._upgrade_seq = int(rec["id"].split("-")[1])
        return {"upgraded": True, "seq": self._upgrade_seq}

    def append(self, *, user: str, action: str, component: str, risk: str, decision: str,
               classification: str, payload: str = "") -> dict:
        if risk not in RISKS or decision not in DECISIONS or classification not in CLASSES:
            raise ValueError("invalid risk/decision/classification for audit event")
        with self._lock, self.db.tx() as c:
            last = c.execute("SELECT seq, hash FROM audit_events ORDER BY seq DESC LIMIT 1").fetchone()
            seq = (last["seq"] if last else 0) + 1
            prev = last["hash"] if last else GENESIS
            rec = {"id": f"EVT-{seq:06d}", "timestamp": utcstamp(), "user": _clean(user, 80), "action": _clean(action, 300),
                   "component": _clean(component, 60), "risk": risk, "decision": decision,
                   "classification": classification, "payload": _clean(payload, 2000)}
            canon = canonical_of(rec)

            # Determine whether to use HMAC or legacy SHA-256
            use_hmac = (self._key is not None) and (
                action == "CHAIN_UPGRADE" or
                (self._upgrade_seq is not None and seq >= self._upgrade_seq)
            )
            h = chain_hash(prev, canon, self._key if use_hmac else None)

            c.execute(
                "INSERT INTO audit_events(seq,id,timestamp,user,action,component,risk,decision,classification,payload,canonical,prev_hash,hash)"
                " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (seq, rec["id"], rec["timestamp"], rec["user"], rec["action"], rec["component"], risk, decision,
                 classification, rec["payload"], canon, prev, h))

        # External anchor notification hook
        if self._anchor_cb:
            try:
                self._anchor_cb(seq, h)
            except Exception as e:
                log.warning("Anchor callback failed: %s", e)

        return {**rec, "canonical": canon, "hash": h, "prevHash": prev}

    @staticmethod
    def _row(r) -> dict:
        return {"id": r["id"], "timestamp": r["timestamp"], "user": r["user"], "action": r["action"],
                "component": r["component"], "risk": r["risk"], "decision": r["decision"],
                "classification": r["classification"], "payload": r["payload"], "canonical": r["canonical"],
                "hash": r["hash"], "prevHash": r["prev_hash"]}

    def list(self, limit: int = 1000) -> list[dict]:
        rows = self.db.q("SELECT * FROM (SELECT * FROM audit_events ORDER BY seq DESC LIMIT ?) ORDER BY seq ASC", (limit,))
        return [self._row(r) for r in rows]

    def count(self) -> int:
        return self.db.one("SELECT COUNT(*) n FROM audit_events")["n"]

    def head(self) -> dict:
        r = self.db.one("SELECT seq, id, hash FROM audit_events ORDER BY seq DESC LIMIT 1")
        return {"count": self.count(), "id": r["id"] if r else None, "hash": r["hash"] if r else GENESIS}

    def verify(self) -> dict:
        """Recompute every hash from stored raw FIELDS; supports both legacy SHA-256 and HMAC records."""
        problems: list[dict] = []
        prev, expected_seq, n = GENESIS, 1, 0
        upgrade_seq = self._find_upgrade_seq()

        for r in self.db.q("SELECT * FROM audit_events ORDER BY seq ASC"):
            n += 1
            rec = {k: r[k] for k in FIELDS}
            if r["seq"] != expected_seq or r["id"] != f"EVT-{r['seq']:06d}":
                problems.append({"id": r["id"], "reason": "Sequence gap or id mismatch (event removed or inserted)"})
            if r["prev_hash"] != prev:
                problems.append({"id": r["id"], "reason": "Parent hash does not match previous block"})

            canon = canonical_of(rec)
            # Check hash with HMAC if row is at or after upgrade_seq, otherwise legacy SHA-256
            if upgrade_seq is not None and r["seq"] >= upgrade_seq:
                if not self._key:
                    problems.append({"id": r["id"], "reason": "Missing HMAC key to verify keyed audit blocks"})
                    expected_h = ""
                else:
                    expected_h = chain_hash(r["prev_hash"], canon, self._key)
            else:
                expected_h = chain_hash(r["prev_hash"], canon, None)

            if canon != r["canonical"] or (expected_h and expected_h != r["hash"]):
                problems.append({"id": r["id"], "reason": "Record contents no longer match the stored hash"})
            prev, expected_seq = r["hash"], r["seq"] + 1

        return {"ok": not problems, "count": n, "problems": problems, "head": prev}
