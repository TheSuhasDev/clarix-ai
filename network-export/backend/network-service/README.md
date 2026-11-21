# Clarix Network Service

FastAPI microservice providing real-time telemetry, Cisco Packet Tracer topology simulation, and network incident investigation data for the Clarix console.

## Setup & Running

1. Create a local virtual environment:
   ```bash
   python3 -m venv .venv
   ```

2. Install dependencies:
   ```bash
   .venv/bin/pip install -r requirements.txt
   ```

3. Start the service:
   ```bash
   .venv/bin/uvicorn networkops.main:app --host 127.0.0.1 --port 8080 --reload
   ```

## Endpoints
- `GET /` — Operational health and service metadata
- `GET /api/network/status` — Network health, SLA, and incident totals
- `GET /api/network/topology` — React Flow nodes & edges
- `GET /api/network/devices` — Device inventory (12 Cisco devices)
- `GET /api/network/incidents` — Triage queue
- `POST /api/network/diagnose` — AI investigation engine
- `POST /api/network/remediate` — Human-in-the-loop remediation queue
- `POST /api/network/verify` — ICMP ping / traceroute verification
