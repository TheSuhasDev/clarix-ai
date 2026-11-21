export type DeviceStatus = 'healthy' | 'warning' | 'critical' | 'offline';
export type DeviceType = 'router' | 'switch' | 'pc' | 'server' | 'firewall' | 'cloud' | 'internet' | 'harness';
export type DemoMode = 'healthy' | 'faulty';

export interface InterfaceInfo {
  name: string;
  ip_address?: string;
  subnet_mask?: string;
  status: 'up' | 'down' | 'administratively down';
  mac_address?: string;
  vlan?: number;
  duplex?: string;
  speed?: string;
  errors?: number;
  packet_loss_pct?: number;
}

export interface Device {
  id: string;
  hostname: string;
  type: DeviceType;
  ip_address: string;
  status: DeviceStatus;
  model: string;
  location: string;
  uptime: string;
  os_version: string;
  interfaces: InterfaceInfo[];
  active_alerts: number;
  cpu_usage: number;
  memory_usage: number;
  role?: string;
}

export interface TopologyNodeData {
  id: string;
  label: string;
  type: DeviceType;
  ip: string;
  status: DeviceStatus;
  position: { x: number; y: number };
  metadata?: Record<string, unknown>;
}

export interface TopologyEdgeData {
  id: string;
  source: string;
  target: string;
  status: 'healthy' | 'failed' | 'degraded';
  bandwidth?: string;
  latency?: string;
  packet_loss?: number;
}

export interface TopologyData {
  nodes: TopologyNodeData[];
  edges: TopologyEdgeData[];
}

export type IncidentSeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Warning';
export type IncidentStatus = 'Open' | 'Investigating' | 'Containment' | 'Resolved';
export type IncidentCategory =
  | 'Interface Down'
  | 'IP Address Conflict'
  | 'Incorrect Subnet Mask'
  | 'Default Gateway Failure'
  | 'Routing Failure'
  | 'DNS Failure'
  | 'DHCP Failure'
  | 'VLAN Mismatch'
  | 'Packet Loss'
  | 'Device Unreachable';

export interface Incident {
  id: string;
  device_id: string;
  device_name: string;
  device_ip: string;
  incident_type: IncidentCategory | string;
  severity: IncidentSeverity;
  detected_at: string;
  status: IncidentStatus;
  assigned_to: string;
  assigned_action: string;
  description: string;
  root_cause?: string;
  cisco_commands: string[];
}

export interface NetworkStatus {
  health_score: number;
  health_rating: 'Excellent' | 'Warning' | 'Critical';
  active_incidents: number;
  critical_incidents: number;
  resolved_today: number;
  avg_resolution_time_min: number;
  availability_pct: number;
  total_devices: number;
  online_devices: number;
  offline_devices: number;
  error_devices: number;
  last_updated: string;
  simulation_mode: boolean;
  demo_mode?: DemoMode;
  status_label?: string;
}

export interface FaultDetail {
  id: string;
  device_id: string;
  device_name: string;
  severity: 'Critical' | 'Warning';
  problem: string;
  root_cause: string;
  evidence: string[];
  recommended_solution: string;
  commands: string[];
  expected_result: string;
}

export interface DiagnoseResponse {
  query: string;
  demo_mode: DemoMode;
  status: 'healthy' | 'faulty';
  summary: string;
  incident_count: number;
  incidents: FaultDetail[];
  confidence: number;
  simulated: boolean;
}

export interface RemediateResponse {
  request_id: string;
  incident_id: string;
  device_id?: string;
  status: 'pending_approval' | 'approved' | 'executed' | 'rejected';
  message: string;
  execution_output?: string;
  simulated: boolean;
}

export interface VerifyResponse {
  device_id: string;
  test: string;
  result: 'passed' | 'failed';
  latency_ms: number;
  packet_loss_pct: number;
  raw_output: string;
  simulated: boolean;
}

export type TimeRangeFilter = '24h' | '7d' | '30d';

export type NavigationPage =
  | 'dashboard'
  | 'topology'
  | 'devices'
  | 'incidents'
  | 'investigation'
  | 'diagnostics'
  | 'settings';
