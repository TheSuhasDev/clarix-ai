"""Tests for Integrity page contract, API responses, and zero-trust verification."""
from __future__ import annotations

import os
import unittest
import tempfile
import shutil
from pathlib import Path
from clarix.config import Settings
from clarix.context import Context

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")


class TestIntegrityUIAndApiContract(unittest.TestCase):
    """Verify backend response shapes and frontend zero-trust integrity contracts."""

    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp(prefix="clarix_integrity_ui_test_")
        self.data_dir = Path(self.tmp_dir) / "data"
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self.settings = Settings(
            data_dir=self.data_dir,
            demo_mode=True,
            integrity_mode="enforce",
        )
        self.ctx = Context(self.settings)
        self.guard = self.ctx.integrity

    def tearDown(self):
        if hasattr(self, 'guard'):
            self.guard.stop()
        if hasattr(self, 'tmp_dir') and os.path.exists(self.tmp_dir):
            shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def test_healthy_ledger_verifies_clean(self):
        """A healthy ledger must show VERIFIED everywhere with NOT_APPLICABLE for legacy."""
        # Reset demo to ensure clean state
        self.guard.reset_demo()

        status = self.guard.get_status()
        self.assertFalse(status["locked"], "Healthy ledger must not be locked")
        self.assertEqual(status["status"], "VERIFIED")

        comp = self.guard.compare_verifiers()
        self.assertEqual(comp["status"], "CLEAN")
        self.assertEqual(comp["clarix"]["status"], "VERIFIED")
        self.assertTrue(comp["clarix"]["ok"])
        self.assertTrue(comp["clarix"]["layers"]["hmac_chain"])
        self.assertTrue(comp["clarix"]["layers"]["external_anchor"])

        # Legacy verifier must report NOT APPLICABLE on a keyed ledger
        self.assertEqual(comp["legacy"]["status"], "NOT_APPLICABLE")
        self.assertIn("NOT APPLICABLE", comp["legacy"]["message"])

    def test_tampered_rehash_shows_clarix_tampered_and_legacy_fooled(self):
        """After a smart rehash attack, legacy must be fooled (CLEAN/VALID) while Clarix detects and locks down."""
        self.guard.reset_demo()

        # Execute edit_row_and_rehash (smart adversary)
        self.guard.demo_tamper("edit_row_and_rehash")

        # Clarix full check must catch it and lock down
        ok, reason, evidence = self.guard.check_full()
        self.assertFalse(ok)
        self.assertTrue(self.guard.is_locked())

        comp = self.guard.compare_verifiers()
        self.assertEqual(comp["status"], "TAMPER_DETECTED")
        self.assertEqual(comp["legacy"]["status"], "VALID")
        self.assertEqual(comp["legacy"]["message"], "CLEAN (fooled)")
        self.assertFalse(comp["clarix"]["ok"])
        self.assertFalse(comp["clarix"]["layers"]["hmac_chain"])
        self.assertTrue(len(comp["clarix"]["evidence"]) > 0, "Evidence of tampering must be provided")

        # Clean up after test
        self.guard.reset_demo()

    def test_frontend_integrity_page_contract(self):
        """Frontend Integrity.tsx must adhere to zero-trust requirements."""
        integrity_path = os.path.join(FRONTEND_DIR, "src", "pages", "Integrity.tsx")
        with open(integrity_path, "r", encoding="utf-8") as f:
            code = f.read()

        # 1. No browser HMAC recomputation
        self.assertNotIn("verifyChain", code, "Browser must never recompute HMAC hashes")

        # 2. Strict statuses
        self.assertIn("VERIFIED", code)
        self.assertIn("TAMPERED", code)
        self.assertIn("CHECKING", code)
        self.assertIn("UNAVAILABLE", code)

        # 3. Legacy labels
        self.assertIn("CLEAN (fooled)", code)
        self.assertIn("NOT APPLICABLE (legacy can't verify a keyed ledger)", code)

        # 4. Wording updates
        self.assertIn("hash chain", code)
        self.assertNotIn("Merkle root", code)
        self.assertIn("HMAC(key, prevHash + event)", code)
        self.assertNotIn("hash(prevHash + payload)", code)
        self.assertNotIn("Web Crypto API (SubtleCrypto)", code)

        # 5. Tamper guide step 4 wording
        self.assertIn("Review side-by-side comparison above", code)


if __name__ == "__main__":
    unittest.main()
