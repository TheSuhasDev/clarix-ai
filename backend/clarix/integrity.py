"""
Tamper Lockdown & Cryptographic Integrity Protection (POL-006).

Enforces:
1. Keyed hash chain: HMAC-SHA256 with key stored outside SQLite (audit.key).
2. External signed anchor: {count, head_hash, timestamp, signature} in audit_anchor.json.
3. Trigger guard: verifies audit_no_update and audit_no_delete exist and match expected SQL.
4. Signed security state: HMAC over canonical JSON of policies, tool permissions, and document classifications.
5. Fast incremental checks (<10ms) just before sensitive actions and every 5s; full verify on startup/recovery.
6. Fail-closed LOCKDOWN persisted in lockdown.json on any detected tamper, returning HTTP 423.
7. Hash-chained incident log (incidents.log) recording tamper evidence.
8. Two-phase recovery: restore snapshot or rebaseline with confirmation phrase and reason.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import shutil
import sqlite3
import stat
import threading
import time
from pathlib import Path
from typing import Any

from .errors import ApiError, SystemLockedError, bad_request, forbidden
from .util import utcstamp

log = logging.getLogger("clarix.integrity")

EXPECTED_UPDATE_TRIGGER = "audit_no_update"
EXPECTED_DELETE_TRIGGER = "audit_no_delete"
REBASELINE_CONFIRMATION = "I CONFIRM REBASELINE OF SECURITY STATE"
CONFIRMATION_PHRASE = REBASELINE_CONFIRMATION


class IntegrityManager:
    def __init__(self, ctx):
        self.ctx = ctx
        self.settings = ctx.settings
        self.demo_mode = bool(getattr(self.settings, "demo_mode", False))
        self.real_data_dir = getattr(self.settings, "real_data_dir", self.settings.data_dir)
        self.demo_data_dir = getattr(self.settings, "demo_data_dir", self.settings.data_dir / "demo")
        self.active_data_dir = self.demo_data_dir if self.demo_mode else self.real_data_dir
        self.active_data_dir.mkdir(parents=True, exist_ok=True)
        self.data_dir = self.active_data_dir

        self.demo_db_path = getattr(self.settings, "demo_db_path", self.demo_data_dir / "clarix_demo.db")
        self.real_db_path = getattr(self.settings, "real_db_path", self.real_data_dir / "clarix.db")
        self.active_db_path = self.demo_db_path if self.demo_mode else self.real_db_path

        self.key_file = self.active_data_dir / ("audit_demo.key" if self.demo_mode else "audit.key")
        self.anchor_file = self.active_data_dir / ("audit_demo_anchor.json" if self.demo_mode else "audit_anchor.json")
        self.state_file = self.active_data_dir / "security_state.json"
        self.lockdown_file = self.active_data_dir / "lockdown.json"
        self.incident_file = self.active_data_dir / "incidents.log"
        self.snapshot_dir = self.active_data_dir / "snapshots"
        self.snapshot_dir.mkdir(parents=True, exist_ok=True)

        self.mode = getattr(self.settings, "integrity_mode", "enforce").lower()
        if self.mode not in ("enforce", "warn", "off"):
            self.mode = "enforce"

        self._lock = threading.RLock()
        self._key = self._load_or_create_key()
        self._bg_thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._last_checked = 0.0
        self._last_full_verify = 0.0
        self._cached_status: dict[str, Any] = {"status": "PENDING", "lockdown": None}

        from .db import Database
        from .audit import AuditLog
        if self.demo_mode:
            self.demo_db = Database(self.demo_db_path)
            self.demo_audit = AuditLog(self.demo_db)
            self.active_db = self.demo_db
            self.active_audit = self.demo_audit
            self.demo_audit._anchor_cb = self.on_audit_append
            self.demo_audit._key = self._key
            self.demo_audit._upgrade_seq = self.demo_audit._find_upgrade_seq()
        else:
            self.active_db = self.ctx.db
            self.active_audit = self.ctx.audit
            if hasattr(self.ctx, "audit") and self.ctx.audit is not None:
                self.ctx.audit._anchor_cb = self.on_audit_append
                self.ctx.audit._key = self._key
                self.ctx.audit._upgrade_seq = self.ctx.audit._find_upgrade_seq()

    @property
    def key(self) -> bytes:
        return self._key

    def _load_or_create_key(self) -> bytes:
        if self.key_file.is_file():
            try:
                raw = self.key_file.read_bytes().strip()
                if len(raw) == 64:  # hex encoded
                    return bytes.fromhex(raw.decode("ascii"))
                elif len(raw) >= 32:
                    return raw[:32]
            except Exception as e:
                log.warning("Could not read existing audit.key (%s); regenerating", e)
        # Generate new 32-byte secret key
        key = os.urandom(32)
        try:
            self.key_file.write_bytes(key.hex().encode("ascii"))
            try:
                os.chmod(self.key_file, stat.S_IRUSR | stat.S_IWUSR)  # 0600
            except Exception:
                pass
        except Exception as e:
            log.error("Failed to write audit.key: %s", e)
        return key

    # ---------------------------------------------------------------------------
    # Signed Security State
    # ---------------------------------------------------------------------------
    def compute_security_state(self) -> tuple[dict, str]:
        """Canonical snapshot of policies, tool permissions, and document classifications."""
        policies = sorted(
            [{"id": r["id"], "enabled": bool(r["enabled"])} for r in self.active_db.q("SELECT id, enabled FROM policies")],
            key=lambda x: x["id"]
        )
        tools = sorted(
            [{"id": r["id"], "level": r["level"]} for r in self.active_db.q("SELECT id, level FROM tools")],
            key=lambda x: x["id"]
        )
        docs = sorted(
            [{"name": r["name"], "classification": r["classification"]} for r in self.active_db.q("SELECT name, classification FROM rag_documents")],
            key=lambda x: x["name"]
        )
        state_obj = {"policies": policies, "tools": tools, "docs": docs}
        canonical_str = json.dumps(state_obj, sort_keys=True, separators=(",", ":"))
        sig = hmac.new(self._key, canonical_str.encode("utf-8"), hashlib.sha256).hexdigest()
        return state_obj, sig

    def sign_security_state(self) -> None:
        """Write current active DB security configuration signed with HMAC key."""
        with self._lock:
            state_obj, sig = self.compute_security_state()
            payload = {
                "timestamp": utcstamp(),
                "signature": sig,
                "state": state_obj
            }
            tmp = self.state_file.with_suffix(".tmp")
            tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
            tmp.replace(self.state_file)

    def check_security_state(self) -> tuple[bool, str]:
        """Verify database policies/tools/docs have not been altered out-of-band."""
        if not self.state_file.is_file():
            self.sign_security_state()
            return True, ""
        try:
            raw = json.loads(self.state_file.read_text(encoding="utf-8"))
            saved_sig = raw.get("signature")
            saved_state = raw.get("state", {})
            _, cur_sig = self.compute_security_state()

            if not hmac.compare_digest(saved_sig or "", cur_sig):
                cur_state, _ = self.compute_security_state()
                diffs = []
                cur_pols = {p["id"]: p["enabled"] for p in cur_state.get("policies", [])}
                for p in saved_state.get("policies", []):
                    pid = p["id"]
                    if pid in cur_pols and cur_pols[pid] != p["enabled"]:
                        diffs.append(f"policy {pid}: expected {int(p['enabled'])}, found {int(cur_pols[pid])}")

                cur_tools = {t["id"]: t["level"] for t in cur_state.get("tools", [])}
                for t in saved_state.get("tools", []):
                    tid = t["id"]
                    if tid in cur_tools and cur_tools[tid] != t["level"]:
                        diffs.append(f"tool {tid}: expected {t['level']}, found {cur_tools[tid]}")

                cur_docs = {d["name"]: d["classification"] for d in cur_state.get("docs", [])}
                for d in saved_state.get("docs", []):
                    dname = d["name"]
                    if dname in cur_docs and cur_docs[dname] != d["classification"]:
                        diffs.append(f"document {dname}: expected {d['classification']}, found {cur_docs[dname]}")

                evidence = "; ".join(diffs) if diffs else "Security state signature mismatch against active SQLite database"
                return False, f"Signed security state tampered: {evidence}"
            return True, ""
        except Exception as e:
            return False, f"Error validating security state: {e}"

    # ---------------------------------------------------------------------------
    # External Anchor
    # ---------------------------------------------------------------------------
    def write_anchor(self, count: int, head_hash: str) -> dict:
        """Write signed external anchor after an audit append."""
        with self._lock:
            ts = utcstamp()
            canonical = f"{count}:{head_hash}:{ts}"
            sig = hmac.new(self._key, canonical.encode("utf-8"), hashlib.sha256).hexdigest()
            payload = {
                "count": count,
                "head_hash": head_hash,
                "timestamp": ts,
                "signature": sig
            }
            tmp = self.anchor_file.with_suffix(".tmp")
            tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
            tmp.replace(self.anchor_file)
            return payload

    def check_anchor(self) -> tuple[bool, str]:
        """Validate database head and count against the signed external anchor."""
        if not self.anchor_file.is_file():
            head = self.active_audit.head()
            self.write_anchor(head["count"], head["hash"])
            return True, ""
        try:
            raw = json.loads(self.anchor_file.read_text(encoding="utf-8"))
            count = raw.get("count", 0)
            head_hash = raw.get("head_hash", "")
            ts = raw.get("timestamp", "")
            sig = raw.get("signature", "")
            canonical = f"{count}:{head_hash}:{ts}"
            expected_sig = hmac.new(self._key, canonical.encode("utf-8"), hashlib.sha256).hexdigest()

            if not hmac.compare_digest(sig, expected_sig):
                return False, "External anchor signature invalid: anchor file was tampered or forged"

            db_head = self.active_audit.head()
            if db_head["count"] < count:
                return False, f"Audit log count: Database truncation detected: DB count {db_head['count']} < anchor count {count}"
            if db_head["count"] > count:
                return False, f"Audit log count: Forged or un-anchored rows detected: DB count {db_head['count']} > anchor count {count}"
            if db_head["hash"] != head_hash:
                return False, f"Anchor head mismatch: expected {head_hash[:16]}..., found {db_head['hash'][:16]}..."
            return True, ""
        except Exception as e:
            return False, f"Error verifying external anchor: {e}"

    # ---------------------------------------------------------------------------
    # Trigger Guard
    # ---------------------------------------------------------------------------
    def check_triggers(self) -> tuple[bool, str]:
        """Ensure audit_no_update and audit_no_delete exist and enforce append-only rule."""
        try:
            rows = self.active_db.q(
                "SELECT name, sql FROM sqlite_master WHERE type='trigger' AND name IN ('audit_no_update', 'audit_no_delete')"
            )
            found = {r["name"]: r["sql"] for r in rows}
            if "audit_no_update" not in found:
                return False, "Missing SQLite trigger 'audit_no_update' (dropped out-of-band)"
            if "audit_no_delete" not in found:
                return False, "Missing SQLite trigger 'audit_no_delete' (dropped out-of-band)"
            for name, sql in found.items():
                if "RAISE" not in (sql or "") or "audit_events is append-only" not in (sql or ""):
                    return False, f"Trigger '{name}' was modified and no longer enforces append-only rule"
            return True, ""
        except Exception as e:
            return False, f"Error inspecting SQLite triggers: {e}"

    # ---------------------------------------------------------------------------
    # Incident Logging & Lockdown Persistence
    # ---------------------------------------------------------------------------
    def record_incident(self, incident_type: str, reason: str, evidence: str) -> dict:
        """Append to hash-chained external incident log file."""
        with self._lock:
            inc_id = f"INC-{int(time.time()):08d}"
            ts = utcstamp()
            prev_hash = "0" * 64
            seq = 1
            if self.incident_file.is_file():
                try:
                    lines = [ln.strip() for ln in self.incident_file.read_text(encoding="utf-8").splitlines() if ln.strip()]
                    if lines:
                        last = json.loads(lines[-1])
                        prev_hash = last.get("hash", prev_hash)
                        seq = last.get("seq", 0) + 1
                except Exception:
                    pass
            canon = json.dumps({"seq": seq, "id": inc_id, "timestamp": ts, "type": incident_type,
                                "reason": reason, "evidence": evidence}, sort_keys=True)
            h = hmac.new(self._key, (prev_hash + canon).encode("utf-8"), hashlib.sha256).hexdigest()
            record = {"seq": seq, "id": inc_id, "timestamp": ts, "type": incident_type,
                      "reason": reason, "evidence": evidence, "prev_hash": prev_hash, "hash": h}
            with self.incident_file.open("a", encoding="utf-8") as f:
                f.write(json.dumps(record) + "\n")
            return record

    def trigger_lockdown(self, reason: str, evidence: str, incident_type: str = "TAMPER_DETECTED") -> None:
        """Place system in fail-closed LOCKDOWN and persist state to disk."""
        if self.mode == "off":
            return
        inc = self.record_incident(incident_type, reason, evidence)
        lockdown_data = {
            "locked": True,
            "timestamp": utcstamp(),
            "reason": reason,
            "evidence": evidence,
            "incident_id": inc["id"],
            "mode": self.mode
        }
        if self.mode == "enforce":
            self.lockdown_file.write_text(json.dumps(lockdown_data, indent=2), encoding="utf-8")
            log.critical("FAIL-CLOSED LOCKDOWN TRIGGERED: %s | Evidence: %s", reason, evidence)
        else:
            log.warning("INTEGRITY WARN (non-enforcing mode): %s | Evidence: %s", reason, evidence)
        self._cached_status = {"status": "LOCKED" if self.mode == "enforce" else "WARN", "lockdown": lockdown_data}

    @property
    def locked(self) -> bool:
        return self.is_locked()

    def is_locked(self) -> bool:
        """Check if system is currently locked."""
        if self.mode == "off":
            return False
        if self.lockdown_file.is_file():
            try:
                data = json.loads(self.lockdown_file.read_text(encoding="utf-8"))
                return bool(data.get("locked"))
            except Exception:
                return True
        return False

    def get_lockdown_info(self) -> dict | None:
        """Get persisted lockdown info if system is locked."""
        if self.lockdown_file.is_file():
            try:
                return json.loads(self.lockdown_file.read_text(encoding="utf-8"))
            except Exception:
                return {"locked": True, "reason": "Corrupted lockdown file present", "evidence": "lockdown.json unreadable"}
        return None

    def lock(self, reason: str, evidence: str = "") -> None:
        """Explicitly trigger lockdown."""
        self.trigger_lockdown(reason, evidence)

    def status(self) -> dict:
        return self.get_status()

    def incidents(self, limit: int = 100) -> list[dict]:
        return self.get_incidents()[:limit]

    def ensure_not_locked(self) -> None:
        """Fast just-in-time check (<10ms) executed before sensitive actions."""
        if self.mode == "off":
            return
        if self.is_locked():
            info = self.get_lockdown_info() or {}
            raise SystemLockedError(info.get("reason", "System in lockdown"), info.get("evidence", ""))
        ok, reason, evidence = self.check_fast()
        if not ok:
            self.trigger_lockdown(reason, evidence)
            if self.mode == "enforce":
                raise SystemLockedError(reason, evidence)

    # ---------------------------------------------------------------------------
    # Checks: Fast (incremental) & Full
    # ---------------------------------------------------------------------------
    def check_fast(self, lock_on_failure: bool = True) -> tuple[bool, str, str]:
        """Sub-10ms incremental integrity verification."""
        # 1. Triggers
        ok, msg = self.check_triggers()
        if not ok:
            reason = f"Database trigger security check failed: {msg}"
            evidence = msg
            if lock_on_failure:
                self.trigger_lockdown(reason, evidence)
            return False, reason, evidence
        # 2. Signed security state
        ok, msg = self.check_security_state()
        if not ok:
            reason = "Security state tampered"
            evidence = msg
            if lock_on_failure:
                self.trigger_lockdown(reason, evidence)
            return False, reason, evidence
        # 3. External anchor
        ok, msg = self.check_anchor()
        if not ok:
            reason = f"Audit log count or anchor mismatch: {msg}"
            evidence = msg
            if lock_on_failure:
                self.trigger_lockdown(reason, evidence)
            return False, reason, evidence
        self._last_checked = time.time()
        return True, "", ""

    def check_full(self, lock_on_failure: bool = True) -> tuple[bool, str, str]:
        """Comprehensive verification: checks fast items + entire audit hash chain."""
        ok, r, ev = self.check_fast(lock_on_failure=lock_on_failure)
        if not ok:
            return False, r, ev
        # Verify the entire audit chain
        v = self.active_audit.verify()
        if not v.get("ok"):
            probs = v.get("problems", [])
            evidence = probs[0].get("reason", "Chain verification failed") if probs else "Corrupt audit chain"
            if probs:
                evidence = f"Event {probs[0].get('id')}: {evidence}"
            reason = "Audit ledger cryptographic chain verification failed"
            if lock_on_failure:
                self.trigger_lockdown(reason, evidence)
            return False, reason, evidence
        self._last_full_verify = time.time()
        return True, "", ""

    def on_audit_append(self, seq: int, head_hash: str) -> None:
        """Hook called by AuditLog after an append completes."""
        self.write_anchor(seq, head_hash)

    def create_snapshot(self) -> Path:
        """Create a consistent transaction-safe SQLite snapshot in snapshots/latest.db."""
        snap_p = self.snapshot_dir / "latest.db"
        dest = sqlite3.connect(str(snap_p))
        try:
            self.active_db.conn().backup(dest)
        finally:
            dest.close()
        return snap_p

    def restore_snapshot_file(self) -> None:
        """Restore SQLite state from snapshots/latest.db using SQLite backup API."""
        snap_p = self.snapshot_dir / "latest.db"
        if not snap_p.is_file():
            raise bad_request("No snapshot file available in snapshots/latest.db")
        src = sqlite3.connect(str(snap_p))
        try:
            src.backup(self.active_db.conn())
        finally:
            src.close()

    # ---------------------------------------------------------------------------
    # Background Daemon & Startup
    # ---------------------------------------------------------------------------
    def start(self) -> None:
        """Initialize state and start 5-second background checker."""
        self.active_audit.init_keyed(self._key, anchor_callback=self.on_audit_append)
        if not self.state_file.is_file():
            self.sign_security_state()
        if not self.anchor_file.is_file():
            h = self.active_audit.head()
            self.write_anchor(h["count"], h["hash"])
        if not self.is_locked():
            ok, r, ev = self.check_fast()
            if not ok:
                self.trigger_lockdown(r, ev)

        try:
            self.create_snapshot()
        except Exception as e:
            log.warning("Initial snapshot creation failed: %s", e)

        self._stop_event.clear()
        self._bg_thread = threading.Thread(target=self._run_bg_loop, daemon=True, name="clarix-integrity-guard")
        self._bg_thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._bg_thread and self._bg_thread.is_alive():
            self._bg_thread.join(timeout=2.0)

    def _run_bg_loop(self) -> None:
        while not self._stop_event.wait(2.5):
            try:
                if self.is_locked():
                    continue
                ok, r, ev = self.check_full()
                if not ok:
                    self.trigger_lockdown(r, ev)
            except Exception as e:
                log.error("Integrity background check error: %s", e)

    # ---------------------------------------------------------------------------
    # Recovery
    # ---------------------------------------------------------------------------
    def recover(self, action: str = "rebaseline", reason: str = "", confirmation: str = "", operator: str = "operator", mode: str | None = None) -> dict:
        """Recover system from lockdown via rebaseline or snapshot restoration."""
        action = mode or action
        if not reason or len(reason.strip()) < 20:
            raise bad_request("A detailed reason of at least 20 characters is required for recovery.")

        if action == "restore_snapshot":
            self.restore_snapshot_file()
            if self.lockdown_file.is_file():
                self.lockdown_file.unlink()
            ok, r, ev = self.check_full()
            if not ok:
                self.trigger_lockdown(r, ev)
                raise bad_request(f"Snapshot restored but failed integrity verification: {r} ({ev})")
            return {"ok": True, "action": "restore_snapshot", "message": "System restored from snapshot and verified."}

        elif action == "rebaseline":
            if confirmation.strip() != REBASELINE_CONFIRMATION:
                raise bad_request(f"Confirmation phrase mismatch. You must send exactly: '{REBASELINE_CONFIRMATION}'")

            with self._lock:
                # 1. Restore triggers if missing
                from .db import SCHEMA
                self.active_db.conn().executescript(SCHEMA)

                # 2. If chain is damaged, re-seal audit events
                v = self.active_audit.verify()
                if not v.get("ok"):
                    from .audit import canonical_of, chain_hash, FIELDS, GENESIS
                    upgrade_seq = self.active_audit._find_upgrade_seq()
                    with self.active_db.tx() as con:
                        con.execute("DROP TRIGGER IF EXISTS audit_no_update")
                        con.execute("DROP TRIGGER IF EXISTS audit_no_delete")
                        rows = con.execute("SELECT * FROM audit_events ORDER BY seq ASC").fetchall()
                        cols = [d[0] for d in con.execute("SELECT * FROM audit_events LIMIT 1").description]
                        prev = GENESIS
                        for r in rows:
                            row_dict = dict(zip(cols, r))
                            rec = {k: row_dict[k] for k in FIELDS}
                            canon = canonical_of(rec)
                            use_key = self._key if (upgrade_seq is not None and row_dict["seq"] >= upgrade_seq) else None
                            h = chain_hash(prev, canon, use_key)
                            con.execute("UPDATE audit_events SET canonical=?, prev_hash=?, hash=? WHERE seq=?",
                                        (canon, prev, h, row_dict["seq"]))
                            prev = h
                        con.execute(
                            "CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_events "
                            "BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;"
                        )
                        con.execute(
                            "CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_events "
                            "BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;"
                        )

                # 3. Re-sign security state
                self.sign_security_state()

                # 4. Append RECOVERY_REBASELINE event (in demo mode, this is in demo ledger only)
                self.active_audit.init_keyed(self._key, anchor_callback=self.on_audit_append)
                self.active_audit.append(
                    user=operator,
                    action=f"RECOVERY_REBASELINE: {reason}",
                    component="Integrity Guard",
                    risk="CRITICAL",
                    decision="ALLOW",
                    classification="RESTRICTED",
                    payload=f"integrity:rebaseline:{reason}"
                )

                # 5. Re-anchor to current head including the recovery event
                head = self.active_audit.head()
                self.write_anchor(head["count"], head["hash"])

                # 6. Clear lockdown file
                if self.lockdown_file.is_file():
                    self.lockdown_file.unlink()

                # 7. Run full check
                ok, r, ev = self.check_full()
                if not ok:
                    self.trigger_lockdown(r, ev)
                    raise bad_request(f"Rebaseline attempted but integrity verification failed: {r} ({ev})")

                try:
                    self.create_snapshot()
                except Exception:
                    pass

                self.record_incident("RECOVERY_COMPLETED", f"Rebaseline by {operator}", reason)
                return {"ok": True, "action": "rebaseline", "message": "System state successfully rebaselined and unlocked."}

        raise bad_request("Invalid recovery action. Choose 'rebaseline' or 'restore_snapshot'.")

    def verify_legacy_sha256(self) -> dict:
        """Plain SHA-256 verification of audit_events table without HMAC key or external anchor."""
        from .audit import canonical_of, FIELDS, GENESIS
        con = self.active_db.conn()
        try:
            rows = con.execute("SELECT * FROM audit_events ORDER BY seq ASC").fetchall()
            cols = [d[0] for d in con.execute("SELECT * FROM audit_events LIMIT 1").description] if rows else []
        except Exception as e:
            return {"ok": False, "status": "ERROR", "count": 0, "problems": [{"reason": str(e)}], "head": GENESIS, "message": str(e)}

        prev = GENESIS
        expected_seq = 1
        problems = []
        for r in rows:
            row_dict = dict(zip(cols, r))
            rec = {k: row_dict[k] for k in FIELDS}
            canon = canonical_of(rec)
            if row_dict["seq"] != expected_seq:
                problems.append({"id": row_dict["id"], "reason": f"Sequence gap: expected {expected_seq}, found {row_dict['seq']}"})
            if row_dict["prev_hash"] != prev:
                problems.append({"id": row_dict["id"], "reason": "Parent hash mismatch"})
            h = hashlib.sha256((row_dict["prev_hash"] + canon).encode("utf-8")).hexdigest()
            if h != row_dict["hash"]:
                problems.append({"id": row_dict["id"], "reason": "Plain SHA-256 hash mismatch"})
            prev = row_dict["hash"]
            expected_seq = row_dict["seq"] + 1

        is_ok = len(problems) == 0
        return {
            "ok": is_ok,
            "status": "VALID" if is_ok else "CORRUPTED",
            "count": len(rows),
            "problems": problems,
            "broken_count": len(problems),
            "head": prev,
            "verifier": "legacy_plain_sha256",
            "message": "Valid plain SHA-256 chain (unkeyed, no anchor validation)" if is_ok else f"Corrupted at {problems[0]['id']}"
        }

    def compare_verifiers(self) -> dict:
        """Compare legacy plain-SHA-256 verifier with Clarix keyed HMAC-SHA256 verifier (POL-006)."""
        legacy = self.verify_legacy_sha256()
        locked = self.is_locked()
        info = self.get_lockdown_info() or {}

        trig_ok, trig_err = self.check_triggers()
        state_ok, state_err = self.check_security_state()
        anchor_ok, anchor_err = self.check_anchor()
        chain_v = self.active_audit.verify()
        chain_ok = chain_v.get("ok", False)

        clarix_ok = trig_ok and state_ok and anchor_ok and chain_ok and not locked

        reasons = []
        if not trig_ok: reasons.append(trig_err)
        if not state_ok: reasons.append(state_err)
        if not anchor_ok: reasons.append(anchor_err)
        if not chain_ok:
            probs = chain_v.get("problems", [])
            reasons.append(probs[0].get("reason", "HMAC chain broken") if probs else "Chain broken")
        if locked and info.get("reason"):
            reasons.insert(0, info["reason"])

        clarix_reason = "; ".join(reasons) if reasons else "All 4 cryptographic barriers verified"
        clarix_evidence = info.get("evidence", "") or (reasons[0] if reasons else "No tampering detected")

        return {
            "status": "TAMPER_DETECTED" if (locked or not clarix_ok) else "CLEAN",
            "legacy": {
                "ok": legacy["ok"],
                "status": legacy["status"],
                "count": legacy["count"],
                "head": legacy["head"],
                "message": legacy["message"],
                "note": "Legacy plain SHA-256 only checks local hash continuity. It has no access to audit.key and does not verify external anchor or signed state."
            },
            "clarix": {
                "ok": clarix_ok,
                "status": "LOCKED" if locked else ("VERIFIED" if clarix_ok else "TAMPERED"),
                "reason": clarix_reason,
                "evidence": clarix_evidence,
                "layers": {
                    "triggers": trig_ok,
                    "signed_state": state_ok,
                    "external_anchor": anchor_ok,
                    "hmac_chain": chain_ok
                },
                "note": "Clarix POL-006 enforces 4 cryptographic barriers (HMAC key, external signed anchor, signed security state, triggers). System fails closed on any mismatch."
            },
            "dbState": {
                "count": self.active_audit.count(),
                "locked": locked,
                "demoMode": bool(self.demo_mode or getattr(self.settings, "demo_mode", False))
            }
        }

    def set_demo_mode(self, enabled: bool) -> dict:
        """
        Dynamically toggle between Isolated Demo Sandbox and Live Production mode.
        When enabled: the WHOLE app context (audit table, verify, integrity checker,
        lockdown, anchor, key, permissions/policies) switches to data/demo/.
        When disabled: cleanly returns to the live ledger without altering live files.
        """
        with self._lock:
            self.demo_mode = enabled
            self.active_data_dir = self.demo_data_dir if self.demo_mode else self.real_data_dir
            self.active_data_dir.mkdir(parents=True, exist_ok=True)
            self.active_db_path = self.demo_db_path if self.demo_mode else self.real_db_path
            self.key_file = self.active_data_dir / ("audit_demo.key" if self.demo_mode else "audit.key")
            self.anchor_file = self.active_data_dir / ("audit_demo_anchor.json" if self.demo_mode else "audit_anchor.json")
            self.state_file = self.active_data_dir / "security_state.json"
            self.lockdown_file = self.active_data_dir / "lockdown.json"
            self.incident_file = self.active_data_dir / "incidents.log"
            self.snapshot_dir = self.active_data_dir / "snapshots"
            self.snapshot_dir.mkdir(parents=True, exist_ok=True)

            from .db import Database
            from .audit import AuditLog

            if self.demo_mode:
                if not hasattr(self, "demo_db") or self.demo_db is None:
                    self.demo_db = Database(self.demo_db_path)
                    self.demo_audit = AuditLog(self.demo_db)
                self.active_db = self.demo_db
                self.active_audit = self.demo_audit

                # If demo DB has 0 events or does not exist, initialize with 40 seed events
                if not self.demo_db_path.is_file() or self.demo_audit.count() == 0:
                    self.reset_demo()
                else:
                    self._key = self._load_or_create_key()
                    self.demo_audit._key = self._key
                    self.demo_audit._anchor_cb = self.on_audit_append
                    self.demo_audit._upgrade_seq = self.demo_audit._find_upgrade_seq()
            else:
                self.active_db = self.ctx.db
                self.active_audit = self.ctx.audit
                self._key = self._load_or_create_key()
                self.ctx.audit._key = self._key
                self.ctx.audit._anchor_cb = self.on_audit_append
                self.ctx.audit._upgrade_seq = self.ctx.audit._find_upgrade_seq()

            if hasattr(self.ctx, "settings"):
                try:
                    object.__setattr__(self.ctx.settings, "demo_mode", self.demo_mode)
                except Exception:
                    pass

            self._cached_status = {"status": "PENDING", "lockdown": None}
            self._last_checked = 0.0
            ok, reason, evidence = self.check_fast(lock_on_failure=True)

            head_info = self.active_audit.head()
            return {
                "ok": True,
                "demoMode": self.demo_mode,
                "ledger": "demo" if self.demo_mode else "live",
                "dbPath": str(self.active_db_path),
                "count": self.active_audit.count(),
                "head": head_info["hash"],
                "locked": self.is_locked(),
                "status": "LOCKED" if self.is_locked() else "VERIFIED"
            }

    def reset_demo(self) -> dict:
        """
        Rebuild the demo ledger from a fixed seed of 40 realistic events.
        Strictly isolated to data/demo/. Never touches production ledger.
        """
        if not (self.demo_mode or self.settings.demo_mode or self.settings.demo_endpoints):
            raise forbidden("Demo reset is only available in demo mode.")

        with self._lock:
            # 1. Unlink lockdown and incidents in demo dir
            if self.lockdown_file.is_file():
                try:
                    self.lockdown_file.unlink()
                except Exception:
                    pass
            if self.incident_file.is_file():
                try:
                    self.incident_file.unlink()
                except Exception:
                    pass

            # 2. Re-create / clean SQLite schema in demo DB
            from .db import Database, SCHEMA
            from .audit import AuditLog
            self.demo_data_dir.mkdir(parents=True, exist_ok=True)
            self.demo_db = Database(self.demo_db_path)
            self.demo_audit = AuditLog(self.demo_db)
            self.active_db = self.demo_db
            self.active_audit = self.demo_audit

            con = self.demo_db.conn()
            con.execute("DROP TRIGGER IF EXISTS audit_no_update")
            con.execute("DROP TRIGGER IF EXISTS audit_no_delete")
            con.execute("DELETE FROM audit_events")
            con.execute("DELETE FROM sqlite_sequence WHERE name='audit_events'")
            con.executescript(SCHEMA)

            # Add demo marker table
            con.execute("CREATE TABLE IF NOT EXISTS demo_metadata (key TEXT PRIMARY KEY, value TEXT, created_at TEXT)")
            con.execute("INSERT OR REPLACE INTO demo_metadata (key, value, created_at) VALUES ('ledger_type', 'clarix_demo_sandbox', ?)", (utcstamp(),))

            # Restore default policies and tool permissions in demo DB
            from .security.policy import POLICIES
            for p in POLICIES:
                con.execute("INSERT OR REPLACE INTO policies(id, enabled, enforcements, last_modified) VALUES(?,1,0,?)",
                            (p.id, utcstamp()))
            from .tools.registry import TOOLS
            for t in TOOLS.values():
                con.execute("INSERT OR REPLACE INTO tools(id, level, executions, last_run) VALUES(?,?,0,NULL)",
                            (t.id, t.default_level))

            con.commit()

            # 3. Re-bind key & anchor
            try:
                if self.key_file.is_file():
                    self.key_file.unlink()
            except Exception:
                pass
            try:
                if self.anchor_file.is_file():
                    self.anchor_file.unlink()
            except Exception:
                pass

            self._key = self._load_or_create_key()
            self.demo_audit._key = self._key
            self.demo_audit._anchor_cb = self.on_audit_append
            self.demo_audit._upgrade_seq = None

            # 4. Populate fixed seed of 40 realistic events
            seed_events = [
                ("system", "SYSTEM_BOOT", "Integrity Guard", "LOW", "ALLOW", "INTERNAL", "boot:enclave_init:airgap=enforce"),
                ("system", "CHAIN_UPGRADE", "Integrity Guard", "LOW", "ALLOW", "INTERNAL", "algorithm:HMAC-SHA256"),
                ("admin", "Policy POL-001 enforced", "Policy Engine", "LOW", "ALLOW", "INTERNAL", "policy:egress_mandate:state=ACTIVE"),
                ("admin", "Policy POL-006 enforced", "Policy Engine", "LOW", "ALLOW", "INTERNAL", "policy:tamper_lockdown:mode=ENFORCE"),
                ("operator", "Tool configured: shell", "Tool Registry", "HIGH", "REQUIRE_APPROVAL", "INTERNAL", "tool:shell:permission=RESTRICTED"),
                ("operator", "Document ingested: network_topology.csv", "Vector RAG", "LOW", "ALLOW", "INTERNAL", "doc:network_topology.csv:chunks=4:class=INTERNAL"),
                ("operator", "Document ingested: project_spec.docx", "Vector RAG", "LOW", "ALLOW", "INTERNAL", "doc:project_spec.docx:chunks=8:class=INTERNAL"),
                ("operator", "Document ingested: compliance_policy.txt", "Vector RAG", "LOW", "ALLOW", "PUBLIC", "doc:compliance_policy.txt:chunks=6:class=PUBLIC"),
                ("operator", "Agent query received", "AI Agent", "LOW", "ALLOW", "INTERNAL", "agent:REQ-2026-00001:query:summarize network architecture"),
                ("system", "RAG chunks retrieved", "Vector RAG", "LOW", "ALLOW", "INTERNAL", "rag:retrieved:chunks=4:doc=network_topology.csv"),
                ("operator", "Blocked prompt: instruction_override", "Prompt Injection", "HIGH", "BLOCK", "INTERNAL", "agent:REQ-2026-00002:blocked:instruction_override:ignore previous guidelines"),
                ("system", "Threat recorded: prompt_injection", "Threat Engine", "HIGH", "BLOCK", "INTERNAL", "threat:THREAT-00001:category=PROMPT_INJECTION:status=BLOCKED"),
                ("operator", "Blocked prompt: system_prompt_leak", "Prompt Injection", "HIGH", "BLOCK", "INTERNAL", "agent:REQ-2026-00003:blocked:leak_system_prompt"),
                ("system", "Threat recorded: prompt_leak", "Threat Engine", "HIGH", "BLOCK", "INTERNAL", "threat:THREAT-00002:category=SYSTEM_LEAK:status=BLOCKED"),
                ("operator", "Tool invoked: calculator", "Tool Runtime", "LOW", "ALLOW", "INTERNAL", "calc:eval:512*1024/64"),
                ("operator", "Tool invoked: system_info", "Tool Runtime", "LOW", "ALLOW", "INTERNAL", "sysinfo:os=windows:arch=x86_64"),
                ("operator", "Egress attempt blocked: exfil.evil.com:443", "Air-Gap Guard", "CRITICAL", "BLOCK", "RESTRICTED", "airgap:blocked:host=exfil.evil.com:port=443:rule=POL-001"),
                ("system", "Threat recorded: outbound_egress", "Threat Engine", "CRITICAL", "BLOCK", "RESTRICTED", "threat:THREAT-00003:category=DATA_EXFILTRATION:status=BLOCKED"),
                ("operator", "Egress attempt blocked: pastebin.com:80", "Air-Gap Guard", "CRITICAL", "BLOCK", "RESTRICTED", "airgap:blocked:host=pastebin.com:port=80:rule=POL-001"),
                ("operator", "Approval requested: shell tool execution", "Human Approval", "HIGH", "REQUIRE_APPROVAL", "RESTRICTED", "approval:APP-00001:tool=shell:cmd=netstat -an"),
                ("admin", "Approval granted: APP-00001", "Human Approval", "HIGH", "ALLOW", "RESTRICTED", "approval:APP-00001:decision=APPROVED:approver=admin"),
                ("operator", "Tool invoked: shell", "Tool Runtime", "HIGH", "ALLOW", "RESTRICTED", "shell:exec:netstat -an:grant=APP-00001"),
                ("operator", "Approval requested: read confidential salary.pdf", "Human Approval", "HIGH", "REQUIRE_APPROVAL", "RESTRICTED", "approval:APP-00002:tool=file_reader:file=salary.pdf"),
                ("admin", "Approval denied: APP-00002", "Human Approval", "HIGH", "BLOCK", "RESTRICTED", "approval:APP-00002:decision=DENIED:reason=Unauthorized salary access"),
                ("operator", "Tool invoked: db_query", "Tool Runtime", "MEDIUM", "ALLOW", "INTERNAL", "db:SELECT count(*) FROM audit_events"),
                ("operator", "Document ingested: incident_response_plan.md", "Vector RAG", "LOW", "ALLOW", "INTERNAL", "doc:incident_response_plan.md:chunks=5"),
                ("operator", "Agent query: compliance audit check", "AI Agent", "LOW", "ALLOW", "INTERNAL", "agent:REQ-2026-00004:query:verify compliance status"),
                ("system", "RAG chunks retrieved", "Vector RAG", "LOW", "ALLOW", "INTERNAL", "rag:retrieved:chunks=3:doc=compliance_policy.txt"),
                ("operator", "Offline Whisper voice input", "Voice Engine", "LOW", "ALLOW", "INTERNAL", "voice:transcribe:duration=2400ms:lang=en:model=base"),
                ("operator", "Offline Piper voice speech output", "Voice Engine", "LOW", "ALLOW", "INTERNAL", "tts:synthesize:voice=en_US-lessac-low:len=184chars"),
                ("operator", "Controlled ReAct agent run initiated", "Agent Runner", "LOW", "ALLOW", "INTERNAL", "runner:create_run:run_demo_01:role=analyst:plan_mode=plan_then_act"),
                ("operator", "Agent Plan Awaiting Approval", "Agent Runner", "LOW", "ALLOW", "INTERNAL", "runner:plan_created:run_demo_01:steps=3"),
                ("operator", "Agent Plan Approved", "Agent Runner", "LOW", "ALLOW", "INTERNAL", "runner:plan_approved:run_demo_01:steps=3"),
                ("operator", "ReAct Step 1: Search RAG knowledge base", "Agent Runner", "LOW", "ALLOW", "INTERNAL", "runner:step:1:tool=rag_search"),
                ("operator", "ReAct Step 2: Query security policies", "Agent Runner", "MEDIUM", "ALLOW", "INTERNAL", "runner:step:2:tool=db_query"),
                ("operator", "ReAct Step 3: Synthesize verified response", "Agent Runner", "LOW", "ALLOW", "INTERNAL", "runner:step:3:tool=rag_search:evidence_verified=TRUE"),
                ("operator", "Agent memory recall", "Agent Memory", "LOW", "ALLOW", "INTERNAL", "memory:recall:query=security controls"),
                ("operator", "Document deleted: obsolete_notes.txt", "Vector RAG", "LOW", "ALLOW", "INTERNAL", "rag:delete:obsolete_notes.txt:chunks=2"),
                ("system", "Periodic cryptographic health check", "Integrity Guard", "LOW", "ALLOW", "INTERNAL", "integrity:check_fast:triggers=OK:state=OK:anchor=OK"),
                ("system", "External anchor synchronised", "Integrity Guard", "LOW", "ALLOW", "INTERNAL", "anchor:synced:count=40:algorithm=HMAC-SHA256"),
            ]

            for user, action, comp, risk, dec, cls, payload in seed_events:
                self.demo_audit.append(user=user, action=action, component=comp, risk=risk,
                                      decision=dec, classification=cls, payload=payload)

            # 5. Sign security state and update anchor
            self.sign_security_state()
            h = self.demo_audit.head()
            self.write_anchor(h["count"], h["hash"])

            # 6. Create clean snapshot
            self.create_snapshot()

            # 7. Reset cached status
            self._cached_status = {"status": "VERIFIED", "lockdown": None}
            self._last_checked = time.time()
            self._last_full_verify = time.time()

            return {
                "ok": True,
                "count": h["count"],
                "head": h["hash"],
                "mode": "demo",
                "ledger": "demo",
                "dbPath": str(self.demo_db_path),
                "message": f"Demo ledger successfully reset to {h['count']} seed events."
            }

    # ---------------------------------------------------------------------------
    # Demo Out-of-Band Tamper Execution
    # ---------------------------------------------------------------------------
    def demo_tamper(self, tamper_type: str) -> dict:
        """Inject out-of-band tampering directly into SQLite bypassing the API."""
        if not (self.demo_mode or self.settings.demo_mode or self.settings.demo_endpoints):
            raise forbidden("Demo tamper injection is disabled outside demo mode.")

        db = self.active_db
        con = db.conn()

        if tamper_type == "edit_row_and_rehash":
            con.execute("DROP TRIGGER IF EXISTS audit_no_update")
            row = con.execute("SELECT seq FROM audit_events WHERE action != 'CHAIN_UPGRADE' AND seq >= 10 ORDER BY seq ASC LIMIT 1").fetchone()
            if not row:
                row = con.execute("SELECT seq FROM audit_events ORDER BY seq DESC LIMIT 1").fetchone()
            seq = row[0] if row else 1
            con.execute("UPDATE audit_events SET decision='ALLOW', action='Document Exfiltration: ALLOWED (Tampered)', payload='tampered_payload_bypass' WHERE seq=?", (seq,))
            from .audit import canonical_of, FIELDS, GENESIS
            cols = [d[0] for d in con.execute("SELECT * FROM audit_events LIMIT 1").description]
            all_rows = con.execute("SELECT * FROM audit_events ORDER BY seq ASC").fetchall()
            prev = GENESIS
            for r in all_rows:
                row_dict = dict(zip(cols, r))
                rec = {k: row_dict[k] for k in FIELDS}
                canon = canonical_of(rec)
                h = hashlib.sha256((prev + canon).encode("utf-8")).hexdigest()
                con.execute("UPDATE audit_events SET canonical=?, prev_hash=?, hash=? WHERE seq=?",
                            (canon, prev, h, row_dict["seq"]))
                prev = h
            con.execute(
                "CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_events "
                "BEGIN SELECT RAISE(FAIL, 'audit_events is append-only'); END;"
            )
            con.commit()

        elif tamper_type == "truncate_tail":
            con.execute("DROP TRIGGER IF EXISTS audit_no_delete")
            con.execute("DELETE FROM audit_events WHERE seq IN (SELECT seq FROM audit_events ORDER BY seq DESC LIMIT 3)")
            con.commit()

        elif tamper_type == "forge_row":
            last = con.execute("SELECT seq, hash FROM audit_events ORDER BY seq DESC LIMIT 1").fetchone()
            seq = (last[0] if last else 0) + 1
            prev = last[1] if last else "0" * 64
            from .audit import canonical_of
            rec = {
                "id": f"EVT-{seq:06d}", "timestamp": utcstamp(), "user": "forged_user",
                "action": "Forged audit entry", "component": "AI Agent", "risk": "LOW",
                "decision": "ALLOW", "classification": "PUBLIC", "payload": "forged:payload"
            }
            canon = canonical_of(rec)
            h = hashlib.sha256((prev + canon).encode("utf-8")).hexdigest()
            con.execute(
                "INSERT INTO audit_events VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (seq, rec["id"], rec["timestamp"], rec["user"], rec["action"], rec["component"],
                 rec["risk"], rec["decision"], rec["classification"], rec["payload"], canon, prev, h)
            )
            con.commit()

        elif tamper_type == "rollback_db":
            con.execute("DROP TRIGGER IF EXISTS audit_no_delete")
            con.execute("DELETE FROM audit_events WHERE seq > 3")
            con.commit()

        elif tamper_type == "change_permission":
            con.execute("UPDATE tools SET level='ALLOW' WHERE id='shell'")
            con.commit()

        elif tamper_type == "disable_policy":
            con.execute("UPDATE policies SET enabled=0 WHERE id='POL-001'")
            con.commit()

        elif tamper_type == "drop_trigger":
            con.execute("DROP TRIGGER IF EXISTS audit_no_update")
            con.execute("UPDATE audit_events SET payload='tampered_out_of_band_without_trigger' WHERE seq=5")
            con.commit()

        else:
            raise bad_request(f"Unknown tamper attack type: {tamper_type}")

        ok, reason, evidence = self.check_fast()
        if not ok:
            self.trigger_lockdown(reason, evidence)

        return {
            "attack": tamper_type,
            "tamper_injected": True,
            "detected": not ok,
            "reason": reason,
            "evidence": evidence,
            "status": "LOCKED" if not ok else "ACTIVE"
        }

    # ---------------------------------------------------------------------------
    # Status & Export
    # ---------------------------------------------------------------------------
    def get_status(self) -> dict:
        locked = self.is_locked()
        info = self.get_lockdown_info() or {}
        anchor_data = None
        if self.anchor_file.is_file():
            try:
                anchor_data = json.loads(self.anchor_file.read_text(encoding="utf-8"))
            except Exception:
                pass

        trig_ok, _ = self.check_triggers()
        state_ok, _ = self.check_security_state()
        anchor_ok, _ = self.check_anchor()

        return {
            "status": "LOCKED" if locked else ("WARN" if self.mode == "warn" and not (trig_ok and state_ok and anchor_ok) else "VERIFIED"),
            "mode": self.mode,
            "locked": locked,
            "reason": info.get("reason", "") if locked else "",
            "evidence": info.get("evidence", "") if locked else "",
            "lockdown": info if locked else None,
            "triggers_ok": trig_ok,
            "state_sig_ok": state_ok,
            "anchor_ok": anchor_ok,
            "last_checked": utcstamp(self._last_checked) if self._last_checked else utcstamp(),
            "last_checked_seconds_ago": max(0, int(time.time() - self._last_checked)) if self._last_checked else 0,
            "anchor": anchor_data,
            "pol006_active": True
        }

    def get_incidents(self) -> list[dict]:
        if not self.incident_file.is_file():
            return []
        try:
            records = []
            for line in self.incident_file.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    records.append(json.loads(line))
            return records
        except Exception:
            return []

    def export_anchor(self) -> dict:
        if not self.anchor_file.is_file():
            h = self.active_audit.head()
            return self.write_anchor(h["count"], h["hash"])
        return json.loads(self.anchor_file.read_text(encoding="utf-8"))
