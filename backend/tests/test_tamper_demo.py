"""Tests for Tamper Lockdown Demo: isolation, attack detection, legacy vs Clarix verifiers, and recovery."""

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from clarix.config import Settings
from clarix.context import Context
from clarix.errors import ApiError
from clarix.integrity import IntegrityManager


def file_sha256(path: Path) -> str:
    if not path.is_file():
        return ""
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


class TestTamperDemo(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp(prefix="clarix_tamper_test_")
        self.data_dir = Path(self.tmp_dir) / "data"
        self.data_dir.mkdir(parents=True, exist_ok=True)

        # Real prod context
        self.prod_settings = Settings(
            data_dir=self.data_dir,
            demo_mode=False,
            integrity_mode="enforce",
        )
        self.prod_ctx = Context(self.prod_settings)
        # Append some real production operational events
        self.prod_ctx.audit.append(user="alice", action="Production User Login", component="Auth", risk="LOW", decision="ALLOW", classification="INTERNAL", payload="login:alice")
        self.prod_ctx.audit.append(user="alice", action="Voice transcription", component="Voice", risk="LOW", decision="ALLOW", classification="INTERNAL", payload="transcribe:model=base")
        self.prod_ctx.integrity.sign_security_state()
        h = self.prod_ctx.audit.head()
        self.prod_ctx.integrity.write_anchor(h["count"], h["hash"])

        # Demo context
        self.demo_settings = Settings(
            data_dir=self.data_dir,
            demo_mode=True,
            integrity_mode="enforce",
        )
        self.demo_ctx = Context(self.demo_settings)

    def tearDown(self):
        try:
            self.prod_ctx.integrity.stop()
            self.prod_ctx.db.close()
        except Exception:
            pass
        try:
            self.demo_ctx.integrity.stop()
            self.demo_ctx.db.close()
        except Exception:
            pass
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def test_01_attack_script_refuses_real_db_and_unmarked_copy(self):
        """tools/attack_demo.py must strictly refuse to run on real DB and a copy of real DB lacking marker."""
        script_path = Path(__file__).resolve().parent.parent.parent / "tools" / "attack_demo.py"
        real_db = self.data_dir / "clarix.db"
        self.assertTrue(real_db.is_file())

        # 1. Run attack_demo pointing to real_db -> REFUSED
        cmd = [sys.executable, str(script_path), "--db", str(real_db), "--list"]
        res = subprocess.run(cmd, capture_output=True, text=True)
        self.assertNotEqual(res.returncode, 0, "Script should return non-zero exit code on real DB")
        self.assertIn("REFUSED TO EXECUTE", res.stdout + res.stderr)

        # 2. Copy real_db to demo directory as clarix_demo.db (lacks demo_metadata marker) -> REFUSED
        demo_dir = self.data_dir / "demo"
        demo_dir.mkdir(parents=True, exist_ok=True)
        unmarked_copy = demo_dir / "clarix_demo.db"
        shutil.copy2(real_db, unmarked_copy)
        cmd2 = [sys.executable, str(script_path), "--db", str(unmarked_copy), "--list"]
        res2 = subprocess.run(cmd2, capture_output=True, text=True)
        self.assertNotEqual(res2.returncode, 0, "Script must refuse copied real DB lacking demo marker")
        self.assertIn("MISSING DEMO MARKER TABLE", res2.stdout + res2.stderr)

    def test_02_demo_reset_strictly_isolated_and_leaves_real_files_byte_identical(self):
        """reset_demo seeds 40 events in demo data dir and leaves production files 100% byte-identical."""
        real_db = self.data_dir / "clarix.db"
        real_key = self.data_dir / "audit.key"
        real_anchor = self.data_dir / "audit_anchor.json"

        # Record SHA-256 hashes of all production ledger files before demo actions
        real_db_hash_before = file_sha256(real_db)
        real_key_hash_before = file_sha256(real_key)
        real_anchor_hash_before = file_sha256(real_anchor)
        prod_count_before = self.prod_ctx.audit.count()

        # Reset demo ledger
        res1 = self.demo_ctx.integrity.reset_demo()
        self.assertTrue(res1["ok"])
        self.assertEqual(res1["count"], 40)
        self.assertEqual(self.demo_ctx.integrity.active_audit.count(), 40)

        # Check demo files exist and have marker
        demo_db = self.data_dir / "demo" / "clarix_demo.db"
        demo_key = self.data_dir / "demo" / "audit_demo.key"
        demo_anchor = self.data_dir / "demo" / "audit_demo_anchor.json"
        self.assertTrue(demo_db.exists())
        self.assertTrue(demo_key.exists())
        self.assertTrue(demo_anchor.exists())

        # Production files MUST be 100% byte-identical
        self.assertEqual(file_sha256(real_db), real_db_hash_before, "Production clarix.db was modified by demo reset!")
        self.assertEqual(file_sha256(real_key), real_key_hash_before, "Production audit.key was modified by demo reset!")
        self.assertEqual(file_sha256(real_anchor), real_anchor_hash_before, "Production audit_anchor.json was modified by demo reset!")
        self.assertEqual(self.prod_ctx.audit.count(), prod_count_before, "Prod audit count must not change on demo reset")

        # Second reset should cleanly produce 40 events again
        res2 = self.demo_ctx.integrity.reset_demo()
        self.assertTrue(res2["ok"])
        self.assertEqual(res2["count"], 40)
        self.assertEqual(file_sha256(real_db), real_db_hash_before, "Production clarix.db modified after second reset!")

    def test_03_legacy_verify_passes_on_rehash_while_clarix_fails(self):
        """The core smart attacker proof: plain SHA-256 is blind to rehash; Clarix catches it."""
        self.demo_ctx.integrity.reset_demo()
        self.assertFalse(self.demo_ctx.integrity.is_locked())

        # Execute edit_row_and_rehash
        self.demo_ctx.integrity.demo_tamper("edit_row_and_rehash")

        # 1. Legacy verifier check -> MUST PASS (blind to downstream rehash)
        legacy = self.demo_ctx.integrity.verify_legacy_sha256()
        self.assertTrue(legacy["ok"], "Legacy verifier was expected to pass on recomputed plain hashes!")
        self.assertEqual(legacy["broken_count"], 0)

        # 2. Clarix check_full() -> MUST DETECT AND LOCK DOWN
        ok, reason, evidence = self.demo_ctx.integrity.check_full()
        self.assertFalse(ok, "Clarix verifier MUST fail on HMAC and anchor mismatch")
        self.assertTrue(self.demo_ctx.integrity.is_locked())

        # 3. Compare verifiers API
        comp = self.demo_ctx.integrity.compare_verifiers()
        self.assertEqual(comp["status"], "TAMPER_DETECTED")
        self.assertEqual(comp["legacy"]["status"], "VALID")
        self.assertIn(comp["clarix"]["status"], ("LOCKED", "TAMPER_DETECTED"))
        self.assertFalse(comp["clarix"]["layers"]["hmac_chain"])

    def test_04_all_attack_modes_detected_within_budget(self):
        """All 7 attack modes must be detected by Clarix check_full()."""
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
            self.demo_ctx.integrity.reset_demo()
            self.assertFalse(self.demo_ctx.integrity.is_locked(), f"Reset failed before {atk}")

            # Apply attack
            self.demo_ctx.integrity.demo_tamper(atk)

            # Detect
            ok, reason, evidence = self.demo_ctx.integrity.check_full()
            self.assertFalse(ok, f"Attack {atk} was NOT detected by Clarix!")
            self.assertTrue(self.demo_ctx.integrity.is_locked(), f"Lockdown did not trigger for {atk}")

    def test_05_recovery_validation_and_audit(self):
        """Recovery requires reason >= 20 chars, confirmation phrase, and logs an incident."""
        self.demo_ctx.integrity.reset_demo()
        self.demo_ctx.integrity.demo_tamper("truncate_tail")
        self.demo_ctx.integrity.check_full()
        self.assertTrue(self.demo_ctx.integrity.is_locked())

        # 1. Reason < 20 chars must fail
        with self.assertRaises((ValueError, ApiError)):
            self.demo_ctx.integrity.recover(
                "rebaseline",
                "Short reason 12345",  # 18 chars
                operator="admin",
                confirmation="I CONFIRM REBASELINE OF SECURITY STATE",
            )

        # 2. Wrong confirmation phrase for rebaseline must fail
        with self.assertRaises((ValueError, ApiError)):
            self.demo_ctx.integrity.recover(
                "rebaseline",
                "Security investigation completed, rebaselining state",
                operator="admin",
                confirmation="WRONG CONFIRMATION",
            )

        # 3. Valid recovery >= 20 chars must succeed and unlock
        res = self.demo_ctx.integrity.recover(
            "rebaseline",
            "Security investigation completed; rebaselining verified state for demo",
            operator="admin",
            confirmation="I CONFIRM REBASELINE OF SECURITY STATE",
        )
        self.assertTrue(res["ok"])
        self.assertFalse(self.demo_ctx.integrity.is_locked())

        # Incidents table must record RECOVERY_COMPLETED
        incidents = self.demo_ctx.integrity.incidents()
        types = [inc.get("type") for inc in incidents]
        self.assertIn("RECOVERY_COMPLETED", types)


if __name__ == "__main__":
    unittest.main()
