from typing import List, Dict, Any
from .models import Device, InterfaceInfo, TopologyNode, TopologyEdge, TopologyData, Incident, NetworkStatus, FaultDetail

# =========================================================================
# 12 BASE DEVICES
# 1. Firewall FW-001
# 2. Router R1
# 3. Router R2
# 4. Switch SW-001
# 5. Switch SW-002
# 6. Switch SW-003
# 7. Local LLM Server
# 8. Local RAG Server
# 9. Clarix AI Harness
# 10. Admin PC
# 11. Workstation 001
# 12. Workstation 002
# =========================================================================

# Positions optimized for React Flow canvas & mini-map layout:
# Column 1 (x: 40): FW-001 (Air-gap perimeter)
# Column 2 (x: 220): Routers R1 & R2
# Column 3 (x: 420): Switches SW-001, SW-002, SW-003
# Column 4 (x: 640): Endpoints & Server cluster
BASE_NODES_CONFIG = [
    {"id": "FW-001", "label": "Firewall FW-001", "type": "firewall", "ip": "192.168.0.254", "pos": {"x": 40, "y": 200}},
    {"id": "R1", "label": "Router R1", "type": "router", "ip": "192.168.1.1", "pos": {"x": 220, "y": 120}},
    {"id": "R2", "label": "Router R2", "type": "router", "ip": "192.168.2.1", "pos": {"x": 220, "y": 280}},
    {"id": "SW-001", "label": "Switch SW-001", "type": "switch", "ip": "192.168.10.1", "pos": {"x": 420, "y": 70}},
    {"id": "SW-002", "label": "Switch SW-002", "type": "switch", "ip": "192.168.20.1", "pos": {"x": 420, "y": 200}},
    {"id": "SW-003", "label": "Switch SW-003", "type": "switch", "ip": "192.168.30.1", "pos": {"x": 420, "y": 340}},
    {"id": "ADMIN-PC", "label": "Admin PC", "type": "pc", "ip": "192.168.10.100", "pos": {"x": 640, "y": 40}},
    {"id": "WS-001", "label": "Workstation 001", "type": "pc", "ip": "192.168.20.101", "pos": {"x": 640, "y": 150}},
    {"id": "WS-002", "label": "Workstation 002", "type": "pc", "ip": "192.168.20.102", "pos": {"x": 640, "y": 230}},
    {"id": "LLM-SRV", "label": "Local LLM Server", "type": "server", "ip": "192.168.30.10", "pos": {"x": 640, "y": 310}},
    {"id": "RAG-SRV", "label": "Local RAG Server", "type": "server", "ip": "192.168.30.11", "pos": {"x": 640, "y": 390}},
    {"id": "HARNESS", "label": "Clarix AI Harness", "type": "harness", "ip": "192.168.30.12", "pos": {"x": 640, "y": 470}},
]

BASE_EDGES_CONFIG = [
    {"id": "e-fw-r1", "source": "FW-001", "target": "R1"},
    {"id": "e-fw-r2", "source": "FW-001", "target": "R2"},
    {"id": "e-r1-r2", "source": "R1", "target": "R2"},
    {"id": "e-r1-sw1", "source": "R1", "target": "SW-001"},
    {"id": "e-r1-sw2", "source": "R1", "target": "SW-002"},
    {"id": "e-r2-sw3", "source": "R2", "target": "SW-003"},
    {"id": "e-sw1-sw2", "source": "SW-001", "target": "SW-002"},
    {"id": "e-sw1-sw3", "source": "SW-001", "target": "SW-003"},
    {"id": "e-sw1-admin", "source": "SW-001", "target": "ADMIN-PC"},
    {"id": "e-sw2-ws1", "source": "SW-002", "target": "WS-001"},
    {"id": "e-sw2-ws2", "source": "SW-002", "target": "WS-002"},
    {"id": "e-sw3-llm", "source": "SW-003", "target": "LLM-SRV"},
    {"id": "e-sw3-rag", "source": "SW-003", "target": "RAG-SRV"},
    {"id": "e-sw3-harness", "source": "SW-003", "target": "HARNESS"},
]

# =========================================================================
# DEMO 1 — HEALTHY NETWORK DATA
# =========================================================================

DEMO_1_DEVICES: List[Device] = [
    Device(
        id="FW-001",
        hostname="Firewall-FW-001",
        type="firewall",
        ip_address="192.168.0.254",
        status="healthy",
        model="Cisco Firepower 1120 (Air-Gap Secure)",
        location="Security Perimeter",
        uptime="98d 4h 12m",
        os_version="FTD 7.2.4",
        active_alerts=0,
        cpu_usage=18.4,
        memory_usage=32.0,
        role="Air-Gap Boundary & Firewall",
        interfaces=[
            InterfaceInfo(name="Outside-Eth1/1", ip_address="BLOCKED", status="down", duplex="None", speed="0 Mbps", errors=0, packet_loss_pct=0.0),
            InterfaceInfo(name="Inside-Eth1/2", ip_address="192.168.0.254", status="up", duplex="Full", speed="1 Gbps", errors=0, packet_loss_pct=0.0),
        ],
    ),
    Device(
        id="R1",
        hostname="Router-R1",
        type="router",
        ip_address="192.168.1.1",
        status="healthy",
        model="Cisco ISR 4331",
        location="Core Rack A",
        uptime="45d 12h 10m",
        os_version="Cisco IOS XE 17.06.01a",
        active_alerts=0,
        cpu_usage=21.5,
        memory_usage=36.4,
        role="Core Gateway 1",
        interfaces=[
            InterfaceInfo(name="GigabitEthernet0/0", ip_address="192.168.1.1", status="up", vlan=1, speed="1 Gbps", errors=0, packet_loss_pct=0.0),
            InterfaceInfo(name="GigabitEthernet0/1", ip_address="10.0.0.1", status="up", vlan=10, speed="1 Gbps", errors=0, packet_loss_pct=0.0),
        ],
    ),
    Device(
        id="R2",
        hostname="Router-R2",
        type="router",
        ip_address="192.168.2.1",
        status="healthy",
        model="Cisco ISR 4321",
        location="Core Rack B",
        uptime="45d 12h 10m",
        os_version="Cisco IOS XE 17.06.01a",
        active_alerts=0,
        cpu_usage=19.2,
        memory_usage=34.1,
        role="Core Gateway 2 (AI Farm Route)",
        interfaces=[
            InterfaceInfo(name="GigabitEthernet0/0", ip_address="192.168.2.1", status="up", vlan=1, speed="1 Gbps", errors=0, packet_loss_pct=0.0),
            InterfaceInfo(name="GigabitEthernet0/1", ip_address="10.0.0.2", status="up", vlan=10, speed="1 Gbps", errors=0, packet_loss_pct=0.0),
        ],
    ),
    Device(
        id="SW-001",
        hostname="Switch-SW-001",
        type="switch",
        ip_address="192.168.10.1",
        status="healthy",
        model="Cisco Catalyst 9300-48P",
        location="Distribution Rack 1",
        uptime="120d 00h 00m",
        os_version="Cisco IOS XE 17.09.01",
        active_alerts=0,
        cpu_usage=22.0,
        memory_usage=38.0,
        role="Admin & Management Switch",
        interfaces=[
            InterfaceInfo(name="Gi1/0/1", status="up", vlan=1, speed="1 Gbps", errors=0, packet_loss_pct=0.0),
            InterfaceInfo(name="Gi1/0/12", status="up", vlan=10, speed="1 Gbps", errors=0, packet_loss_pct=0.0),
        ],
    ),
    Device(
        id="SW-002",
        hostname="Switch-SW-002",
        type="switch",
        ip_address="192.168.20.1",
        status="healthy",
        model="Cisco Catalyst 2960-X",
        location="Floor Access Rack",
        uptime="85d 02h 30m",
        os_version="Cisco IOS 15.2(7)E",
        active_alerts=0,
        cpu_usage=16.4,
        memory_usage=28.5,
        role="Workstation Edge Switch",
        interfaces=[
            InterfaceInfo(name="Gi0/1", status="up", vlan=20, speed="1 Gbps", errors=0, packet_loss_pct=0.0),
            InterfaceInfo(name="Gi0/2", status="up", vlan=20, speed="1 Gbps", errors=0, packet_loss_pct=0.0),
        ],
    ),
    Device(
        id="SW-003",
        hostname="Switch-SW-003",
        type="switch",
        ip_address="192.168.30.1",
        status="healthy",
        model="Cisco Nexus 93180YC-FX",
        location="AI Compute Rack",
        uptime="92d 14h 20m",
        os_version="NX-OS 9.3(8)",
        active_alerts=0,
        cpu_usage=24.1,
        memory_usage=41.2,
        role="AI Cluster Spine Switch",
        interfaces=[
            InterfaceInfo(name="Eth1/1", status="up", vlan=30, speed="10 Gbps", errors=0, packet_loss_pct=0.0),
            InterfaceInfo(name="Eth1/2", status="up", vlan=30, speed="10 Gbps", errors=0, packet_loss_pct=0.0),
            InterfaceInfo(name="Eth1/3", status="up", vlan=30, speed="10 Gbps", errors=0, packet_loss_pct=0.0),
        ],
    ),
    Device(
        id="ADMIN-PC",
        hostname="Admin PC",
        type="pc",
        ip_address="192.168.10.100",
        status="healthy",
        model="Dell Precision 5820 Tower",
        location="Security Operations Desk",
        uptime="14d 06h 00m",
        os_version="Ubuntu 22.04 LTS (Hardened)",
        active_alerts=0,
        cpu_usage=12.5,
        memory_usage=29.0,
        role="SOC Security Administration",
        interfaces=[InterfaceInfo(name="eth0", ip_address="192.168.10.100", status="up", vlan=10)],
    ),
    Device(
        id="WS-001",
        hostname="Workstation 001",
        type="pc",
        ip_address="192.168.20.101",
        status="healthy",
        model="HP Z4 G4 Workstation",
        location="Engineering Desk A",
        uptime="8d 04h 15m",
        os_version="Windows 11 Pro Enterprise",
        active_alerts=0,
        cpu_usage=14.0,
        memory_usage=35.0,
        role="Engineering Workstation",
        interfaces=[InterfaceInfo(name="Ethernet0", ip_address="192.168.20.101", status="up", vlan=20)],
    ),
    Device(
        id="WS-002",
        hostname="Workstation 002",
        type="pc",
        ip_address="192.168.20.102",
        status="healthy",
        model="HP Z4 G4 Workstation",
        location="Operations Desk B",
        uptime="8d 04h 15m",
        os_version="Windows 11 Pro Enterprise",
        active_alerts=0,
        cpu_usage=15.0,
        memory_usage=36.0,
        role="Operations Workstation",
        interfaces=[InterfaceInfo(name="Ethernet0", ip_address="192.168.20.102", status="up", vlan=20)],
    ),
    Device(
        id="LLM-SRV",
        hostname="Local LLM Server",
        type="server",
        ip_address="192.168.30.10",
        status="healthy",
        model="Supermicro 4x NVIDIA A100-80GB",
        location="AI Compute Rack Unit 1",
        uptime="90d 18h 00m",
        os_version="Ubuntu 22.04 / CUDA 12.2",
        active_alerts=0,
        cpu_usage=48.2,
        memory_usage=64.0,
        role="Local Inference Engine (Qwen / Nemotron)",
        interfaces=[InterfaceInfo(name="ens1f0", ip_address="192.168.30.10", status="up", vlan=30, speed="10 Gbps", errors=0, packet_loss_pct=0.0)],
    ),
    Device(
        id="RAG-SRV",
        hostname="Local RAG Server",
        type="server",
        ip_address="192.168.30.11",
        status="healthy",
        model="Dell PowerEdge R750 (Vector DB)",
        location="AI Compute Rack Unit 2",
        uptime="90d 18h 00m",
        os_version="Ubuntu 22.04 / Qdrant Vector Engine",
        active_alerts=0,
        cpu_usage=28.5,
        memory_usage=45.0,
        role="Retrieval & Vector Knowledge Index",
        interfaces=[InterfaceInfo(name="ens1f0", ip_address="192.168.30.11", status="up", vlan=30, speed="10 Gbps", errors=0, packet_loss_pct=0.0)],
    ),
    Device(
        id="HARNESS",
        hostname="Clarix AI Harness",
        type="harness",
        ip_address="192.168.30.12",
        status="healthy",
        model="Clarix Security Gateway & Orchestration",
        location="AI Compute Rack Unit 3",
        uptime="90d 18h 00m",
        os_version="Clarix OS 2.4.1 (Zero-Trust Guard)",
        active_alerts=0,
        cpu_usage=22.8,
        memory_usage=38.2,
        role="Security Guardrails & Audit Logger",
        interfaces=[InterfaceInfo(name="ens1f0", ip_address="192.168.30.12", status="up", vlan=30, speed="10 Gbps", errors=0, packet_loss_pct=0.0)],
    ),
]

DEMO_1_TOPOLOGY = TopologyData(
    nodes=[
        TopologyNode(
            id=cfg["id"],
            label=cfg["label"],
            type=cfg["type"],
            ip=cfg["ip"],
            status="healthy",
            position=cfg["pos"],
        )
        for cfg in BASE_NODES_CONFIG
    ],
    edges=[
        TopologyEdge(
            id=e["id"],
            source=e["source"],
            target=e["target"],
            status="healthy",
            bandwidth="1 Gbps" if "sw3" not in e["id"] else "10 Gbps",
            latency="0.8ms",
            packet_loss=0.0,
        )
        for e in BASE_EDGES_CONFIG
    ],
)

DEMO_1_STATUS = NetworkStatus(
    health_score=100,
    health_rating="Excellent",
    active_incidents=0,
    critical_incidents=0,
    resolved_today=148,
    avg_resolution_time_min=12,
    availability_pct=100.0,
    total_devices=12,
    online_devices=12,
    offline_devices=0,
    error_devices=0,
    last_updated="2026-11-20 20:00:00 UTC",
    simulation_mode=True,
    demo_mode="healthy",
    status_label="ALL SYSTEMS OPERATIONAL",
)

# =========================================================================
# DEMO 2 — FAULTY NETWORK DATA
# Injected faults:
# 1. Router R1: Gi0/0 administratively down (CRITICAL)
# 2. Switch SW-001: Incorrect VLAN assignment on access port (WARNING)
# 3. Workstation 002: Incorrect default gateway (WARNING)
# 4. Local RAG Server: RAG service unavailable (CRITICAL)
# =========================================================================

DEMO_2_DEVICES: List[Device] = [
    Device(
        id="FW-001",
        hostname="Firewall-FW-001",
        type="firewall",
        ip_address="192.168.0.254",
        status="healthy",
        model="Cisco Firepower 1120 (Air-Gap Secure)",
        location="Security Perimeter",
        uptime="98d 4h 12m",
        os_version="FTD 7.2.4",
        active_alerts=0,
        cpu_usage=18.4,
        memory_usage=32.0,
        role="Air-Gap Boundary & Firewall",
        interfaces=[
            InterfaceInfo(name="Outside-Eth1/1", ip_address="BLOCKED", status="down"),
            InterfaceInfo(name="Inside-Eth1/2", ip_address="192.168.0.254", status="up"),
        ],
    ),
    Device(
        id="R1",
        hostname="Router R1",
        type="router",
        ip_address="192.168.1.1",
        status="critical",  # FAULT 1
        model="Cisco ISR 4331",
        location="Core Rack A",
        uptime="45d 12h 10m",
        os_version="Cisco IOS XE 17.06.01a",
        active_alerts=1,
        cpu_usage=84.2,
        memory_usage=62.0,
        role="Core Gateway 1",
        interfaces=[
            InterfaceInfo(
                name="GigabitEthernet0/0",
                ip_address="192.168.1.1",
                status="administratively down",  # FAULT
                vlan=1,
                speed="1 Gbps",
                errors=182,
                packet_loss_pct=100.0,
            ),
            InterfaceInfo(name="GigabitEthernet0/1", ip_address="10.0.0.1", status="up", vlan=10),
        ],
    ),
    Device(
        id="R2",
        hostname="Router R2",
        type="router",
        ip_address="192.168.2.1",
        status="healthy",
        model="Cisco ISR 4321",
        location="Core Rack B",
        uptime="45d 12h 10m",
        os_version="Cisco IOS XE 17.06.01a",
        active_alerts=0,
        cpu_usage=24.1,
        memory_usage=38.0,
        role="Core Gateway 2",
        interfaces=[
            InterfaceInfo(name="GigabitEthernet0/0", ip_address="192.168.2.1", status="up"),
            InterfaceInfo(name="GigabitEthernet0/1", ip_address="10.0.0.2", status="up"),
        ],
    ),
    Device(
        id="SW-001",
        hostname="Switch SW-001",
        type="switch",
        ip_address="192.168.10.1",
        status="warning",  # FAULT 2
        model="Cisco Catalyst 9300-48P",
        location="Distribution Rack 1",
        uptime="120d 00h 00m",
        os_version="Cisco IOS XE 17.09.01",
        active_alerts=1,
        cpu_usage=48.0,
        memory_usage=51.2,
        role="Admin & Management Switch",
        interfaces=[
            InterfaceInfo(name="Gi1/0/1", status="up", vlan=1),
            InterfaceInfo(name="Gi1/0/12", status="up", vlan=99, errors=34, packet_loss_pct=18.5),  # FAULT: VLAN 99 instead of 10
        ],
    ),
    Device(
        id="SW-002",
        hostname="Switch SW-002",
        type="switch",
        ip_address="192.168.20.1",
        status="healthy",
        model="Cisco Catalyst 2960-X",
        location="Floor Access Rack",
        uptime="85d 02h 30m",
        os_version="Cisco IOS 15.2(7)E",
        active_alerts=0,
        cpu_usage=19.4,
        memory_usage=31.0,
        role="Workstation Edge Switch",
        interfaces=[
            InterfaceInfo(name="Gi0/1", status="up", vlan=20),
            InterfaceInfo(name="Gi0/2", status="up", vlan=20),
        ],
    ),
    Device(
        id="SW-003",
        hostname="Switch SW-003",
        type="switch",
        ip_address="192.168.30.1",
        status="healthy",
        model="Cisco Nexus 93180YC-FX",
        location="AI Compute Rack",
        uptime="92d 14h 20m",
        os_version="NX-OS 9.3(8)",
        active_alerts=0,
        cpu_usage=38.4,
        memory_usage=49.0,
        role="AI Cluster Spine Switch",
        interfaces=[
            InterfaceInfo(name="Eth1/1", status="up", vlan=30),
            InterfaceInfo(name="Eth1/2", status="up", vlan=30),
            InterfaceInfo(name="Eth1/3", status="up", vlan=30),
        ],
    ),
    Device(
        id="ADMIN-PC",
        hostname="Admin PC",
        type="pc",
        ip_address="192.168.10.100",
        status="healthy",
        model="Dell Precision 5820 Tower",
        location="Security Operations Desk",
        uptime="14d 06h 00m",
        os_version="Ubuntu 22.04 LTS (Hardened)",
        active_alerts=0,
        cpu_usage=14.0,
        memory_usage=30.0,
        role="SOC Security Administration",
        interfaces=[InterfaceInfo(name="eth0", ip_address="192.168.10.100", status="up", vlan=10)],
    ),
    Device(
        id="WS-001",
        hostname="Workstation 001",
        type="pc",
        ip_address="192.168.20.101",
        status="healthy",
        model="HP Z4 G4 Workstation",
        location="Engineering Desk A",
        uptime="8d 04h 15m",
        os_version="Windows 11 Pro Enterprise",
        active_alerts=0,
        cpu_usage=14.0,
        memory_usage=35.0,
        role="Engineering Workstation",
        interfaces=[InterfaceInfo(name="Ethernet0", ip_address="192.168.20.101", status="up", vlan=20)],
    ),
    Device(
        id="WS-002",
        hostname="Workstation 002",
        type="pc",
        ip_address="192.168.20.102",
        status="warning",  # FAULT 3
        model="HP Z4 G4 Workstation",
        location="Operations Desk B",
        uptime="8d 04h 15m",
        os_version="Windows 11 Pro Enterprise",
        active_alerts=1,
        cpu_usage=26.0,
        memory_usage=44.0,
        role="Operations Workstation",
        interfaces=[
            InterfaceInfo(
                name="Ethernet0",
                ip_address="192.168.20.102",
                status="up",
                vlan=20,
                errors=12,
                packet_loss_pct=15.0,
            )
        ],
    ),
    Device(
        id="LLM-SRV",
        hostname="Local LLM Server",
        type="server",
        ip_address="192.168.30.10",
        status="healthy",
        model="Supermicro 4x NVIDIA A100-80GB",
        location="AI Compute Rack Unit 1",
        uptime="90d 18h 00m",
        os_version="Ubuntu 22.04 / CUDA 12.2",
        active_alerts=0,
        cpu_usage=42.0,
        memory_usage=60.0,
        role="Local Inference Engine (Qwen / Nemotron)",
        interfaces=[InterfaceInfo(name="ens1f0", ip_address="192.168.30.10", status="up", vlan=30)],
    ),
    Device(
        id="RAG-SRV",
        hostname="Local RAG Server",
        type="server",
        ip_address="192.168.30.11",
        status="critical",  # FAULT 4
        model="Dell PowerEdge R750 (Vector DB)",
        location="AI Compute Rack Unit 2",
        uptime="90d 18h 00m",
        os_version="Ubuntu 22.04 / Qdrant Vector Engine",
        active_alerts=1,
        cpu_usage=94.5,
        memory_usage=88.0,
        role="Retrieval & Vector Knowledge Index",
        interfaces=[
            InterfaceInfo(
                name="ens1f0",
                ip_address="192.168.30.11",
                status="down",  # FAULT: Service port down
                vlan=30,
                errors=650,
                packet_loss_pct=100.0,
            )
        ],
    ),
    Device(
        id="HARNESS",
        hostname="Clarix AI Harness",
        type="harness",
        ip_address="192.168.30.12",
        status="healthy",
        model="Clarix Security Gateway & Orchestration",
        location="AI Compute Rack Unit 3",
        uptime="90d 18h 00m",
        os_version="Clarix OS 2.4.1 (Zero-Trust Guard)",
        active_alerts=0,
        cpu_usage=25.0,
        memory_usage=39.0,
        role="Security Guardrails & Audit Logger",
        interfaces=[InterfaceInfo(name="ens1f0", ip_address="192.168.30.12", status="up", vlan=30)],
    ),
]

DEMO_2_TOPOLOGY = TopologyData(
    nodes=[
        TopologyNode(
            id=cfg["id"],
            label=cfg["label"],
            type=cfg["type"],
            ip=cfg["ip"],
            status=(
                "critical"
                if cfg["id"] in ["R1", "RAG-SRV"]
                else "warning"
                if cfg["id"] in ["SW-001", "WS-002"]
                else "healthy"
            ),
            position=cfg["pos"],
        )
        for cfg in BASE_NODES_CONFIG
    ],
    edges=[
        TopologyEdge(
            id=e["id"],
            source=e["source"],
            target=e["target"],
            status=(
                "failed"
                if e["id"] in ["e-fw-r1", "e-r1-sw1", "e-sw3-rag"]
                else "degraded"
                if e["id"] in ["e-sw1-admin", "e-sw2-ws2"]
                else "healthy"
            ),
            bandwidth="1 Gbps" if "sw3" not in e["id"] else "10 Gbps",
            latency=(
                "N/A"
                if e["id"] in ["e-fw-r1", "e-r1-sw1", "e-sw3-rag"]
                else "28ms"
                if e["id"] in ["e-sw1-admin", "e-sw2-ws2"]
                else "0.8ms"
            ),
            packet_loss=(
                100.0
                if e["id"] in ["e-fw-r1", "e-r1-sw1", "e-sw3-rag"]
                else 18.5
                if e["id"] in ["e-sw1-admin", "e-sw2-ws2"]
                else 0.0
            ),
        )
        for e in BASE_EDGES_CONFIG
    ],
)

DEMO_2_STATUS = NetworkStatus(
    health_score=62,
    health_rating="Critical",
    active_incidents=4,
    critical_incidents=2,
    resolved_today=144,
    avg_resolution_time_min=24,
    availability_pct=72.8,
    total_devices=12,
    online_devices=10,
    offline_devices=1,
    error_devices=1,
    last_updated="2026-11-20 20:10:00 UTC",
    simulation_mode=True,
    demo_mode="faulty",
    status_label="CRITICAL ATTENTION REQUIRED (4 FAULTS DETECTED)",
)

# 4 Specific Injected Demonstration Incidents
DEMO_2_INCIDENTS: List[Incident] = [
    Incident(
        id="FAULT-001",
        device_id="R1",
        device_name="Router R1",
        device_ip="192.168.1.1",
        incident_type="Interface Down",
        severity="Critical",
        detected_at="02:14 PM",
        status="Open",
        assigned_to="Sarah Chen",
        assigned_action="Bring up interface GigabitEthernet0/0",
        description="Interface GigabitEthernet0/0 is administratively down. The interface is disabled, preventing communication through the affected link.",
        root_cause="GigabitEthernet0/0 is disabled.",
        cisco_commands=[
            "configure terminal",
            "interface GigabitEthernet0/0",
            "no shutdown",
            "end",
        ],
    ),
    Incident(
        id="FAULT-002",
        device_id="SW-001",
        device_name="Switch SW-001",
        device_ip="192.168.10.1",
        incident_type="VLAN Mismatch",
        severity="Warning",
        detected_at="02:08 PM",
        status="Investigating",
        assigned_to="Alex Morgan",
        assigned_action="Inspect switchport configuration and assign correct VLAN",
        description="Incorrect VLAN assignment on an access port. The connected workstation is assigned to an unexpected VLAN, affecting communication with the intended network segment.",
        root_cause="The access port is assigned to an unexpected VLAN (VLAN 99 Quarantine instead of intended VLAN 10).",
        cisco_commands=[
            "configure terminal",
            "interface GigabitEthernet1/0/12",
            "switchport mode access",
            "switchport access vlan 10",
            "end",
        ],
    ),
    Incident(
        id="FAULT-003",
        device_id="WS-002",
        device_name="Workstation 002",
        device_ip="192.168.20.102",
        incident_type="Default Gateway Failure",
        severity="Warning",
        detected_at="01:52 PM",
        status="Open",
        assigned_to="David Lee",
        assigned_action="Configure correct gateway (192.168.20.1)",
        description="Incorrect default gateway. The workstation has an incorrect default gateway and cannot reach devices outside its local subnet.",
        root_cause="Default gateway is misconfigured as 192.168.20.254 instead of Router LAN IP 192.168.20.1.",
        cisco_commands=[
            "# Workstation IP Configuration Update",
            "netsh interface ip set address name=\"Ethernet0\" static 192.168.20.102 255.255.255.0 192.168.20.1",
        ],
    ),
    Incident(
        id="FAULT-004",
        device_id="RAG-SRV",
        device_name="Local RAG Server",
        device_ip="192.168.30.11",
        incident_type="Device Unreachable",
        severity="Critical",
        detected_at="01:45 PM",
        status="Open",
        assigned_to="Elena Rostova",
        assigned_action="Restart local RAG service and verify vector database connectivity",
        description="RAG service unavailable. The local retrieval service is not responding. The LLM may be unable to retrieve internal documents.",
        root_cause="Local retrieval service (Qdrant vector engine / clarix-rag) process has stopped and is not responding on port 6333.",
        cisco_commands=[
            "# Host Service Remediation",
            "systemctl restart clarix-rag.service",
            "curl -s http://127.0.0.1:6333/health",
        ],
    ),
]

# Structured Fault Details for AI Diagnosis
DEMO_2_FAULT_DETAILS: List[FaultDetail] = [
    FaultDetail(
        id="FAULT-001",
        device_id="R1",
        device_name="Router R1",
        severity="Critical",
        problem="Interface administratively down.",
        root_cause="GigabitEthernet0/0 is disabled.",
        evidence=[
            "Interface GigabitEthernet0/0 line protocol is down (administratively down)",
            "Last state change: 48 minutes ago (manual shutdown detected)",
            "OSPF adjacency with Core Switch SW-001 timed out (DeadTimerExpired)",
            "0 packets transmitted across segment Gi0/0",
        ],
        recommended_solution="Enable the interface using the suggested Cisco IOS commands.",
        commands=[
            "configure terminal",
            "interface GigabitEthernet0/0",
            "no shutdown",
            "end",
        ],
        expected_result="Interface line protocol status changes to 'up/up', ping to 192.168.1.1 succeeds with 0% loss.",
    ),
    FaultDetail(
        id="FAULT-002",
        device_id="SW-001",
        device_name="SW-001",
        severity="Warning",
        problem="Incorrect VLAN assignment.",
        root_cause="The access port is assigned to an unexpected VLAN.",
        evidence=[
            "Access port Gi1/0/12 tagged for VLAN 99 (Quarantine)",
            "Admin PC expected traffic segment: VLAN 10 (Management)",
            "ARP requests broadcast on VLAN 99 receive 0 responses from management gateway",
        ],
        recommended_solution="Inspect the switchport configuration and assign the correct VLAN after verifying the intended network design.",
        commands=[
            "configure terminal",
            "interface GigabitEthernet1/0/12",
            "switchport mode access",
            "switchport access vlan 10",
            "end",
        ],
        expected_result="Port Gi1/0/12 learned into VLAN 10 forwarding database; management communication restored.",
    ),
    FaultDetail(
        id="FAULT-003",
        device_id="WS-002",
        device_name="Workstation 002",
        severity="Warning",
        problem="Incorrect default gateway.",
        root_cause="The workstation has an incorrect default gateway and cannot reach devices outside its local subnet.",
        evidence=[
            "Workstation IP configuration: IP 192.168.20.102 / 24, Gateway: 192.168.20.254 (Unreachable)",
            "Valid router LAN IP on segment: 192.168.20.1",
            "ICMP echo tests to 192.168.30.10 (LLM Server) fail with 'Destination host unreachable'",
        ],
        recommended_solution="Configure the correct gateway after verifying the router's LAN IP address.",
        commands=[
            "# Set correct default gateway",
            "ip default-gateway 192.168.20.1",
        ],
        expected_result="Inter-subnet routing table updated; packets to 192.168.30.0/24 egress through 192.168.20.1.",
    ),
    FaultDetail(
        id="FAULT-004",
        device_id="RAG-SRV",
        device_name="Local RAG Server",
        severity="Critical",
        problem="Retrieval service unavailable.",
        root_cause="The local retrieval service is not responding. The LLM may be unable to retrieve internal documents.",
        evidence=[
            "HTTP health check GET http://192.168.30.11:6333/health returned Connection Refused",
            "Qdrant vector engine process inactive (dead)",
            "Clarix AI inference requests lacking internal context due to vector search timeout",
        ],
        recommended_solution="Inspect the local RAG service, backend health and connectivity to the local vector database.",
        commands=[
            "systemctl restart clarix-rag.service",
            "curl -s http://127.0.0.1:6333/health",
        ],
        expected_result="Vector retrieval service restarts on port 6333; embeddings query latency drops to < 15ms.",
    ),
]
