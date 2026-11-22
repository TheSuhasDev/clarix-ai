"""Tests for real-data Network Monitor, IP classification, and Host Egress Watch."""
from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock, patch

from clarix.config import Settings
from clarix.context import Context
from clarix.netmon import NetworkMonitor, classify_ip


class TestIPClassification(unittest.TestCase):
    def test_loopback_classification(self):
        self.assertEqual(classify_ip("127.0.0.1"), "LOOPBACK")
        self.assertEqual(classify_ip("127.0.0.53"), "LOOPBACK")
        self.assertEqual(classify_ip("::1"), "LOOPBACK")
        self.assertEqual(classify_ip("localhost"), "LOOPBACK")

    def test_lan_classification(self):
        self.assertEqual(classify_ip("192.168.1.1"), "LAN")
        self.assertEqual(classify_ip("10.0.0.15"), "LAN")
        self.assertEqual(classify_ip("172.16.5.10"), "LAN")
        self.assertEqual(classify_ip("169.254.1.1"), "LAN")

    def test_external_classification(self):
        self.assertEqual(classify_ip("1.1.1.1"), "EXTERNAL")
        self.assertEqual(classify_ip("8.8.8.8"), "EXTERNAL")
        self.assertEqual(classify_ip("142.250.190.46"), "EXTERNAL")

    def test_empty_or_special(self):
        self.assertEqual(classify_ip("0.0.0.0"), "ALL")
        self.assertEqual(classify_ip(""), "ALL")


class TestNetworkMonitor(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        s = Settings.from_env()
        # Ensure clean state before tests
        for p in [s.data_dir / "lockdown.json", s.data_dir / "demo" / "lockdown.json"]:
            if p.exists():
                try:
                    p.unlink()
                except Exception:
                    pass
        cls.ctx = Context(s, install_guard=False)
        cls.ctx.start()
        cls.netmon = cls.ctx.netmon

    def setUp(self):
        # Ensure lockdown file is clean for egress watch tests
        for p in [self.ctx.settings.data_dir / "lockdown.json", self.ctx.settings.data_dir / "demo" / "lockdown.json"]:
            if p.exists():
                try:
                    p.unlink()
                except Exception:
                    pass

    @classmethod
    def tearDownClass(cls):
        cls.ctx.close()

    def test_get_interfaces(self):
        nics = self.netmon.get_interfaces()
        self.assertIsInstance(nics, list)
        self.assertGreater(len(nics), 0)
        nic = nics[0]
        self.assertIn("name", nic)
        self.assertIn("ipv4", nic)
        self.assertIn("mac", nic)
        self.assertIn("isUp", nic)

    def test_get_traffic(self):
        traffic = self.netmon.get_traffic(window_seconds=30)
        self.assertIn("series", traffic)
        self.assertIn("rates", traffic)
        self.assertIn("windowSeconds", traffic)
        self.assertIsInstance(traffic["series"], list)

    def test_get_connections(self):
        conns = self.netmon.get_connections(scope="all")
        self.assertIsInstance(conns, list)
        if conns:
            c = conns[0]
            self.assertIn("type", c)
            self.assertIn("localAddress", c)
            self.assertIn("scope", c)
            self.assertIn("isClarix", c)
            # Ensure no leaked sensitive keys
            self.assertNotIn("environ", c)
            self.assertNotIn("cmdline", c)

    def test_get_listeners(self):
        listeners = self.netmon.get_listeners()
        self.assertIsInstance(listeners, list)
        for l in listeners:
            self.assertIn("port", l)
            self.assertIn("ip", l)
            self.assertIn("isExposed", l)

    def test_get_services(self):
        svcs = self.netmon.get_services()
        self.assertIn("services", svcs)
        self.assertIn("links", svcs)
        names = [s["name"] for s in svcs["services"]]
        self.assertIn("Clarix Backend API", names)
        self.assertIn("Vite Dev Server", names)
        self.assertIn("Ollama LLM Engine", names)

    def test_get_posture(self):
        posture = self.netmon.get_posture()
        self.assertIn("status", posture)
        self.assertIn(posture["status"], ("ISOLATED", "NOT_ISOLATED"))
        self.assertIn("reasons", posture)
        self.assertIn("clarixExternalConnections", posture)

    def test_get_overview(self):
        ov = self.netmon.get_overview()
        self.assertIn("posture", ov)
        self.assertIn("interfacesTotal", ov)
        self.assertIn("externalConnections", ov)
        self.assertIn("exposedListeners", ov)
        self.assertIn("blockedAttemptsToday", ov)

    def test_get_blocked_connections(self):
        res = self.netmon.get_blocked_connections(limit=10, offset=0)
        self.assertIn("total", res)
        self.assertIn("items", res)
        self.assertIsInstance(res["items"], list)

    def test_get_network_map(self):
        nmap = self.netmon.get_network_map()
        self.assertIn("nodes", nmap)
        self.assertIn("edges", nmap)
        self.assertIn("posture", nmap)
        self.assertIsInstance(nmap["nodes"], list)
        self.assertIsInstance(nmap["edges"], list)
        node_ids = [n["id"] for n in nmap["nodes"]]
        self.assertIn("backend", node_ids)
        self.assertIn("frontend", node_ids)
        self.assertIn("ollama", node_ids)
        self.assertIn("outside_world", node_ids)

    def test_host_egress_watch_warn_mode(self):
        """Host egress detection in warn mode logs audit event without lockdown."""
        with patch.dict(os.environ, {"CLARIX_EGRESS_WATCH_MODE": "warn"}):
            self.netmon._egress_mode = "warn"
            with patch.object(self.netmon, "_get_clarix_pids", return_value={99999}):
                fake_conn = MagicMock()
                fake_conn.pid = 99999
                fake_conn.status = "ESTABLISHED"
                fake_conn.laddr = MagicMock(ip="127.0.0.1", port=54321)
                fake_conn.raddr = MagicMock(ip="1.1.1.1", port=443)
                fake_conn.type = 1

                with patch("clarix.netmon.psutil.net_connections", return_value=[fake_conn]):
                    self.netmon._last_audit_events.clear()
                    self.netmon._check_host_egress()
                    # An alert should have been logged
                    self.assertIn("99999:1.1.1.1:443", self.netmon._last_audit_events)
                    self.assertFalse(self.ctx.integrity.is_locked())


if __name__ == "__main__":
    unittest.main()
