from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class InterfaceInfo(BaseModel):
    name: str
    ip_address: Optional[str] = None
    subnet_mask: Optional[str] = None
    status: str  # "up", "down", "administratively down"
    mac_address: Optional[str] = None
    vlan: Optional[int] = None
    duplex: Optional[str] = "Full"
    speed: Optional[str] = "1 Gbps"
    errors: int = 0
    packet_loss_pct: float = 0.0


class Device(BaseModel):
    id: str
    hostname: str
    type: str  # "router", "switch", "pc", "server", "firewall", "harness"
    ip_address: str
    status: str  # "healthy", "warning", "critical", "offline"
    model: str
    location: str
    uptime: str
    os_version: str
    interfaces: List[InterfaceInfo] = []
    active_alerts: int = 0
    cpu_usage: float = 0.0
    memory_usage: float = 0.0
    role: Optional[str] = None


class TopologyNode(BaseModel):
    id: str
    label: str
    type: str  # "router", "switch", "pc", "server", "firewall", "harness"
    ip: str
    status: str  # "healthy", "warning", "critical"
    position: Dict[str, float]
    metadata: Dict[str, Any] = {}


class TopologyEdge(BaseModel):
    id: str
    source: str
    target: str
    status: str  # "healthy", "failed", "degraded"
    bandwidth: str = "1 Gbps"
    latency: str = "1ms"
    packet_loss: float = 0.0


class TopologyData(BaseModel):
    nodes: List[TopologyNode]
    edges: List[TopologyEdge]


class Incident(BaseModel):
    id: str
    device_id: str
    device_name: str
    device_ip: str
    incident_type: str
    severity: str  # "Critical", "High", "Medium", "Low"
    detected_at: str
    status: str  # "Open", "Investigating", "Containment", "Resolved"
    assigned_to: str
    assigned_action: str
    description: str
    root_cause: Optional[str] = None
    cisco_commands: List[str] = []


class NetworkStatus(BaseModel):
    health_score: int  # 0 - 100
    health_rating: str  # "Excellent", "Warning", "Critical"
    active_incidents: int
    critical_incidents: int
    resolved_today: int
    avg_resolution_time_min: int
    availability_pct: float
    total_devices: int
    online_devices: int
    offline_devices: int
    error_devices: int
    last_updated: str
    simulation_mode: bool = True
    demo_mode: str = "healthy"  # "healthy" | "faulty"
    status_label: str = "ALL SYSTEMS OPERATIONAL"


class FaultDetail(BaseModel):
    id: str
    device_id: str
    device_name: str
    severity: str
    problem: str
    root_cause: str
    evidence: List[str]
    recommended_solution: str
    commands: List[str]
    expected_result: str


class DiagnoseRequest(BaseModel):
    query: Optional[str] = None
    demo_mode: Optional[str] = "healthy"
    device_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class DiagnoseResponse(BaseModel):
    query: str
    demo_mode: str
    status: str  # "healthy" | "faulty"
    summary: str
    incident_count: int
    incidents: List[FaultDetail] = []
    confidence: float = 0.98
    simulated: bool = True


class RemediateRequest(BaseModel):
    incident_id: str
    device_id: Optional[str] = None
    proposed_commands: List[str]
    require_approval: bool = True
    approved: bool = False


class RemediateResponse(BaseModel):
    request_id: str
    incident_id: str
    device_id: Optional[str] = None
    status: str  # "pending_approval", "approved", "rejected", "executed"
    message: str
    execution_output: Optional[str] = None
    simulated: bool = True


class VerifyRequest(BaseModel):
    device_id: str
    target_ip: Optional[str] = None
    command: Optional[str] = "ping"
    demo_mode: Optional[str] = "healthy"


class VerifyResponse(BaseModel):
    device_id: str
    test: str
    result: str  # "passed", "failed"
    latency_ms: float
    packet_loss_pct: float
    raw_output: str
    simulated: bool = True
