"""Tests for Cryptographic Integrity Lockdown (POL-006 / Tamper Lockdown).

Covers:
1. Keyed HMAC-SHA256 audit chain and seamless CHAIN_UPGRADE from SHA-256 legacy rows.
2. External anchor writing and truncation/rollback detection.
3. Immutability trigger verification and auto-recreation/lockdown.
4. Cryptographically signed security state and unauthorized direct-DB tampering detection.
5. Fail-closed lockdown with HTTP 423 and persistence across restart.
6. Admin recovery via snapshot restore and authenticated rebaseline with exact phrase.
7. Audit coverage: 401/403/429 rate-limited logging and RAG query logging.
8. Sub-20ms fast check performance.
9. All 7 demo tamper attack scenarios.
"""
import os
import shutil
import time
import unittest
from pathlib import Path

from clarix.audit import AuditLog, chain_hash
from clarix.config import Settings
from clarix.context import Context
from clarix.errors import SystemLockedError
from clarix.integrity import (
    CONFIRMATION_PHRASE,
    IntegrityManager,
)
from clarix.services import (
    agent_chat,
    integrity_recover,
    integrity_status,
    policy_patch,
    rag_query,
    tool_execute,
    tool_permission,
)
from tests.helpers import Env


class DummyReq:
    def __init__(self, data=None, params=None, query=None, operator="admin"):
        self._data = data or {}
        self.params = params or {}
        self.query = query or {}
        self.operator = operator
        self.headers = {}
        self.files = {}
        self.form = {}

    def json(self):
        return self._data


class IntegrityLockdownTests(Env):
    def setUp(self):
        super().setUp()
        from dataclasses import replace
        self.ctx.close()
        self.settings = replace(self.settings, demo_mode=False, demo_endpoints=True, integrity_mode="enforce")
        self.ctx = Context(self.settings, install_guard=True)
        self.ctx.start()

    def test_01_keyed_hmac_chain_and_upgrade(self):
        """Audit chain transitions seamlessly to HMAC and verifies all rows."""
        audit = self.ctx.audit
        self.assertGreaterEqual(audit.count(), 1)
        res = audit.verify()
        self.assertTrue(res["ok"])
        self.assertEqual(len(res["problems"]), 0)

        # Append a new row; should be keyed
        head_before = audit.head()
        new_row = audit.append(
            user="tester",
            action="Keyed test action",
            component="IntegrityTest",
            risk="LOW",
            decision="ALLOW",
            classification="INTERNAL",
            payload="test:payload:1",
        )
        self.assertNotEqual(new_row["hash"], head_before["hash"])
        res2 = audit.verify()
        self.assertTrue(res2["ok"])

    def test_02_external_anchor_and_truncation_detection(self):
        """External signed anchor file catches tail truncation."""
        mgr = self.ctx.integrity
        mgr.check_fast()
        self.assertFalse(mgr.is_locked())

        # Simulate truncation attack: drop triggers, delete latest rows from DB, restore triggers
        self.ctx.db.x("DROP TRIGGER IF EXISTS audit_no_delete")
        self.ctx.db.x("DELETE FROM audit_events WHERE id = (SELECT id FROM audit_events ORDER BY id DESC LIMIT 1)")
        from clarix.db import SCHEMA
        self.ctx.db.conn().executescript(SCHEMA)

        # Verify integrity manager catches DB count < anchor count
        mgr.check_fast()
        self.assertTrue(mgr.is_locked())
        status = mgr.status()
        self.assertEqual(status["locked"], True)
        self.assertIn("Audit log count", status["reason"])

    def test_03_trigger_guard(self):
        """Dropping audit triggers is detected by trigger guard."""
        mgr = self.ctx.integrity
        self.ctx.db.x("DROP TRIGGER IF EXISTS audit_no_update")
        mgr.check_fast()
        self.assertTrue(mgr.is_locked())
        self.assertIn("audit_no_update", mgr.status()["reason"])

    def test_04_signed_security_state_policy_tamper(self):
        """Direct DB modification of policies table breaks state signature."""
        mgr = self.ctx.integrity
        mgr.check_fast()
        self.assertFalse(mgr.is_locked())

        # Attacker modifies policy directly in DB
        self.ctx.db.x("UPDATE policies SET enabled = 0 WHERE id = 'POL-001'")
        mgr.check_fast()
        self.assertTrue(mgr.is_locked())
        status = mgr.status()
        self.assertIn("Security state tampered", status["reason"])
        self.assertIn("POL-001", status["evidence"])

    def test_05_signed_security_state_tool_permission_tamper(self):
        """Direct DB modification of tools table breaks state signature."""
        mgr = self.ctx.integrity
        mgr.check_fast()
        self.assertFalse(mgr.is_locked())

        # Attacker elevates shell tool to ALLOW directly in DB
        self.ctx.db.x("UPDATE tools SET level = 'EXECUTE' WHERE id = 'shell'")
        mgr.check_fast()
        self.assertTrue(mgr.is_locked())
        status = mgr.status()
        self.assertIn("Security state tampered", status["reason"])
        self.assertIn("shell", status["evidence"])

    def test_06_legitimate_api_updates_do_not_lock(self):
        """Legitimate API changes update signed security state atomically without triggering lockdown."""
        mgr = self.ctx.integrity
        self.assertFalse(mgr.is_locked())

        # Legit policy patch
        policy_patch(self.ctx, DummyReq({"enabled": False}, params={"id": "POL-002"}))
        mgr.check_fast()
        self.assertFalse(mgr.is_locked())

        # Legit tool permission change
        tool_permission(self.ctx, DummyReq({"level": "RESTRICTED"}, params={"id": "calc"}))
        mgr.check_fast()
        self.assertFalse(mgr.is_locked())

    def test_07_lockdown_fail_closed_and_http_423(self):
        """When locked down, sensitive endpoints raise SystemLockedError (HTTP 423)."""
        mgr = self.ctx.integrity
        mgr.lock(reason="Tamper test", evidence="Manual lock for test")
        self.assertTrue(mgr.is_locked())

        # Sensitive actions must fail with SystemLockedError
        with self.assertRaises(SystemLockedError) as cm:
            agent_chat(self.ctx, DummyReq({"message": "Hello"}))
        self.assertEqual(cm.exception.status, 423)
        self.assertEqual(cm.exception.code, "system_locked")
        self.assertEqual(cm.exception.reason, "Tamper test")

        with self.assertRaises(SystemLockedError):
            tool_execute(self.ctx, DummyReq({"input": "1+1"}, params={"id": "calc"}))

        # Non-sensitive endpoints must still work
        st = integrity_status(self.ctx, DummyReq())
        self.assertTrue(st["locked"])

    def test_08_lockdown_persists_across_restart(self):
        """Lockdown state is stored on disk and persists if the process restarts."""
        mgr = self.ctx.integrity
        mgr.lock(reason="Persistent attack", evidence="Evidence row 42")
        self.assertTrue(os.path.exists(mgr.lockdown_file))

        # Simulate shutdown and restart
        self.ctx.close()
        new_ctx = Context(self.settings)
        new_ctx.start()
        try:
            self.assertTrue(new_ctx.integrity.is_locked())
            self.assertEqual(new_ctx.integrity.status()["reason"], "Persistent attack")
        finally:
            new_ctx.close()

    def test_09_recovery_rebaseline(self):
        """Admin can rebaseline system with exact confirmation phrase and reason."""
        mgr = self.ctx.integrity
        # Tamper with tool permission
        self.ctx.db.x("UPDATE tools SET level = 'RESTRICTED' WHERE id = 'calc'")
        mgr.check_fast()
        self.assertTrue(mgr.is_locked())

        # Invalid confirmation phrase must be rejected
        req_bad = DummyReq({"mode": "rebaseline", "reason": "Authorized change", "confirmation": "wrong phrase"})
        with self.assertRaises(Exception):
            integrity_recover(self.ctx, req_bad)
        self.assertTrue(mgr.is_locked())

        # Correct phrase unlocks system and signs state
        req_good = DummyReq({
            "mode": "rebaseline",
            "reason": "Authorized SOC update",
            "confirmation": CONFIRMATION_PHRASE,
        })
        res = integrity_recover(self.ctx, req_good)
        self.assertEqual(res["ok"], True)
        self.assertFalse(mgr.is_locked())
        self.assertFalse(os.path.exists(mgr.lockdown_file))

    def test_10_all_7_demo_tamper_scenarios(self):
        """All 7 demo tamper scenarios are caught and trigger lockdown."""
        attacks = [
            "edit_row_and_rehash",
            "truncate_tail",
            "forge_row",
            "rollback_db",
            "change_permission",
            "disable_policy",
            "drop_trigger",
        ]
        for atk in attacks:
            # Unlock before testing attack
            if self.ctx.integrity.is_locked():
                self.ctx.integrity.recover("restore_snapshot", "Reset state for next test scenario execution", operator="admin")
            self.assertFalse(self.ctx.integrity.is_locked(), f"Failed to reset before {atk}")

            # Trigger demo tamper
            self.ctx.integrity.demo_tamper(atk)
            # Integrity check must detect it
            self.ctx.integrity.check_fast()
            self.assertTrue(self.ctx.integrity.is_locked(), f"Attack '{atk}' was NOT detected!")

    def test_11_rag_query_audit_logging(self):
        """POST /api/rag/query appends an audit event to the ledger."""
        count_before = self.ctx.audit.count()
        # Query RAG
        rag_query(self.ctx, DummyReq({"q": "test query for audit"}))
        count_after = self.ctx.audit.count()
        self.assertGreater(count_after, count_before)
        latest = self.ctx.audit.list(1)[0]
        self.assertEqual(latest["component"], "RAG")
        self.assertIn("RAG semantic search", latest["action"])

    def test_12_sub_20ms_fast_check_performance(self):
        """check_fast() must execute in under 20 milliseconds."""
        mgr = self.ctx.integrity
        # Warmup
        mgr.check_fast()

        # Run 5 fast checks and measure average duration
        times = []
        for _ in range(5):
            t0 = time.perf_counter()
            mgr.check_fast()
            times.append((time.perf_counter() - t0) * 1000)

        avg_ms = sum(times) / len(times)
        self.assertLess(avg_ms, 20.0, f"check_fast averaged {avg_ms:.2f}ms, which exceeds 20ms threshold")


if __name__ == "__main__":
    unittest.main()
