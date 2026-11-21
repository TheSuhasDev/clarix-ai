import {
  DemoMode,
  Device,
  TopologyData,
  NetworkStatus,
  Incident,
} from '../types/network';

// =========================================================================
// 12 BASE DEVICES ARCHITECTURE (IMMUTABLE)
// =========================================================================

const BASE_NODES_COORDS: Record<string, { x: number; y: number }> = {
  'FW-001': { x: 40, y: 220 },
  R1: { x: 220, y: 130 },
  R2: { x: 220, y: 310 },
  'SW-001': { x: 430, y: 80 },
  'SW-002': { x: 430, y: 220 },
  'SW-003': { x: 430, y: 360 },
  'ADMIN-PC': { x: 670, y: 50 },
  'WS-001': { x: 670, y: 170 },
  'WS-002': { x: 670, y: 250 },
  'LLM-SRV': { x: 670, y: 330 },
  'RAG-SRV': { x: 670, y: 410 },
  HARNESS: { x: 670, y: 490 },
};

// =========================================================================
// DEMO 1 — HEALTHY NETWORK
// =========================================================================

export const DEMO_1_DEVICES: Device[] = [
  {
    id: 'FW-001',
    hostname: 'Firewall FW-001',
    type: 'firewall',
    ip_address: '192.168.0.254',
    status: 'healthy',
    model: 'Cisco Firepower 1120',
    location: 'Perimeter Boundary',
    uptime: '98d 4h 12m',
    os_version: 'FTD 7.2.4',
    active_alerts: 0,
    cpu_usage: 18.2,
    memory_usage: 32.0,
    role: 'Air-Gap Isolation & Edge Firewall (Internet Blocked)',
    interfaces: [
      { name: 'Outside-Eth1/1', ip_address: 'AIR-GAP BLOCKED', status: 'down', errors: 0, packet_loss_pct: 0 },
      { name: 'Inside-Eth1/2', ip_address: '192.168.0.254', status: 'up', duplex: 'Full', speed: '1 Gbps', errors: 0, packet_loss_pct: 0 },
    ],
  },
  {
    id: 'R1',
    hostname: 'Router R1',
    type: 'router',
    ip_address: '192.168.1.1',
    status: 'healthy',
    model: 'Cisco ISR 4331',
    location: 'Core Rack A',
    uptime: '45d 12h 10m',
    os_version: 'Cisco IOS XE 17.06.01a',
    active_alerts: 0,
    cpu_usage: 21.5,
    memory_usage: 36.4,
    role: 'Core Gateway 1',
    interfaces: [
      { name: 'GigabitEthernet0/0', ip_address: '192.168.1.1', status: 'up', vlan: 1, speed: '1 Gbps', errors: 0, packet_loss_pct: 0 },
      { name: 'GigabitEthernet0/1', ip_address: '10.0.0.1', status: 'up', vlan: 10, speed: '1 Gbps', errors: 0, packet_loss_pct: 0 },
    ],
  },
  {
    id: 'R2',
    hostname: 'Router R2',
    type: 'router',
    ip_address: '192.168.2.1',
    status: 'healthy',
    model: 'Cisco ISR 4321',
    location: 'Core Rack B',
    uptime: '45d 12h 10m',
    os_version: 'Cisco IOS XE 17.06.01a',
    active_alerts: 0,
    cpu_usage: 19.2,
    memory_usage: 34.1,
    role: 'Core Gateway 2 (AI Farm Route)',
    interfaces: [
      { name: 'GigabitEthernet0/0', ip_address: '192.168.2.1', status: 'up', vlan: 1, speed: '1 Gbps', errors: 0, packet_loss_pct: 0 },
      { name: 'GigabitEthernet0/1', ip_address: '10.0.0.2', status: 'up', vlan: 10, speed: '1 Gbps', errors: 0, packet_loss_pct: 0 },
    ],
  },
  {
    id: 'SW-001',
    hostname: 'Switch SW-001',
    type: 'switch',
    ip_address: '192.168.10.1',
    status: 'healthy',
    model: 'Cisco Catalyst 9300-48P',
    location: 'Distribution Rack 1',
    uptime: '120d 00h 00m',
    os_version: 'Cisco IOS XE 17.09.01',
    active_alerts: 0,
    cpu_usage: 22.0,
    memory_usage: 38.0,
    role: 'Admin & Core Distribution',
    interfaces: [
      { name: 'Gi1/0/1', status: 'up', vlan: 1, speed: '1 Gbps', errors: 0, packet_loss_pct: 0 },
      { name: 'Gi1/0/12', status: 'up', vlan: 10, speed: '1 Gbps', errors: 0, packet_loss_pct: 0 },
    ],
  },
  {
    id: 'SW-002',
    hostname: 'Switch SW-002',
    type: 'switch',
    ip_address: '192.168.20.1',
    status: 'healthy',
    model: 'Cisco Catalyst 2960-X',
    location: 'Floor Access Rack',
    uptime: '85d 02h 30m',
    os_version: 'Cisco IOS 15.2(7)E',
    active_alerts: 0,
    cpu_usage: 16.4,
    memory_usage: 28.5,
    role: 'Workstation Access Switch',
    interfaces: [
      { name: 'Gi0/1', status: 'up', vlan: 20, speed: '1 Gbps', errors: 0, packet_loss_pct: 0 },
      { name: 'Gi0/2', status: 'up', vlan: 20, speed: '1 Gbps', errors: 0, packet_loss_pct: 0 },
    ],
  },
  {
    id: 'SW-003',
    hostname: 'Switch SW-003',
    type: 'switch',
    ip_address: '192.168.30.1',
    status: 'healthy',
    model: 'Cisco Nexus 93180YC-FX',
    location: 'AI Compute Rack',
    uptime: '92d 14h 20m',
    os_version: 'NX-OS 9.3(8)',
    active_alerts: 0,
    cpu_usage: 24.1,
    memory_usage: 41.2,
    role: 'AI Cluster High-Speed Fabric',
    interfaces: [
      { name: 'Eth1/1', status: 'up', vlan: 30, speed: '10 Gbps', errors: 0, packet_loss_pct: 0 },
      { name: 'Eth1/2', status: 'up', vlan: 30, speed: '10 Gbps', errors: 0, packet_loss_pct: 0 },
      { name: 'Eth1/3', status: 'up', vlan: 30, speed: '10 Gbps', errors: 0, packet_loss_pct: 0 },
    ],
  },
  {
    id: 'ADMIN-PC',
    hostname: 'Admin PC',
    type: 'pc',
    ip_address: '192.168.10.100',
    status: 'healthy',
    model: 'Dell Precision 5820',
    location: 'Security Console Desk',
    uptime: '14d 06h 00m',
    os_version: 'Ubuntu 22.04 LTS (Hardened)',
    active_alerts: 0,
    cpu_usage: 12.5,
    memory_usage: 29.0,
    role: 'SOC Administration & Triage Console',
    interfaces: [{ name: 'eth0', ip_address: '192.168.10.100', status: 'up', vlan: 10 }],
  },
  {
    id: 'WS-001',
    hostname: 'Workstation 001',
    type: 'pc',
    ip_address: '192.168.20.101',
    status: 'healthy',
    model: 'HP Z4 G4 Workstation',
    location: 'Engineering Desk A',
    uptime: '8d 04h 15m',
    os_version: 'Windows 11 Pro Enterprise',
    active_alerts: 0,
    cpu_usage: 14.0,
    memory_usage: 35.0,
    role: 'Engineering Workspace',
    interfaces: [{ name: 'Ethernet0', ip_address: '192.168.20.101', status: 'up', vlan: 20 }],
  },
  {
    id: 'WS-002',
    hostname: 'Workstation 002',
    type: 'pc',
    ip_address: '192.168.20.102',
    status: 'healthy',
    model: 'HP Z4 G4 Workstation',
    location: 'Operations Desk B',
    uptime: '8d 04h 15m',
    os_version: 'Windows 11 Pro Enterprise',
    active_alerts: 0,
    cpu_usage: 15.0,
    memory_usage: 36.0,
    role: 'Operations Workspace',
    interfaces: [{ name: 'Ethernet0', ip_address: '192.168.20.102', status: 'up', vlan: 20 }],
  },
  {
    id: 'LLM-SRV',
    hostname: 'Local LLM Server',
    type: 'server',
    ip_address: '192.168.30.10',
    status: 'healthy',
    model: 'Supermicro 4x NVIDIA A100-80GB',
    location: 'AI Compute Rack Unit 1',
    uptime: '90d 18h 00m',
    os_version: 'Ubuntu 22.04 / CUDA 12.2',
    active_alerts: 0,
    cpu_usage: 46.0,
    memory_usage: 64.0,
    role: 'Local LLM Inference Node (Qwen / Nemotron Ready)',
    interfaces: [{ name: 'ens1f0', ip_address: '192.168.30.10', status: 'up', vlan: 30, speed: '10 Gbps' }],
  },
  {
    id: 'RAG-SRV',
    hostname: 'Local RAG Server',
    type: 'server',
    ip_address: '192.168.30.11',
    status: 'healthy',
    model: 'Dell PowerEdge R750 (Vector Engine)',
    location: 'AI Compute Rack Unit 2',
    uptime: '90d 18h 00m',
    os_version: 'Ubuntu 22.04 / Qdrant Engine',
    active_alerts: 0,
    cpu_usage: 28.5,
    memory_usage: 45.0,
    role: 'Local Vector Store & Document Knowledge Base',
    interfaces: [{ name: 'ens1f0', ip_address: '192.168.30.11', status: 'up', vlan: 30, speed: '10 Gbps' }],
  },
  {
    id: 'HARNESS',
    hostname: 'Clarix AI Harness',
    type: 'harness',
    ip_address: '192.168.30.12',
    status: 'healthy',
    model: 'Clarix Security Gateway & Orchestrator',
    location: 'AI Compute Rack Unit 3',
    uptime: '90d 18h 00m',
    os_version: 'Clarix OS 2.4.1 (Zero-Trust Guard)',
    active_alerts: 0,
    cpu_usage: 22.8,
    memory_usage: 38.2,
    role: 'Agentic Orchestration, Safety Guardrails & Audit Logging',
    interfaces: [{ name: 'ens1f0', ip_address: '192.168.30.12', status: 'up', vlan: 30, speed: '10 Gbps' }],
  },
];

const BASE_EDGES_LIST: { id: string; source: string; target: string; isHighSpeed?: boolean }[] = [
  { id: 'e-fw-r1', source: 'FW-001', target: 'R1' },
  { id: 'e-fw-r2', source: 'FW-001', target: 'R2' },
  { id: 'e-r1-r2', source: 'R1', target: 'R2', isHighSpeed: true },
  { id: 'e-r1-sw1', source: 'R1', target: 'SW-001' },
  { id: 'e-r1-sw2', source: 'R1', target: 'SW-002' },
  { id: 'e-r2-sw3', source: 'R2', target: 'SW-003', isHighSpeed: true },
  { id: 'e-sw1-sw2', source: 'SW-001', target: 'SW-002', isHighSpeed: true },
  { id: 'e-sw1-sw3', source: 'SW-001', target: 'SW-003', isHighSpeed: true },
  { id: 'e-sw1-admin', source: 'SW-001', target: 'ADMIN-PC' },
  { id: 'e-sw2-ws1', source: 'SW-002', target: 'WS-001' },
  { id: 'e-sw2-ws2', source: 'SW-002', target: 'WS-002' },
  { id: 'e-sw3-llm', source: 'SW-003', target: 'LLM-SRV', isHighSpeed: true },
  { id: 'e-sw3-rag', source: 'SW-003', target: 'RAG-SRV', isHighSpeed: true },
  { id: 'e-sw3-harness', source: 'SW-003', target: 'HARNESS', isHighSpeed: true },
];

export const DEMO_1_TOPOLOGY: TopologyData = {
  nodes: DEMO_1_DEVICES.map((d) => ({
    id: d.id,
    label: d.hostname,
    type: d.type,
    ip: d.ip_address,
    status: 'healthy',
    position: BASE_NODES_COORDS[d.id] || { x: 100, y: 100 },
  })),
  edges: BASE_EDGES_LIST.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    status: 'healthy',
    bandwidth: e.isHighSpeed ? '10 Gbps' : '1 Gbps',
    latency: '0.8ms',
    packet_loss: 0.0,
  })),
};

export const DEMO_1_STATUS: NetworkStatus = {
  health_score: 100,
  health_rating: 'Excellent',
  active_incidents: 0,
  critical_incidents: 0,
  resolved_today: 148,
  avg_resolution_time_min: 12,
  availability_pct: 100.0,
  total_devices: 12,
  online_devices: 12,
  offline_devices: 0,
  error_devices: 0,
  last_updated: '2026-11-20 20:15:00 UTC',
  simulation_mode: true,
  demo_mode: 'healthy',
  status_label: 'ALL SYSTEMS OPERATIONAL',
};

// =========================================================================
// DEMO 2 — FAULTY NETWORK
// 4 Injected demonstration faults:
// 1. Router R1: Interface Gi0/0 is administratively down (CRITICAL)
// 2. Switch SW-001: Incorrect VLAN assignment on access port (WARNING)
// 3. Workstation 002: Incorrect default gateway (WARNING)
// 4. Local RAG Server: RAG service unavailable (CRITICAL)
// =========================================================================

export const DEMO_2_DEVICES: Device[] = DEMO_1_DEVICES.map((d) => {
  if (d.id === 'R1') {
    return {
      ...d,
      status: 'critical',
      active_alerts: 1,
      cpu_usage: 84.0,
      memory_usage: 62.0,
      interfaces: [
        {
          name: 'GigabitEthernet0/0',
          ip_address: '192.168.1.1',
          status: 'administratively down',
          vlan: 1,
          speed: '1 Gbps',
          errors: 182,
          packet_loss_pct: 100.0,
        },
        { name: 'GigabitEthernet0/1', ip_address: '10.0.0.1', status: 'up', vlan: 10 },
      ],
    };
  }
  if (d.id === 'SW-001') {
    return {
      ...d,
      status: 'warning',
      active_alerts: 1,
      cpu_usage: 48.0,
      memory_usage: 51.0,
      interfaces: [
        { name: 'Gi1/0/1', status: 'up', vlan: 1 },
        { name: 'Gi1/0/12', status: 'up', vlan: 99, errors: 34, packet_loss_pct: 18.5 }, // FAULT: VLAN 99
      ],
    };
  }
  if (d.id === 'WS-002') {
    return {
      ...d,
      status: 'warning',
      active_alerts: 1,
      cpu_usage: 26.0,
      memory_usage: 44.0,
      interfaces: [
        { name: 'Ethernet0', ip_address: '192.168.20.102', status: 'up', vlan: 20, errors: 12, packet_loss_pct: 15.0 },
      ],
    };
  }
  if (d.id === 'RAG-SRV') {
    return {
      ...d,
      status: 'critical',
      active_alerts: 1,
      cpu_usage: 95.0,
      memory_usage: 88.0,
      interfaces: [
        { name: 'ens1f0', ip_address: '192.168.30.11', status: 'down', vlan: 30, errors: 650, packet_loss_pct: 100.0 },
      ],
    };
  }
  return d;
});

export const DEMO_2_TOPOLOGY: TopologyData = {
  nodes: DEMO_2_DEVICES.map((d) => ({
    id: d.id,
    label: d.hostname,
    type: d.type,
    ip: d.ip_address,
    status: d.status,
    position: BASE_NODES_COORDS[d.id] || { x: 100, y: 100 },
  })),
  edges: BASE_EDGES_LIST.map((e) => {
    const isFailed = e.id === 'e-fw-r1' || e.id === 'e-r1-sw1' || e.id === 'e-sw3-rag';
    const isDegraded = e.id === 'e-sw1-admin' || e.id === 'e-sw2-ws2';
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      status: isFailed ? 'failed' : isDegraded ? 'degraded' : 'healthy',
      bandwidth: e.isHighSpeed ? '10 Gbps' : '1 Gbps',
      latency: isFailed ? 'N/A' : isDegraded ? '28ms' : '0.8ms',
      packet_loss: isFailed ? 100.0 : isDegraded ? 18.5 : 0.0,
    };
  }),
};

export const DEMO_2_STATUS: NetworkStatus = {
  health_score: 62,
  health_rating: 'Critical',
  active_incidents: 4,
  critical_incidents: 2,
  resolved_today: 144,
  avg_resolution_time_min: 24,
  availability_pct: 72.8,
  total_devices: 12,
  online_devices: 10,
  offline_devices: 1,
  error_devices: 1,
  last_updated: '2026-11-20 20:15:00 UTC',
  simulation_mode: true,
  demo_mode: 'faulty',
  status_label: 'CRITICAL ATTENTION REQUIRED (4 FAULTS DETECTED)',
};

export const DEMO_2_INCIDENTS: Incident[] = [
  {
    id: 'FAULT-001',
    device_id: 'R1',
    device_name: 'Router R1',
    device_ip: '192.168.1.1',
    incident_type: 'Interface Down',
    severity: 'Critical',
    detected_at: '02:14 PM',
    status: 'Open',
    assigned_to: 'Sarah Chen',
    assigned_action: 'Bring up interface GigabitEthernet0/0',
    description: 'Interface GigabitEthernet0/0 is administratively down. The interface is disabled, preventing communication through the affected link.',
    root_cause: 'GigabitEthernet0/0 is disabled.',
    cisco_commands: [
      'configure terminal',
      'interface GigabitEthernet0/0',
      'no shutdown',
      'end',
    ],
  },
  {
    id: 'FAULT-002',
    device_id: 'SW-001',
    device_name: 'Switch SW-001',
    device_ip: '192.168.10.1',
    incident_type: 'VLAN Mismatch',
    severity: 'Warning',
    detected_at: '02:08 PM',
    status: 'Investigating',
    assigned_to: 'Alex Morgan',
    assigned_action: 'Inspect switchport configuration and assign correct VLAN',
    description: 'Incorrect VLAN assignment on an access port. The connected workstation is assigned to an unexpected VLAN, affecting communication with the intended network segment.',
    root_cause: 'The access port is assigned to an unexpected VLAN (VLAN 99 Quarantine instead of intended VLAN 10).',
    cisco_commands: [
      'configure terminal',
      'interface GigabitEthernet1/0/12',
      'switchport mode access',
      'switchport access vlan 10',
      'end',
    ],
  },
  {
    id: 'FAULT-003',
    device_id: 'WS-002',
    device_name: 'Workstation 002',
    device_ip: '192.168.20.102',
    incident_type: 'Default Gateway Failure',
    severity: 'Warning',
    detected_at: '01:52 PM',
    status: 'Open',
    assigned_to: 'David Lee',
    assigned_action: 'Configure correct gateway (192.168.20.1)',
    description: 'Incorrect default gateway. The workstation has an incorrect default gateway and cannot reach devices outside its local subnet.',
    root_cause: 'Default gateway is misconfigured as 192.168.20.254 instead of Router LAN IP 192.168.20.1.',
    cisco_commands: [
      '# Configure correct default gateway on workstation',
      'ip default-gateway 192.168.20.1',
    ],
  },
  {
    id: 'FAULT-004',
    device_id: 'RAG-SRV',
    device_name: 'Local RAG Server',
    device_ip: '192.168.30.11',
    incident_type: 'Device Unreachable',
    severity: 'Critical',
    detected_at: '01:45 PM',
    status: 'Open',
    assigned_to: 'Elena Rostova',
    assigned_action: 'Restart local RAG service and verify vector database connectivity',
    description: 'RAG service unavailable. The local retrieval service is not responding. The LLM may be unable to retrieve internal documents.',
    root_cause: 'The local retrieval service is not responding. Port 6333 vector retrieval process has stopped.',
    cisco_commands: [
      '# Host Service Remediation',
      'systemctl restart clarix-rag.service',
      'curl -s http://127.0.0.1:6333/health',
    ],
  },
];

class DemoNetworkService {
  public getDevices(mode: DemoMode): Device[] {
    return mode === 'faulty' ? [...DEMO_2_DEVICES] : [...DEMO_1_DEVICES];
  }

  public getTopology(mode: DemoMode): TopologyData {
    return mode === 'faulty' ? { ...DEMO_2_TOPOLOGY } : { ...DEMO_1_TOPOLOGY };
  }

  public getStatus(mode: DemoMode): NetworkStatus {
    return mode === 'faulty' ? { ...DEMO_2_STATUS } : { ...DEMO_1_STATUS };
  }

  public getIncidents(mode: DemoMode): Incident[] {
    return mode === 'faulty' ? [...DEMO_2_INCIDENTS] : [];
  }
}

export const demoNetworkService = new DemoNetworkService();
