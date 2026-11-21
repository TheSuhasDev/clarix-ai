import time
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .models import (
    NetworkStatus,
    TopologyData,
    Device,
    InterfaceInfo,
    Incident,
    DiagnoseRequest,
    DiagnoseResponse,
    FaultDetail,
    RemediateRequest,
    RemediateResponse,
    VerifyRequest,
    VerifyResponse,
)
from .mock_data import (
    DEMO_1_STATUS,
    DEMO_1_TOPOLOGY,
    DEMO_1_DEVICES,
    DEMO_2_STATUS,
    DEMO_2_TOPOLOGY,
    DEMO_2_DEVICES,
    DEMO_2_INCIDENTS,
    DEMO_2_FAULT_DETAILS,
)

app = FastAPI(
    title="Clarix NetworkOps Standalone API",
    description="Dedicated NOC and Network Incident Management API with Two Network Demonstration Modes",
    version="1.1.0",
)

# Enable CORS for local Vite development frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {
        "service": "Clarix NetworkOps API",
        "status": "operational",
        "version": "1.1.0",
        "demo_modes": ["healthy", "faulty"],
    }


@app.get("/api/network/status", response_model=NetworkStatus)
def get_network_status(demo_mode: str = Query("healthy", description="'healthy' or 'faulty'")):
    """Returns overall health, incident statistics, and device availability for selected demo."""
    if demo_mode.lower() == "faulty":
        return DEMO_2_STATUS
    return DEMO_1_STATUS


@app.get("/api/network/topology", response_model=TopologyData)
def get_network_topology(demo_mode: str = Query("healthy", description="'healthy' or 'faulty'")):
    """Returns interactive network topology nodes and connectivity edges for selected demo."""
    if demo_mode.lower() == "faulty":
        return DEMO_2_TOPOLOGY
    return DEMO_1_TOPOLOGY


@app.get("/api/network/devices", response_model=List[Device])
def get_devices(
    demo_mode: str = Query("healthy", description="'healthy' or 'faulty'"),
    status: Optional[str] = None,
    type: Optional[str] = None,
):
    """Returns all 12 network devices with optional filtering by status or type."""
    devices = DEMO_2_DEVICES if demo_mode.lower() == "faulty" else DEMO_1_DEVICES
    if status and status != "all":
        devices = [d for d in devices if d.status.lower() == status.lower()]
    if type and type != "all":
        devices = [d for d in devices if d.type.lower() == type.lower()]
    return devices


@app.get("/api/network/devices/{device_id}", response_model=Device)
def get_device_by_id(device_id: str, demo_mode: str = Query("healthy")):
    """Get single device details by ID."""
    devices = DEMO_2_DEVICES if demo_mode.lower() == "faulty" else DEMO_1_DEVICES
    for dev in devices:
        if dev.id.lower() == device_id.lower() or dev.hostname.lower() == device_id.lower():
            return dev
    raise HTTPException(status_code=404, detail=f"Device {device_id} not found")


@app.get("/api/network/interfaces", response_model=Dict[str, List[InterfaceInfo]])
def get_all_interfaces(device_id: Optional[str] = None, demo_mode: str = Query("healthy")):
    """Returns interface metrics and link statuses across devices."""
    devices = DEMO_2_DEVICES if demo_mode.lower() == "faulty" else DEMO_1_DEVICES
    res = {}
    for dev in devices:
        if not device_id or dev.id.lower() == device_id.lower():
            res[dev.id] = dev.interfaces
    return res


@app.get("/api/network/incidents", response_model=List[Incident])
def get_incidents(
    demo_mode: str = Query("healthy", description="'healthy' or 'faulty'"),
    severity: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
):
    """Returns list of active and resolved incidents."""
    incidents = DEMO_2_INCIDENTS if demo_mode.lower() == "faulty" else []
    if severity and severity != "all":
        incidents = [i for i in incidents if i.severity.lower() == severity.lower()]
    if status and status != "all":
        incidents = [i for i in incidents if i.status.lower() == status.lower()]
    if category and category != "all":
        incidents = [i for i in incidents if i.incident_type.lower() == category.lower()]
    return incidents


@app.post("/api/network/diagnose", response_model=DiagnoseResponse)
def diagnose_network_issue(req: DiagnoseRequest):
    """
    AI troubleshooting engine: processes demo mode and questions to return structured
    root cause, evidence, and safe remediation commands.
    """
    mode = (req.demo_mode or "healthy").lower()

    if mode == "healthy":
        return DiagnoseResponse(
            query=req.query or "Analyze Network",
            demo_mode="healthy",
            status="healthy",
            summary="All Systems Operational. No network fault detected in the available diagnostic evidence.",
            incident_count=0,
            incidents=[],
            confidence=0.99,
            simulated=True,
        )
    else:
        return DiagnoseResponse(
            query=req.query or "Analyze Network",
            demo_mode="faulty",
            status="faulty",
            summary="CLARIX AI – NETWORK INVESTIGATION: Detected 4 critical and warning incidents across the network topology.",
            incident_count=len(DEMO_2_FAULT_DETAILS),
            incidents=DEMO_2_FAULT_DETAILS,
            confidence=0.98,
            simulated=True,
        )


@app.post("/api/network/remediate", response_model=RemediateResponse)
def remediate_incident(req: RemediateRequest):
    """
    Submits remediation commands to approval queue.
    Safety guarantee: commands are NOT executed directly; an approval proposal is created.
    """
    status = "approved" if req.approved else "pending_approval"
    message = (
        "Remediation proposal approved and staged for execution."
        if req.approved
        else "Remediation proposal generated and queued for NOC operator approval. No direct execution occurred."
    )
    return RemediateResponse(
        request_id=f"PROP-{int(time.time())}",
        incident_id=req.incident_id,
        device_id=req.device_id,
        status=status,
        message=message,
        execution_output=(
            f"# Simulated execution complete on {req.device_id or req.incident_id}:\n"
            + "\n".join([f"> {c}" for c in req.proposed_commands])
            + "\n# Status: SUCCESS (Simulated)"
            if req.approved
            else None
        ),
        simulated=True,
    )


@app.post("/api/network/verify", response_model=VerifyResponse)
def verify_connectivity(req: VerifyRequest):
    """Simulates or triggers ICMP ping / traceroute verification."""
    is_faulty = (req.demo_mode or "healthy").lower() == "faulty"
    dev_id = req.device_id.upper()
    has_fault = is_faulty and (dev_id in ["R1", "RAG-SRV", "WS-002", "SW-001"])

    return VerifyResponse(
        device_id=req.device_id,
        test=req.command or "ping",
        result="failed" if has_fault else "passed",
        latency_ms=0.0 if (has_fault and dev_id in ["R1", "RAG-SRV"]) else (28.4 if has_fault else 0.85),
        packet_loss_pct=100.0 if (has_fault and dev_id in ["R1", "RAG-SRV"]) else (18.5 if has_fault else 0.0),
        raw_output=(
            f"Type escape sequence to abort.\n"
            f"Sending 5, 100-byte ICMP Echos to target, timeout is 2 seconds:\n"
            f".....\n"
            f"Success rate is 0 percent (0/5)"
            if (has_fault and dev_id in ["R1", "RAG-SRV"])
            else (
                f"Type escape sequence to abort.\n"
                f"Sending 5, 100-byte ICMP Echos to target, timeout is 2 seconds:\n"
                f".!.!.\n"
                f"Success rate is 40 percent (2/5), degraded latency = 28ms"
                if has_fault
                else f"Type escape sequence to abort.\n"
                f"Sending 5, 100-byte ICMP Echos to target, timeout is 2 seconds:\n"
                f"!!!!!\n"
                f"Success rate is 100 percent (5/5), round-trip min/avg/max = 1/1/2 ms"
            )
        ),
        simulated=True,
    )
