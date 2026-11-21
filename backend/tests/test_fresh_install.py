"""Tests for --fresh-install command in Clarix AI."""

import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

from clarix.__main__ import FRESH_INSTALL_CONFIRMATION, perform_fresh_install
from clarix.audit import AuditLog
from clarix.config import Settings
from clarix.db import Database


class TestFreshInstall(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp(prefix="clarix_fresh_install_test_")
        self.data_dir = Path(self.tmp_dir) / "data"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.settings = Settings(data_dir=self.data_dir, demo_mode=False)

    def tearDown(self):
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def test_01_refuses_without_confirmation(self):
        """Must fail if confirmation phrase does not match exactly."""
        rc = perform_fresh_install(self.settings, confirmation=None)
        self.assertEqual(rc, 1)

        rc2 = perform_fresh_install(self.settings, confirmation="wrong phrase")
        self.assertEqual(rc2, 1)

    def test_02_refuses_under_lockdown(self):
        """Must refuse fresh install if fail-closed lockdown is active."""
        lockdown_file = self.data_dir / "lockdown.json"
        lockdown_file.write_text(json.dumps({"reason": "Tamper detected", "evidence": "Trigger dropped"}))

        rc = perform_fresh_install(self.settings, confirmation=FRESH_INSTALL_CONFIRMATION)
        self.assertEqual(rc, 1)

    def test_03_archives_existing_data_and_creates_clean_ledger(self):
        """Archives existing files, generates fresh key & anchor, commits 1 SYSTEM_INSTALL event."""
        # Create dummy existing files
        old_db = self.data_dir / "clarix.db"
        old_db.write_text("old_db_content")
        old_key = self.data_dir / "audit.key"
        old_key.write_text("old_key_content")
        old_anchor = self.data_dir / "audit_anchor.json"
        old_anchor.write_text("old_anchor_content")

        rc = perform_fresh_install(self.settings, confirmation=FRESH_INSTALL_CONFIRMATION)
        self.assertEqual(rc, 0)

        # 1. Verify archive exists and contains old files
        archive_root = self.data_dir / "archive"
        self.assertTrue(archive_root.is_dir())
        archives = list(archive_root.iterdir())
        self.assertGreaterEqual(len(archives), 1)
        latest_archive = sorted(archives)[-1]
        self.assertTrue((latest_archive / "clarix.db").is_file())
        self.assertEqual((latest_archive / "clarix.db").read_text(), "old_db_content")

        # 2. Verify fresh production files exist
        db_path = self.data_dir / "clarix.db"
        key_path = self.data_dir / "audit.key"
        anchor_path = self.data_dir / "audit_anchor.json"
        self.assertTrue(db_path.is_file())
        self.assertTrue(key_path.is_file())
        self.assertTrue(anchor_path.is_file())

        # 3. Verify exactly 1 SYSTEM_INSTALL event in fresh ledger
        db = Database(db_path)
        audit = AuditLog(db)
        key = bytes.fromhex(key_path.read_text().strip())
        audit.init_keyed(key)
        self.assertEqual(audit.count(), 1)

        events = audit.list()
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["action"], "SYSTEM_INSTALL")
        self.assertEqual(events[0]["user"], "system")
        self.assertEqual(events[0]["decision"], "ALLOW")

        # 4. Verify chain integrity
        v = audit.verify()
        self.assertTrue(v["ok"])

        # 5. Verify anchor matches head
        h = audit.head()
        anchor_data = json.loads(anchor_path.read_text())
        self.assertEqual(anchor_data["count"], 1)
        self.assertEqual(anchor_data["head_hash"], h["hash"])


if __name__ == "__main__":
    unittest.main()
