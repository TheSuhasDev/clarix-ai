# Clarix NetworkOps Export & Integration Guide

This directory contains the complete, standalone extraction of the **Network Operations (NetworkOps)** telemetry and diagnostic suite from the Clarix AI platform. It includes the full Python FastAPI backend microservice, the complete React + TypeScript frontend suite (with Cisco topology visualization, incident triage, and AI diagnostics), shared assets, and reference integrations.

---

## 1. Directory Structure & File Inventory

```
network-export/
├── backend/
│   └── network-service/
│       ├── .env.example              # Default network service environment configuration
│       ├── .gitignore                # Git ignore rules (.venv, __pycache__, .env)
│       ├── README.md                 # Standalone backend documentation
│       ├── requirements.txt          # Python package requirements (FastAPI, Uvicorn, Pydantic)
│       └── networkops/
│           ├── __init__.py           # Package marker and version metadata
│           ├── main.py               # FastAPI application, route handlers, CORS configuration
│           ├── mock_data.py          # Cisco 12-device telemetry, Demo 1 & Demo 2 mock datasets
│           ├── models.py             # Pydantic schemas for devices, incidents, topology, diagnostics
│           └── requirements.txt      # Mirror of service requirements
├── frontend/
│   ├── public/
│   │   └── network-assets/           # Static icons and robot illustrations
│   │       ├── robot-1.jpg
│   │       ├── robot-2.jpg
│   │       ├── robot-3.jpg
│   │       ├── robot-4.jpg
│   │       ├── robot-assistant.svg
│   │       ├── robot-dashboard.svg
│   │       ├── robot-empty.svg
│   │       └── robot-loading.svg
│   └── src/
│       ├── pages/
│       │   ├── Network.tsx           # Route mount component exporting default NetworkApp
│       │   └── Network.module.css    # Extra discovered module stylesheet
│       └── network/
│           ├── NetworkApp.tsx        # Top-level sub-router, sub-page navigation header, title sync
│           ├── components/
│           │   ├── charts/
│           │   │   ├── DeviceHealthChart.tsx         # Recharts device availability distribution
│           │   │   ├── IncidentTrendChart.tsx        # Recharts incident timeline trend
│           │   │   ├── NetworkAvailabilityChart.tsx  # SLA availability area chart
│           │   │   └── NetworkPerformanceChart.tsx   # Latency & throughput dual chart
│           │   ├── common/
│           │   │   ├── CiscoTerminalModal.tsx        # Interactive CLI terminal emulator modal
│           │   │   ├── GaugeMeter.tsx                # SVG circular metric gauge
│           │   │   ├── GlassButton.tsx               # Reusable styled button
│           │   │   ├── GlassCard.tsx                 # Frosted glass card container
│           │   │   ├── GlassModal.tsx                # Frosted glass modal overlay
│           │   │   ├── GlowingPill.tsx               # Status indicator pill
│           │   │   ├── HumanApprovalModal.tsx        # Remediation command authorization modal
│           │   │   └── StatusBadge.tsx               # Severity and device state badge
│           │   ├── dashboard/
│           │   │   ├── AIInvestigationCard.tsx       # AI investigation quick-launcher widget
│           │   │   ├── DeviceStatistics.tsx          # Device count breakdown by type and state
│           │   │   ├── IncidentSummaryCards.tsx      # Critical/warning/resolved metric cards
│           │   │   ├── IncidentVolumeTimeline.tsx    # 24-hour incident frequency graph
│           │   │   ├── NetworkHealthCard.tsx         # Primary health score & SLA widget
│           │   │   ├── NetworkTopologyMiniCard.tsx   # Dashboard preview of topology canvas
│           │   │   └── RecentIncidentsTable.tsx      # Latest alerts summary table
│           │   ├── incidents/
│           │   │   ├── IncidentDetailModal.tsx       # Incident root-cause and triage dialog
│           │   │   └── IncidentManagementTable.tsx   # Filterable incident triage matrix
│           │   ├── layout/
│           │   │   └── HeaderBanner.tsx              # Sub-navigation header with demo switcher
│           │   └── topology/
│           │       ├── DemoSelector.tsx              # Healthy (Demo 1) vs Faulty (Demo 2) switcher
│           │       ├── DeviceDetailsDrawer.tsx       # Slide-out drawer showing device telemetry
│           │       ├── DeviceNode.tsx                # Custom ReactFlow node with status rings
│           │       ├── NetworkTopologyFlow.tsx       # Fullscreen interactive ReactFlow topology canvas
│           │       └── NetworkTopologyMiniCard.tsx   # Topology preview card
│           ├── pages/
│           │   ├── AIInvestigationPage.tsx           # AI automated root cause analysis & diagnostics
│           │   ├── DashboardPage.tsx                 # Main NetworkOps NOC overview dashboard
│           │   ├── DevicesPage.tsx                   # 12-device inventory and search table
│           │   ├── DiagnosticsPage.tsx               # Ping, traceroute, and packet test console
│           │   ├── IncidentsPage.tsx                 # Incident triage and lifecycle management
│           │   ├── SettingsPage.tsx                  # Network alert thresholds & polling config
│           │   └── TopologyPage.tsx                  # Interactive ReactFlow canvas page
│           ├── services/
│           │   ├── demoNetworkService.ts             # Demo data switcher and fallbacks
│           │   ├── networkDiagnosticService.ts       # Diagnostic execution & verification client
│           │   └── networkService.ts                 # Primary REST API client for backend endpoints
│           ├── styles/
│           │   ├── dashboard.css                     # Grid layouts and widget styles
│           │   ├── global.css                        # CSS reset scoped under .nx-root
│           │   └── variables.css                     # Color tokens, glass tints, border radii
│           └── types/
│               └── network.ts                        # TypeScript interfaces for devices, nodes, incidents
├── reference/                                        # Shared Clarix AI host files (read-only reference)
│   ├── App.tsx                                       # Lazy route definitions for /network and /network/*
│   ├── AppShell.tsx                                  # Title isolation preventing console title overwrite
│   ├── navItems.ts                                   # Glass sidebar definitions for 7 Network sub-items
│   ├── package.json                                  # Host dependencies and npm scripts
│   ├── README.md                                     # Root project documentation and endpoint catalog
│   ├── vite.config.ts                                # PostCSS prefix-selector scoping rule
│   └── .env.example                                  # VITE_API_BASE host configuration
└── INTEGRATION.md                                    # This integration guide
```

---

## 2. Reference Files: Exact Network Lines & Integration Analysis

The `reference/` directory preserves the exact host files from which NetworkOps was unbundled. Below are the precise line numbers, code snippets, and explanations for each file:

### 1. `reference/App.tsx`
- **Line 17**: Dynamic lazy import of the Network route component:
  ```tsx
  const Network = lazy(() => import('./pages/Network'));
  ```
- **Lines 47–48**: Route mounting under `<Routes>` in `<AppShell>`:
  ```tsx
  <Route path="/network" element={<Network />} />
  <Route path="/network/*" element={<Network />} />
  ```
  *Why both routes?* `/network` lands on the default sub-route (`/network/dashboard`), while `/network/*` delegates child route handling (`/network/topology`, `/network/devices`, `/network/incidents`, `/network/investigation`, `/network/diagnostics`, `/network/settings`) to `<NetworkApp />`.

### 2. `reference/navItems.ts`
- **Line 16**: Icon import from `lucide-react`:
  ```ts
  Network,
  ```
- **Lines 76–88**: Network navigation entry in `CONSOLE_NAV`:
  ```ts
  {
    path: '/network',
    label: 'Network',
    icon: Network,
    children: [
      { path: '/network/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/network/topology', label: 'Network Topology', icon: Network },
      { path: '/network/devices', label: 'Devices', icon: Server },
      { path: '/network/incidents', label: 'Incidents', icon: AlertOctagon },
      { path: '/network/investigation', label: 'AI Investigation', icon: Sparkles },
      { path: '/network/diagnostics', label: 'Diagnostics', icon: ActivitySquare },
      { path: '/network/settings', label: 'Network Settings', icon: Settings },
    ],
  },
  ```
- **Lines 174–222**: Sidebar section configuration mapping in `useSidebarSections()`:
  Maps the primary `network` key and the 7 child items (`network-dashboard`, `network-topology`, `network-devices`, `network-incidents`, `network-investigation`, `network-diagnostics`, `network-settings`) with their respective icons, paths, and labels for rendering in collapsible glass sub-menus.

### 3. `reference/AppShell.tsx`
- **Lines 18–21**: Document title bypass logic inside the route tracking `useEffect`:
  ```tsx
  useEffect(() => {
    if (!pathname.startsWith('/network')) {
      const item = ALL_NAV.find((n) => n.path === pathname);
      document.title = `${item ? item.label : 'Console'} · Clarix AI`;
    }
    window.scrollTo(0, 0);
    // ...
  }, [pathname]);
  ```
  *Explanation:* When browsing `/network/*`, child pages control their own `document.title` inside `NetworkApp.tsx` (e.g., `Network Operations Center · Clarix AI`, `Network Topology · Clarix AI`). AppShell avoids clobbering the sub-page title.

### 4. `reference/vite.config.ts`
- **Line 3**: PostCSS plugin import:
  ```ts
  import prefixer from 'postcss-prefix-selector';
  ```
- **Lines 8–32**: CSS prefix scoping rule:
  ```ts
  css: {
    postcss: {
      plugins: [
        prefixer({
          prefix: '.nx-root',
          includeFiles: [/src\/network\/styles/],
          transform(prefix, selector, prefixedSelector) {
            if (
              selector === ':root' ||
              selector === 'html, body' ||
              selector === 'body' ||
              selector === 'html' ||
              selector === '#root'
            ) {
              return prefix;
            }
            if (selector.startsWith('*, *::before')) {
              return `${prefix}, ${prefix} *, ${prefix} *::before, ${prefix} *::after`;
            }
            return prefixedSelector;
          },
        }),
      ],
    },
  },
  ```
  *Explanation:* All global CSS rules, variables, and resets inside `src/network/styles/` are automatically prefixed with `.nx-root`. This ensures NetworkOps styles never leak or conflict with the host application's styling.

### 5. `reference/package.json`
- **Line 8**: `"dev:network-backend": "cd ../network-service && .venv/bin/uvicorn networkops.main:app --host 127.0.0.1 --port 8080 --reload"`
- **Line 9**: `"dev:network": "concurrently -n \"fe,net-be\" -c \"cyan,magenta\" \"npm run dev\" \"npm run dev:network-backend\""`
- **Line 10**: `"dev:all": "concurrently -n \"fe,clarix-be,net-be\" -c \"cyan,blue,magenta\" \"npm run dev\" \"cd ../backend && .venv/bin/uvicorn clarix.app:create_app --factory --host 127.0.0.1 --port 8000 --reload\" \"npm run dev:network-backend\""`
- **Line 11**: `"setup:network": "cd ../network-service && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"`
- **Lines 19, 22–24**: Dependencies:
  ```json
  "lucide-react": "^0.460.0",
  "react-router-dom": "^6.28.0",
  "reactflow": "^11.11.4",
  "recharts": "^2.13.3"
  ```
- **Line 31**: DevDependency:
  ```json
  "postcss-prefix-selector": "^2.2.1"
  ```

### 6. `reference/.env.example`
- **Lines 9–10**:
  ```env
  # Network API Base (defaults to http://127.0.0.1:8080)
  VITE_API_BASE=http://127.0.0.1:8080
  ```

### 7. `reference/README.md`
- **Lines 144–148**: NetworkOps feature highlight (Simulated Cisco Infrastructure, 12 devices, native inline routing).
- **Line 158**: Port architecture table: `| **Network Backend** | 8080 | http://127.0.0.1:8080 | NetworkOps REST API & Cisco telemetry |`.
- **Lines 226–250**: Step 3 "Set Up Network Services (NetworkOps)" installation guide.
- **Lines 259–286**: Standalone runner commands (`dev:network-backend`, `dev:network`) and the complete REST API endpoint catalog.

---

## 3. NetworkOps REST API Specification

- **Default Base URL**: `http://127.0.0.1:8080`
- **CORS**: Enabled for all origins (`*`) by default in development mode.
- **Demo Mode**: The API supports two comprehensive demonstration datasets toggled via the `demo_mode` parameter:
  - `healthy` (Demo 1): All 12 Cisco network devices online, 99.98% availability, 0 active incidents.
  - `faulty` (Demo 2): Network incident state with 4 active critical/warning incidents (BGP route flapping on R1, interface CRC errors on SW-001, high CPU on FW-001, and unreachable RAG-SRV).

### Endpoints Table

| Method | Endpoint | Query / Body Parameters | Description |
|---|---|---|---|
| `GET` | `/` | None | Operational status and API metadata |
| `GET` | `/api/network/status` | `demo_mode` (`healthy` \| `faulty`) | Health score, uptime, latency, packet loss, incident counts |
| `GET` | `/api/network/topology` | `demo_mode` (`healthy` \| `faulty`) | 12 ReactFlow nodes (routers, switches, firewalls, servers, endpoints) and interconnecting edges |
| `GET` | `/api/network/devices` | `demo_mode`, `status` (online, degraded, offline, all), `type` (core_switch, distribution_switch, access_switch, firewall, router, endpoint, all) | Inventory list of 12 network devices with telemetry |
| `GET` | `/api/network/devices/{device_id}` | `demo_mode` (query) | Specific device details by device ID or hostname (e.g. `R1`, `SW-001`) |
| `GET` | `/api/network/interfaces` | `device_id` (optional), `demo_mode` | Interface inventory and metrics across devices |
| `GET` | `/api/network/incidents` | `demo_mode`, `severity` (critical, warning, info, all), `status` (active, acknowledged, resolved, all), `category` | Active and historical incident triage log |
| `POST` | `/api/network/diagnose` | JSON body: `{"query": string, "demo_mode": "healthy"\|"faulty"}` | AI diagnostic engine: analyzes topology and returns structured root cause and remediation recommendations |
| `POST` | `/api/network/remediate` | JSON body: `{"incident_id": string, "device_id": string, "proposed_commands": string[], "approved": boolean}` | Stages or executes operator-approved remediation commands |
| `POST` | `/api/network/verify` | JSON body: `{"device_id": string, "command": string, "demo_mode": string}` | Runs simulated ICMP ping / traceroute tests and returns latency, packet loss, and CLI output |

---

## 4. Dependencies & Prerequisites

### Frontend Packages (npm)
Install these packages in the target Vite/React project:

```bash
# Production dependencies
npm install reactflow@^11.11.4 recharts@^2.13.3 lucide-react@^0.460.0 react-router-dom@^6.28.0

# Development dependencies (required for style isolation)
npm install -D postcss-prefix-selector@^2.2.1
```

*Required React runtime:* `react@^18.3.1` and `react-dom@^18.3.1`.

### Backend Requirements (Python)
The backend requires **Python 3.10+**. The dependencies specified in `backend/network-service/requirements.txt` are:
```
fastapi>=0.110.0
uvicorn>=0.28.0
pydantic>=2.6.0
```

---

## 5. How to Run the Backend Standalone

The Python microservice is completely self-contained and has zero dependencies on other services or external databases.

### 1. Setup & Launch
```bash
cd backend/network-service

# Create isolated Python virtual environment
python3 -m venv .venv

# Activate environment
source .venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Start the Uvicorn server on port 8080
uvicorn networkops.main:app --host 127.0.0.1 --port 8080 --reload
```

### 2. Verify with `curl`

Verify operational status:
```bash
curl -s http://127.0.0.1:8080/ | jq .
```
Expected output:
```json
{
  "service": "Clarix NetworkOps API",
  "status": "operational",
  "version": "1.1.0",
  "demo_modes": ["healthy", "faulty"]
}
```

Check healthy network status:
```bash
curl -s "http://127.0.0.1:8080/api/network/status?demo_mode=healthy" | jq .
```

Check faulty network status (Demo 2):
```bash
curl -s "http://127.0.0.1:8080/api/network/status?demo_mode=faulty" | jq .
```

Fetch topology nodes and edges:
```bash
curl -s "http://127.0.0.1:8080/api/network/topology?demo_mode=healthy" | jq '.nodes | length'
# Output: 12
```

Test AI incident diagnosis:
```bash
curl -s -X POST http://127.0.0.1:8080/api/network/diagnose \
  -H "Content-Type: application/json" \
  -d '{"query": "Analyze network faults", "demo_mode": "faulty"}' | jq .
```

Test connectivity verification (ping):
```bash
curl -s -X POST http://127.0.0.1:8080/api/network/verify \
  -H "Content-Type: application/json" \
  -d '{"device_id": "R1", "command": "ping", "demo_mode": "healthy"}' | jq .
```

---

## 6. Step-by-Step Instructions to Integrate into Another Vite/React Project

Follow these steps to integrate NetworkOps into any React + Vite + TypeScript application:

### Step 1: Copy Frontend Code and Assets
1. Copy `frontend/src/network/` into your target project's `src/network/`.
2. Copy `frontend/src/pages/Network.tsx` (and `Network.module.css`) into your project's `src/pages/`.
3. Copy `frontend/public/network-assets/` into your project's `public/network-assets/`.

### Step 2: Configure Environment Variables
In your project's `.env` or `.env.local`, specify the backend URL:
```env
VITE_API_BASE=http://127.0.0.1:8080
```
*(If omitted, `src/network/services/networkService.ts` defaults to `http://127.0.0.1:8080` automatically).*

### Step 3: Configure PostCSS Style Scoping in `vite.config.ts`
To ensure the Network styles and dark theme rules do not leak into the rest of your app, add `postcss-prefix-selector` to your `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import prefixer from 'postcss-prefix-selector';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        prefixer({
          prefix: '.nx-root',
          includeFiles: [/src\/network\/styles/],
          transform(prefix, selector, prefixedSelector) {
            if (
              selector === ':root' ||
              selector === 'html, body' ||
              selector === 'body' ||
              selector === 'html' ||
              selector === '#root'
            ) {
              return prefix;
            }
            if (selector.startsWith('*, *::before')) {
              return `${prefix}, ${prefix} *, ${prefix} *::before, ${prefix} *::after`;
            }
            return prefixedSelector;
          },
        }),
      ],
    },
  },
});
```

### Step 4: Mount the Route in `App.tsx`
Mount `<Network />` with both exact and wildcard paths inside your router:

```tsx
import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const Network = lazy(() => import('./pages/Network'));

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div>Loading NetworkOps...</div>}>
        <Routes>
          {/* Your other routes */}
          <Route path="/network" element={<Network />} />
          <Route path="/network/*" element={<Network />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

### Step 5: Add Navigation Links
Add navigation items pointing to the 7 sub-routes:
- `/network/dashboard` — Network Operations Center overview
- `/network/topology` — Interactive 12-device Cisco topology
- `/network/devices` — Device inventory and status list
- `/network/incidents` — Incident triage and investigation queue
- `/network/investigation` — AI-powered root-cause investigation
- `/network/diagnostics` — Interactive CLI diagnostic console
- `/network/settings` — Thresholds and polling intervals

`<NetworkApp />` provides its own horizontal sub-navigation banner at the top of the view, allowing seamless switching between sub-pages even without external sidebar support.

---

## 7. Discovered Extra Files
During the export scan, the following additional file was identified and included in the export:
- `frontend/src/pages/Network.module.css`: Companion module stylesheet for `Network.tsx`. Included in `frontend/src/pages/Network.module.css` to maintain 1:1 structural parity with the host repository.
