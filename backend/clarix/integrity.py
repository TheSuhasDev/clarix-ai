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
        self.data_dir = Path(ctx.settings.data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self.key_file = self.data_dir / "audit.key"
        self.anchor_file = self.data_dir / "audit_anchor.json"
        self.state_file = self.data_dir / "security_state.json"
        self.lockdown_file = self.data_dir / "lockdown.json"
        self.incident_file = self.data_dir / "incidents.log"
        self.snapshot_dir = self.data_dir / "snapshots"
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

        # Wire into AuditLog immediately so any append updates the anchor
        if hasattr(self.ctx, "audit") and self.ctx.audit is not None:
            self.ctx.audit._anchor_cb = self.on_audit_append
            self.ctx.audit._key = self._key

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
            [{"id": r["id"], "enabled": bool(r["enabled"])} for r in self.ctx.db.q("SELECT id, enabled FROM policies")],
            key=lambda x: x["id"]
        )
        tools = sorted(
            [{"id": r["id"], "level": r["level"]} for r in self.ctx.db.q("SELECT id, level FROM tools")],
            key=lambda x: x["id"]
        )
        docs = sorted(
            [{"name": r["name"], "classification": r["classification"]} for r in self.ctx.db.q("SELECT name, classification FROM rag_documents")],
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
            head = self.ctx.audit.head()
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

            db_head = self.ctx.audit.head()
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
            rows = self.ctx.db.q(
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
        v = self.ctx.audit.verify()
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
            self.ctx.db.conn().backup(dest)
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
            src.backup(self.ctx.db.conn())
        finally:
            src.close()

    # ---------------------------------------------------------------------------
    # Background Daemon & Startup
    # ---------------------------------------------------------------------------
    def start(self) -> None:
        """Initialize state and start 5-second background checker."""
        self.ctx.audit.init_keyed(self._key, anchor_callback=self.on_audit_append)
        if not self.state_file.is_file():
            self.sign_security_state()
        if not self.anchor_file.is_file():
            h = self.ctx.audit.head()
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
        while not self._stop_event.wait(5.0):
            try:
                if self.is_locked():
                    continue
                if time.time() - self._last_full_verify > 180:
                    ok, r, ev = self.check_full()
                else:
                    ok, r, ev = self.check_fast()
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
        if not reason or len(reason.strip()) < 8:
            raise bad_request("A detailed reason of at least 8 characters is required for recovery.")

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
                self.ctx.db.conn().executescript(SCHEMA)

                # 2. If chain is damaged, re-seal audit events
                v = self.ctx.audit.verify()
                if not v.get("ok"):
                    from .audit import canonical_of, chain_hash, FIELDS, GENESIS
                    upgrade_seq = self.ctx.audit._find_upgrade_seq()
                    with self.ctx.db.tx() as con:
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

                # 4. Re-anchor to current head
                head = self.ctx.audit.head()
                self.write_anchor(head["count"], head["hash"])

                # 5. Append RECOVERY_REBASELINE event
                self.ctx.audit.append(
                    user=operator,
                    action=f"RECOVERY_REBASELINE: {reason}",
                    component="Integrity Guard",
                    risk="CRITICAL",
                    decision="ALLOW",
                    classification="RESTRICTED",
                    payload=f"integrity:rebaseline:{reason}"
                )

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

    # ---------------------------------------------------------------------------
    # Demo Out-of-Band Tamper Execution
    # ---------------------------------------------------------------------------
    def demo_tamper(self, tamper_type: str) -> dict:
        """Inject out-of-band tampering directly into SQLite bypassing the API."""
        if not (self.settings.demo_mode or self.settings.demo_endpoints):
            raise forbidden("Demo tamper injection is disabled outside demo mode.")

        db = self.ctx.db
        con = db.conn()

        if tamper_type == "edit_row_and_rehash":
            con.execute("DROP TRIGGER IF EXISTS audit_no_update")
            row = con.execute("SELECT seq FROM audit_events WHERE action != 'CHAIN_UPGRADE' ORDER BY seq DESC LIMIT 1").fetchone()
            if not row:
                row = con.execute("SELECT seq FROM audit_events ORDER BY seq DESC LIMIT 1").fetchone()
            seq = row[0] if row else 1
            con.execute("UPDATE audit_events SET payload='tampered_out_of_band_payload' WHERE seq=?", (seq,))
            from .audit import canonical_of, FIELDS
            cols = [d[0] for d in con.execute("SELECT * FROM audit_events LIMIT 1").description]
            prev_row = con.execute("SELECT hash FROM audit_events WHERE seq=?", (seq - 1,)).fetchone()
            prev = prev_row[0] if prev_row else "0" * 64
            for r in con.execute("SELECT * FROM audit_events WHERE seq>=? ORDER BY seq ASC", (seq,)).fetchall():
                row_dict = dict(zip(cols, r))
                rec = {k: row_dict[k] for k in FIELDS}
                canon = canonical_of(rec)
                h = hashlib.sha256((prev + canon).encode("utf-8")).hexdigest()
                con.execute("UPDATE audit_events SET canonical=?, prev_hash=?, hash=? WHERE seq=?",
                            (canon, prev, h, row_dict["seq"]))
                prev = h

        elif tamper_type == "truncate_tail":
            con.execute("DROP TRIGGER IF EXISTS audit_no_delete")
            con.execute("DELETE FROM audit_events WHERE seq IN (SELECT seq FROM audit_events ORDER BY seq DESC LIMIT 3)")

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

        elif tamper_type == "rollback_db":
            con.execute("DROP TRIGGER IF EXISTS audit_no_delete")
            con.execute("DELETE FROM audit_events WHERE seq > 3")

        elif tamper_type == "change_permission":
            con.execute("UPDATE tools SET level='ALLOW' WHERE id='shell'")

        elif tamper_type == "disable_policy":
            con.execute("UPDATE policies SET enabled=0 WHERE id='POL-001'")

        elif tamper_type == "drop_trigger":
            con.execute("DROP TRIGGER IF EXISTS audit_no_update")

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
            h = self.ctx.audit.head()
            return self.write_anchor(h["count"], h["hash"])
        return json.loads(self.anchor_file.read_text(encoding="utf-8"))
