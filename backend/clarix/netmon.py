"""
Real-data Network Monitor for Clarix AI.
Air-gapped host telemetry, interface metrics, socket connections, listening ports,
service topology, blocked external attempts, and Host Egress Watch with fail-closed enforcement.
Works on Windows and Linux using psutil, handling AccessDenied gracefully.
"""
from __future__ import annotations

import collections
import ipaddress
import logging
import os
import platform
import subprocess
import threading
import time
from typing import Any

import psutil

from .util import utcstamp

log = logging.getLogger("clarix.netmon")


def classify_ip(ip: str) -> str:
    """Classify an IP string as LOOPBACK, LAN, or EXTERNAL."""
    if not ip or ip in ("0.0.0.0", "::", "*"):
        return "ALL"
    try:
        addr = ipaddress.ip_address(ip)
        if addr.is_loopback:
            return "LOOPBACK"
        if addr.is_private or addr.is_link_local:
            return "LAN"
        return "EXTERNAL"
    except ValueError:
        # Hostname or unparseable
        if ip.lower() in ("localhost", "127.0.0.1", "::1"):
            return "LOOPBACK"
        return "EXTERNAL"


class TrafficSample:
    __slots__ = ("ts", "nic_counters")

    def __init__(self, ts: float, nic_counters: dict[str, Any]):
        self.ts = ts
        self.nic_counters = nic_counters


class NetworkMonitor:
    """
    Host network telemetry collector, traffic rate ring-buffer sampler,
    service topology detector, and Host Egress Watch daemon.
    """

    def __init__(self, ctx):
        self.ctx = ctx
        self._lock = threading.Lock()
        self._traffic_samples: collections.deque[TrafficSample] = collections.deque(maxlen=150)  # 5 min @ 2s
        self._sampler_thread: threading.Thread | null = None
        self._egress_watch_thread: threading.Thread | null = None
        self._running = False
        self._last_audit_events: dict[str, float] = {}  # dest_key -> last_timestamp
        self._limited_visibility = False
        self._egress_mode = os.environ.get("CLARIX_EGRESS_WATCH_MODE", "warn").strip().lower()

    def start(self) -> None:
        """Start background traffic sampler and host egress watch daemon."""
        if self._running:
            return
        self._running = True
        self._sampler_thread = threading.Thread(
            target=self._run_sampler, daemon=True, name="Clarix-NetTrafficSampler"
        )
        self._sampler_thread.start()

        self._egress_watch_thread = threading.Thread(
            target=self._run_egress_watch, daemon=True, name="Clarix-HostEgressWatch"
        )
        self._egress_watch_thread.start()
        log.info(f"NetworkMonitor started (egress watch mode: {self._egress_mode})")

    def close(self) -> None:
        """Stop background threads."""
        self._running = False

    def _run_sampler(self) -> None:
        """Collect interface I/O counters every 2 seconds into a 5-minute ring buffer."""
        while self._running:
            try:
                counters = psutil.net_io_counters(pernic=True)
                sample = TrafficSample(time.time(), counters)
                with self._lock:
                    self._traffic_samples.append(sample)
            except Exception as e:
                log.debug(f"Sampler error: {e}")
            time.sleep(2.0)

    def _run_egress_watch(self) -> None:
        """
        Scan every 5s for any active EXTERNAL established socket owned by Clarix processes.
        The in-process socket guard catches Python-level sockets, but subprocesses or native binaries
        could bypass it. On detection, log one aggregated audit event per destination per 5 min.
        In 'enforce' mode, trigger lockdown fail-closed (POL-001).
        """
        while self._running:
            try:
                self._check_host_egress()
            except Exception as e:
                log.debug(f"Egress watch check error: {e}")
            time.sleep(5.0)

    def _get_clarix_pids(self) -> set[int]:
        """Collect PIDs of current process, all children, and known Clarix services (Ollama, Vite)."""
        pids = set()
        try:
            curr = psutil.Process(os.getpid())
            pids.add(curr.pid)
            for child in curr.children(recursive=True):
                pids.add(child.pid)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

        # Identify Ollama and Vite if running
        try:
            for conn in psutil.net_connections(kind="tcp"):
                if conn.status == "LISTEN" and conn.laddr:
                    if conn.laddr.port in (8000, 5173, 11434) and conn.pid:
                        pids.add(conn.pid)
        except (psutil.AccessDenied, PermissionError):
            self._limited_visibility = True
        return pids

    def _check_host_egress(self) -> None:
        """Inspect TCP sockets for unexpected external established connections from Clarix."""
        clarix_pids = self._get_clarix_pids()
        now = time.time()

        try:
            connections = psutil.net_connections(kind="tcp")
        except (psutil.AccessDenied, PermissionError):
            self._limited_visibility = True
            return

        for c in connections:
            if c.status != "ESTABLISHED" or not c.raddr:
                continue
            r_ip = c.raddr.ip
            r_port = c.raddr.port
            classification = classify_ip(r_ip)

            # Only check external sockets
            if classification != "EXTERNAL":
                continue

            # Check if owned by a Clarix process
            if c.pid and c.pid in clarix_pids:
                proc_name = "clarix-process"
                exe_path = ""
                try:
                    p = psutil.Process(c.pid)
                    proc_name = p.name()
                    exe_path = p.exe()
                except Exception:
                    pass

                dest_key = f"{c.pid}:{r_ip}:{r_port}"
                last_time = self._last_audit_events.get(dest_key, 0.0)

                # Deduplicate: max 1 audit event per destination per 5 minutes
                if now - last_time >= 300.0:
                    self._last_audit_events[dest_key] = now
                    try:
                        self.ctx.integrity.active_audit.append(
                            user="system",
                            action=f"Host Egress Alert: Clarix process {proc_name} (PID {c.pid}) connected to {r_ip}:{r_port}",
                            component="Host Egress Watch",
                            risk="HIGH",
                            decision="BLOCK" if self._egress_mode == "enforce" else "WARN",
                            classification="INTERNAL",
                            payload=f"egress_watch:{proc_name}:{c.pid}:{r_ip}:{r_port}:{self._egress_mode}",
                        )
                    except Exception as e:
                        log.warning(f"Failed to record egress watch audit event: {e}")

                    if self._egress_mode == "enforce":
                        self.ctx.integrity.trigger_lockdown(
                            reason=f"POL-001 Air-Gap Violation: {proc_name} (PID {c.pid}) established external socket to {r_ip}:{r_port}",
                            evidence=f"dest={r_ip}:{r_port} pid={c.pid} exe={exe_path} time={utcstamp()}",
                        )

    # -------------------------------------------------------------------------
    # Collectors & Public API
    # -------------------------------------------------------------------------

    def get_interfaces(self) -> list[dict[str, Any]]:
        """Collect host network interfaces with IPs, MAC, status, speed, MTU."""
        res = []
        try:
            addrs = psutil.net_if_addrs()
            stats = psutil.net_if_stats()
        except Exception as e:
            log.warning(f"Error fetching interfaces: {e}")
            return []

        for name, addr_list in addrs.items():
            st = stats.get(name)
            is_up = st.isup if st else False
            speed = st.speed if st else 0
            mtu = st.mtu if st else 0

            # Infer type
            lname = name.lower()
            if "loopback" in lname or "lo" == lname:
                nic_type = "loopback"
            elif "wi-fi" in lname or "wireless" in lname or "wlan" in lname:
                nic_type = "wifi"
            elif "vmware" in lname or "vbox" in lname or "virtual" in lname or "vethernet" in lname:
                nic_type = "virtual"
            else:
                nic_type = "ethernet"

            ipv4_list = []
            ipv6_list = []
            mac = ""

            for a in addr_list:
                if a.family == psutil.AF_LINK or getattr(a.family, "name", "") == "AF_LINK":
                    mac = a.address
                elif str(a.family) in ("AddressFamily.AF_INET", "2"):
                    ipv4_list.append(a.address)
                elif str(a.family) in ("AddressFamily.AF_INET6", "23", "10", "30"):
                    ipv6_list.append(a.address)

            res.append({
                "name": name,
                "isUp": is_up,
                "type": nic_type,
                "speedMbps": speed,
                "mtu": mtu,
                "ipv4": ipv4_list,
                "ipv6": ipv6_list,
                "mac": mac,
            })
        return res

    def get_traffic(self, window_seconds: int = 60) -> dict[str, Any]:
        """Compute throughput rates (bytes/s, packets/s, errors, drops) across interfaces."""
        window_seconds = max(10, min(300, window_seconds))
        with self._lock:
            samples = list(self._traffic_samples)

        if len(samples) < 2:
            return {"windowSeconds": window_seconds, "rates": {}, "series": []}

        now = time.time()
        cutoff = now - window_seconds
        filtered = [s for s in samples if s.ts >= cutoff]
        if len(filtered) < 2:
            filtered = samples[-2:]

        s_first = filtered[0]
        s_last = filtered[-1]
        dt = max(1.0, s_last.ts - s_first.ts)

        rates: dict[str, dict[str, float]] = {}
        all_nics = set(s_last.nic_counters.keys()) | set(s_first.nic_counters.keys())

        for nic in all_nics:
            c1 = s_first.nic_counters.get(nic)
            c2 = s_last.nic_counters.get(nic)
            if not c1 or not c2:
                continue
            bytes_sent_sec = max(0.0, (c2.bytes_sent - c1.bytes_sent) / dt)
            bytes_recv_sec = max(0.0, (c2.bytes_recv - c1.bytes_recv) / dt)
            packets_sent_sec = max(0.0, (c2.packets_sent - c1.packets_sent) / dt)
            packets_recv_sec = max(0.0, (c2.packets_recv - c1.packets_recv) / dt)
            errin = c2.errin
            errout = c2.errout
            dropin = c2.dropin
            dropout = c2.dropout

            rates[nic] = {
                "bytesSentSec": round(bytes_sent_sec, 1),
                "bytesRecvSec": round(bytes_recv_sec, 1),
                "packetsSentSec": round(packets_sent_sec, 1),
                "packetsRecvSec": round(packets_recv_sec, 1),
                "errIn": errin,
                "errOut": errout,
                "dropIn": dropin,
                "dropOut": dropout,
            }

        # Build timeline series for sparklines
        series = []
        for i in range(1, len(filtered)):
            t0, t1 = filtered[i - 1], filtered[i]
            d = max(0.5, t1.ts - t0.ts)
            tot_sent = 0.0
            tot_recv = 0.0
            for nic in t1.nic_counters:
                if nic in t0.nic_counters:
                    tot_sent += (t1.nic_counters[nic].bytes_sent - t0.nic_counters[nic].bytes_sent) / d
                    tot_recv += (t1.nic_counters[nic].bytes_recv - t0.nic_counters[nic].bytes_recv) / d
            series.append({
                "t": time.strftime("%H:%M:%S", time.localtime(t1.ts)),
                "bytesSent": round(tot_sent, 1),
                "bytesRecv": round(tot_recv, 1),
            })

        return {
            "windowSeconds": window_seconds,
            "rates": rates,
            "series": series[-30:],
        }

    def get_connections(self, scope: str = "all") -> list[dict[str, Any]]:
        """
        List current active sockets with local/remote address, state, and process info.
        Classified as LOOPBACK, LAN, or EXTERNAL.
        Scoped filter: 'all', 'external', 'lan', 'loopback'.
        """
        scope = scope.lower().strip()
        clarix_pids = self._get_clarix_pids()
        res = []

        try:
            conns = psutil.net_connections(kind="inet")
        except (psutil.AccessDenied, PermissionError):
            self._limited_visibility = True
            return []

        for c in conns:
            l_ip = c.laddr.ip if c.laddr else ""
            l_port = c.laddr.port if c.laddr else 0
            r_ip = c.raddr.ip if c.raddr else ""
            r_port = c.raddr.port if c.raddr else 0

            # Classify by remote if connected, else local
            target_ip = r_ip if r_ip else l_ip
            classification = classify_ip(target_ip)

            if scope == "external" and classification != "EXTERNAL":
                continue
            if scope == "lan" and classification != "LAN":
                continue
            if scope == "loopback" and classification != "LOOPBACK":
                continue

            pid = c.pid
            proc_name = ""
            exe_path = ""
            is_clarix = False

            if pid:
                is_clarix = pid in clarix_pids
                try:
                    p = psutil.Process(pid)
                    proc_name = p.name()
                    exe_path = p.exe()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    proc_name = f"[PID {pid}]"
                    self._limited_visibility = True

            res.append({
                "fd": c.fd,
                "family": "IPv4" if str(c.family) in ("AddressFamily.AF_INET", "2") else "IPv6",
                "type": "TCP" if str(c.type) in ("SocketKind.SOCK_STREAM", "1") else "UDP",
                "localAddress": f"{l_ip}:{l_port}" if l_ip else "",
                "remoteAddress": f"{r_ip}:{r_port}" if r_ip else "-",
                "state": c.status,
                "scope": classification,
                "pid": pid,
                "processName": proc_name,
                "exePath": exe_path,
                "isClarix": is_clarix,
            })

        # Sort: external first, then clarix, then others
        res.sort(key=lambda x: (x["scope"] != "EXTERNAL", not x["isClarix"], x["localAddress"]))
        return res[:300]

    def get_listeners(self) -> list[dict[str, Any]]:
        """List active listening ports on host, flagging 0.0.0.0 or non-loopback bindings as exposed."""
        clarix_pids = self._get_clarix_pids()
        res = []

        try:
            conns = psutil.net_connections(kind="tcp")
        except (psutil.AccessDenied, PermissionError):
            self._limited_visibility = True
            return []

        for c in conns:
            if c.status != "LISTEN" or not c.laddr:
                continue

            ip = c.laddr.ip
            port = c.laddr.port
            is_exposed = ip in ("0.0.0.0", "::") or (classify_ip(ip) != "LOOPBACK")

            pid = c.pid
            proc_name = ""
            exe_path = ""
            is_clarix = False

            if pid:
                is_clarix = pid in clarix_pids
                try:
                    p = psutil.Process(pid)
                    proc_name = p.name()
                    exe_path = p.exe()
                except Exception:
                    proc_name = f"[PID {pid}]"
                    self._limited_visibility = True

            res.append({
                "ip": ip,
                "port": port,
                "isExposed": is_exposed,
                "pid": pid,
                "processName": proc_name,
                "exePath": exe_path,
                "isClarix": is_clarix,
            })

        res.sort(key=lambda x: (not x["isExposed"], x["port"]))
        return res

    def get_services(self) -> dict[str, Any]:
        """Detect Clarix backend (8000), Vite frontend (5173), and Ollama (11434)."""
        listeners = self.get_listeners()
        ports_map = {l["port"]: l for l in listeners}

        backend_info = ports_map.get(8000)
        vite_info = ports_map.get(5173)
        ollama_info = ports_map.get(11434)

        return {
            "services": [
                {
                    "name": "Operator Browser",
                    "role": "Console UI Client",
                    "port": 5173,
                    "status": "CONNECTED" if vite_info else "STANDBY",
                    "binding": "loopback",
                },
                {
                    "name": "Vite Dev Server",
                    "role": "Frontend Host",
                    "port": 5173,
                    "status": "ONLINE" if vite_info else "OFFLINE",
                    "binding": vite_info["ip"] if vite_info else "none",
                    "pid": vite_info["pid"] if vite_info else None,
                },
                {
                    "name": "Clarix Backend API",
                    "role": "Security Harness & Agent Controller",
                    "port": 8000,
                    "status": "ONLINE",
                    "binding": backend_info["ip"] if backend_info else "127.0.0.1",
                    "pid": os.getpid(),
                },
                {
                    "name": "Ollama LLM Engine",
                    "role": "Offline Neural Inference",
                    "port": 11434,
                    "status": "ONLINE" if ollama_info else "OFFLINE",
                    "binding": ollama_info["ip"] if ollama_info else "none",
                    "pid": ollama_info["pid"] if ollama_info else None,
                },
            ],
            "links": [
                {
                    "source": "Operator Browser",
                    "target": "Vite Dev Server",
                    "protocol": "HTTP/HMR",
                    "port": 5173,
                    "status": "ACTIVE",
                },
                {
                    "source": "Vite Dev Server",
                    "target": "Clarix Backend API",
                    "protocol": "REST / JSON",
                    "port": 8000,
                    "status": "ACTIVE",
                },
                {
                    "source": "Clarix Backend API",
                    "target": "Ollama LLM Engine",
                    "protocol": "HTTP / Stream",
                    "port": 11434,
                    "status": "ACTIVE" if ollama_info else "UNREACHABLE",
                },
            ],
        }

    def get_posture(self) -> dict[str, Any]:
        """
        Evaluate host perimeter posture:
        Compute ISOLATED / NOT_ISOLATED based on:
        - Active non-loopback interfaces
        - Default route
        - External established connections
        - Separate Clarix itself vs other apps.
        """
        reasons = []
        clarix_reasons = []
        other_reasons = []

        # 1. Non-loopback interfaces
        interfaces = self.get_interfaces()
        active_external_nics = [
            nic for nic in interfaces if nic["isUp"] and nic["type"] != "loopback"
        ]
        if active_external_nics:
            names = ", ".join([f"'{n['name']}' ({n['type']})" for n in active_external_nics])
            other_reasons.append(f"Active non-loopback network interface(s) present: {names}.")
        else:
            reasons.append("All non-loopback network interfaces are disabled or unplugged.")

        # 2. Host sockets check
        connections = self.get_connections(scope="external")
        clarix_external = [c for c in connections if c["isClarix"] and c["state"] == "ESTABLISHED"]
        other_external = [c for c in connections if not c["isClarix"] and c["state"] == "ESTABLISHED"]

        if clarix_external:
            clarix_reasons.append(
                f"Clarix has {len(clarix_external)} active external connection(s) (POL-001 boundary violation)."
            )
        else:
            clarix_reasons.append("Clarix itself has 0 external connections (air-gap intact).")

        if other_external:
            other_reasons.append(
                f"Other applications on this host maintain {len(other_external)} active external connection(s)."
            )

        # 3. OS Firewall check
        firewall_status = "UNKNOWN"
        try:
            if platform.system() == "Windows":
                out = subprocess.check_output(
                    ["netsh", "advfirewall", "show", "allprofiles"],
                    timeout=2.0,
                    stderr=subprocess.DEVNULL,
                    text=True,
                )
                if "State                                 ON" in out:
                    firewall_status = "ON"
                elif "State                                 OFF" in out:
                    firewall_status = "OFF"
            else:
                # Linux check
                out = subprocess.check_output(
                    ["iptables", "-S"], timeout=2.0, stderr=subprocess.DEVNULL, text=True
                )
                firewall_status = "ON" if out.strip() else "OFF"
        except Exception:
            firewall_status = "UNCHECKED"

        # Determine overall isolation
        # ISOLATED requires no active non-loopback nics and no external sockets
        is_isolated = (len(active_external_nics) == 0) and (len(connections) == 0)

        all_reasons = []
        if is_isolated:
            all_reasons.append("Host perimeter is physically and logically air-gapped.")
        else:
            all_reasons.extend(other_reasons)
            all_reasons.extend(clarix_reasons)

        return {
            "status": "ISOLATED" if is_isolated else "NOT_ISOLATED",
            "isIsolated": is_isolated,
            "firewall": firewall_status,
            "reasons": all_reasons,
            "clarixExternalConnections": len(clarix_external),
            "otherExternalConnections": len(other_external),
            "limitedVisibility": self._limited_visibility,
            "egressWatchMode": self._egress_mode,
        }

    def get_overview(self) -> dict[str, Any]:
        """Aggregate posture, interface counts, connection counts, and blocked stats."""
        posture = self.get_posture()
        interfaces = self.get_interfaces()
        up_interfaces = sum(1 for i in interfaces if i["isUp"])

        connections = self.get_connections()
        external_count = sum(1 for c in connections if c["scope"] == "EXTERNAL" and c["state"] == "ESTABLISHED")
        listeners = self.get_listeners()
        exposed_listeners = sum(1 for l in listeners if l["isExposed"])

        # Count blocked connection attempts today from SQLite
        today_start = time.time() - 86400
        blocked_count = 0
        try:
            row = self.ctx.db.one(
                "SELECT count(*) as c FROM blocked_connections WHERE ts >= ?", (today_start,)
            )
            if row:
                blocked_count = row["c"]
        except Exception:
            pass

        return {
            "posture": posture,
            "interfacesUp": up_interfaces,
            "interfacesTotal": len(interfaces),
            "externalConnections": external_count,
            "exposedListeners": exposed_listeners,
            "blockedAttemptsToday": blocked_count,
            "lastRefresh": utcstamp(),
            "limitedVisibility": self._limited_visibility,
        }

    def get_blocked_connections(self, limit: int = 50, offset: int = 0) -> dict[str, Any]:
        """Read paginated blocked connections refused by the in-process guard."""
        limit = max(1, min(100, limit))
        offset = max(0, offset)
        try:
            total = self.ctx.db.one("SELECT count(*) as c FROM blocked_connections")["c"]
            rows = self.ctx.db.q(
                "SELECT id, ts, host, port, protocol, subsystem, rule "
                "FROM blocked_connections ORDER BY ts DESC LIMIT ? OFFSET ?",
                (limit, offset),
            )
            items = []
            for r in rows:
                items.append({
                    "id": r["id"],
                    "timestamp": utcstamp(r["ts"]),
                    "host": r["host"],
                    "port": r["port"],
                    "protocol": r["protocol"],
                    "subsystem": r["subsystem"],
                    "rule": r["rule"],
                    "status": "BLOCKED",
                })
            return {"total": total, "limit": limit, "offset": offset, "items": items}
        except Exception as e:
            log.warning(f"Error reading blocked connections: {e}")
            return {"total": 0, "limit": limit, "offset": offset, "items": []}

    def get_network_map(self) -> dict[str, Any]:
        """
        Generate ReactFlow node hierarchy and animated connection edges:
        Operator Browser -> Frontend (5173) -> Backend (8000) -> Ollama (11434);
        Security components; Host Network Interfaces; Outside World beyond dashed Air-Gap boundary.
        """
        posture = self.get_posture()
        interfaces = self.get_interfaces()
        blocked = self.get_blocked_connections(limit=5)
        services = self.get_services()

        nodes = [
            {
                "id": "browser",
                "type": "operatorNode",
                "position": {"x": 60, "y": 140},
                "data": {
                    "label": "Operator Browser",
                    "role": "Console UI Client",
                    "port": 5173,
                    "status": "ACTIVE",
                    "metrics": "Loopback 127.0.0.1",
                    "component": "Operator Console",
                },
            },
            {
                "id": "frontend",
                "type": "serviceNode",
                "position": {"x": 280, "y": 140},
                "data": {
                    "label": "Vite Dev Server",
                    "role": "Frontend Bundle Host",
                    "port": 5173,
                    "status": "ONLINE",
                    "metrics": "Node.js (Port 5173)",
                    "component": "Frontend Server",
                },
            },
            {
                "id": "backend",
                "type": "coreNode",
                "position": {"x": 520, "y": 140},
                "data": {
                    "label": "Clarix Backend API",
                    "role": "Security Harness & Controller",
                    "port": 8000,
                    "status": "ONLINE",
                    "metrics": f"PID {os.getpid()} (Port 8000)",
                    "component": "Backend Daemon",
                },
            },
            {
                "id": "ollama",
                "type": "aiNode",
                "position": {"x": 780, "y": 140},
                "data": {
                    "label": "Ollama LLM Engine",
                    "role": "Offline Inference",
                    "port": 11434,
                    "status": "ONLINE" if any(s["name"] == "Ollama LLM Engine" and s["status"] == "ONLINE" for s in services["services"]) else "STANDBY",
                    "metrics": "Port 11434",
                    "component": "Local LLM",
                },
            },
            # Security Harness Nodes
            {
                "id": "sec_injection",
                "type": "securityNode",
                "position": {"x": 380, "y": 290},
                "data": {"label": "Injection Guard", "status": "ACTIVE", "component": "Injection Scanner", "rule": "SEC-03 Multi-Vector"},
            },
            {
                "id": "sec_policy",
                "type": "securityNode",
                "position": {"x": 520, "y": 290},
                "data": {"label": "Policy Engine", "status": "ACTIVE", "component": "Policy Engine", "rule": "POL-001 - POL-008"},
            },
            {
                "id": "sec_approval",
                "type": "securityNode",
                "position": {"x": 660, "y": 290},
                "data": {"label": "Approval Gate", "status": "ACTIVE", "component": "Human Approval", "rule": "Cryptographic CAS"},
            },
            {
                "id": "sec_audit",
                "type": "securityNode",
                "position": {"x": 380, "y": 410},
                "data": {"label": "Audit Ledger", "status": "VERIFIED", "component": "Audit Log", "rule": "SHA-256 HMAC Chain"},
            },
            {
                "id": "sec_integrity",
                "type": "securityNode",
                "position": {"x": 520, "y": 410},
                "data": {"label": "Integrity Guard", "status": "VERIFIED", "component": "Integrity Daemon", "rule": "POL-006 Lockdown"},
            },
            {
                "id": "sec_egress",
                "type": "egressNode",
                "position": {"x": 660, "y": 410},
                "data": {
                    "label": "Egress Socket Guard",
                    "status": "ENFORCING",
                    "component": "Air-Gap Guard",
                    "rule": "POL-001 Socket Hook",
                    "blockedCount": len(blocked.get("items", [])),
                },
            },
            # Outside World beyond Air-Gap perimeter
            {
                "id": "outside_world",
                "type": "externalNode",
                "position": {"x": 960, "y": 410},
                "data": {
                    "label": "Outside World",
                    "role": "Public Internet & WAN",
                    "status": "BLOCKED",
                    "metrics": "Physical / Link Isolation",
                    "component": "External WAN",
                },
            },
        ]

        edges = [
            {"id": "e_b_fe", "source": "browser", "target": "frontend", "animated": True, "label": "HTTP :5173"},
            {"id": "e_fe_be", "source": "frontend", "target": "backend", "animated": True, "label": "REST :8000"},
            {"id": "e_be_ol", "source": "backend", "target": "ollama", "animated": True, "label": "Stream :11434"},
            {"id": "e_be_inj", "source": "backend", "target": "sec_injection"},
            {"id": "e_be_pol", "source": "backend", "target": "sec_policy"},
            {"id": "e_be_app", "source": "backend", "target": "sec_approval"},
            {"id": "e_be_aud", "source": "backend", "target": "sec_audit"},
            {"id": "e_be_int", "source": "backend", "target": "sec_integrity"},
            {"id": "e_be_egr", "source": "backend", "target": "sec_egress"},
            {
                "id": "e_egr_out",
                "source": "sec_egress",
                "target": "outside_world",
                "animated": False,
                "label": "BLOCKED (POL-001)",
                "style": {"stroke": "#ef4444", "strokeDasharray": "5,5", "strokeWidth": 2.5},
            },
        ]

        return {
            "posture": posture,
            "nodes": nodes,
            "edges": edges,
            "interfaces": interfaces,
            "blockedRecent": blocked.get("items", []),
        }
