/**
 * Real-data Network Telemetry and Topology Service for Clarix AI.
 * Communicates with /api/network/* on the backend when connected,
 * or returns air-gapped mock data in mock mode.
 */
import { config, mock, request } from './client';

export interface NetworkOverview {
  posture: {
    status: 'ISOLATED' | 'NOT_ISOLATED' | 'UNKNOWN' | string;
    isIsolated?: boolean;
    reasons: string[];
    externalIp?: string | null;
    defaultGateway?: string | null;
    dnsServers?: string[];
    firewall?: any;
    guard?: {
      enforcing: boolean;
      blockedEgressCount: number;
    };
    clarixExternalConnections?: number;
    otherExternalConnections?: number;
    egressWatchMode?: string;
    note?: string;
  };
  clarixExternalConnections?: number;
  interfacesUp?: number;
  interfacesTotal?: number;
  externalConnections?: number;
  exposedListeners?: number;
  blockedAttemptsToday?: number;
  totalInterfaces?: number;
  activeSockets?: number;
  listeningPorts?: number;
  blockedAttempts?: number;
  rates?: Record<string, {
    bytesSentSec: number;
    bytesRecvSec: number;
    packetsSentSec: number;
    packetsRecvSec: number;
    errIn: number;
    errOut: number;
    dropIn: number;
    dropOut: number;
  }>;
  services?: Array<{
    name: string;
    role: string;
    port: number;
    status: 'ONLINE' | 'OFFLINE' | 'STANDBY';
    component: string;
  }>;
  limitedVisibility?: boolean;
  egressWatchMode?: string;
  timestamp?: string;
}

export interface NetworkInterface {
  name: string;
  ipv4: string[];
  ipv6: string[];
  mac: string;
  isUp: boolean;
  speedMbps: number;
  mtu: number;
  counters?: {
    bytesSent: number;
    bytesRecv: number;
    packetsSent: number;
    packetsRecv: number;
    errIn: number;
    errOut: number;
    dropIn: number;
    dropOut: number;
  };
}

export interface TrafficTimeseries {
  windowSeconds: number;
  rates: Record<string, {
    bytesSentSec: number;
    bytesRecvSec: number;
    packetsSentSec: number;
    packetsRecvSec: number;
    errIn: number;
    errOut: number;
    dropIn: number;
    dropOut: number;
  }>;
  series: Array<{
    t: string;
    bytesSent: number;
    bytesRecv: number;
  }>;
}

export interface SocketConnection {
  proto: 'TCP' | 'UDP';
  laddr: { ip: string; port: number } | null;
  raddr: { ip: string; port: number } | null;
  status: string;
  pid: number | null;
  procName: string;
  exe: string;
  classification: 'LOOPBACK' | 'LAN' | 'EXTERNAL' | 'ALL';
  isClarix: boolean;
}

export interface ListenerPort {
  proto: 'TCP' | 'UDP';
  port: number;
  ip: string;
  pid: number | null;
  procName: string;
  exe: string;
  isClarix: boolean;
  isWildcard: boolean;
}

export interface LocalServices {
  services: Array<{
    name: string;
    role: string;
    port: number;
    status: 'ONLINE' | 'OFFLINE' | 'STANDBY';
    component: string;
  }>;
}

export interface BlockedConnection {
  t: string;
  destination: string;
  port: number;
  direction: string;
  reason: string;
  component: string;
  enforcedBy: string;
}

export interface BlockedConnectionsResponse {
  total: number;
  items: BlockedConnection[];
}

export interface NetworkMapNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    role?: string;
    port?: number;
    status: string;
    metrics?: string;
    component?: string;
    rule?: string;
    blockedCount?: number;
  };
}

export interface NetworkMapEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  style?: Record<string, any>;
  label?: string;
}

export interface NetworkMapResponse {
  posture: string;
  nodes: NetworkMapNode[];
  edges: NetworkMapEdge[];
  clarixExternalCount: number;
}

// Fallback mock data when running completely disconnected from backend
const MOCK_OVERVIEW: NetworkOverview = {
  posture: {
    status: 'ISOLATED',
    reasons: [],
    externalIp: null,
    defaultGateway: null,
    dnsServers: ['127.0.0.1'],
    firewall: { domainProfile: true, privateProfile: true, publicProfile: true, active: true },
    guard: { enforcing: true, blockedEgressCount: 4 },
    note: 'Air-gap socket guard is actively enforcing fail-closed zero egress.',
  },
  clarixExternalConnections: 0,
  totalInterfaces: 2,
  activeSockets: 18,
  listeningPorts: 4,
  blockedAttempts: 4,
  rates: {
    'Loopback Pseudo-Interface 1': {
      bytesSentSec: 4200,
      bytesRecvSec: 4200,
      packetsSentSec: 15,
      packetsRecvSec: 15,
      errIn: 0,
      errOut: 0,
      dropIn: 0,
      dropOut: 0,
    },
  },
  services: [
    { name: 'Clarix Backend API', role: 'Security Harness & Controller', port: 8000, status: 'ONLINE', component: 'Backend Daemon' },
    { name: 'Clarix Operator Console', role: 'Air-Gapped React Interface', port: 5173, status: 'ONLINE', component: 'Frontend Server' },
    { name: 'Ollama LLM Engine', role: 'Offline Inference', port: 11434, status: 'ONLINE', component: 'Local LLM' },
  ],
  limitedVisibility: false,
  egressWatchMode: 'warn',
  timestamp: new Date().toISOString(),
};

const MOCK_MAP: NetworkMapResponse = {
  posture: 'ISOLATED',
  clarixExternalCount: 0,
  nodes: [
    { id: 'browser', type: 'coreNode', position: { x: 40, y: 140 }, data: { label: 'Operator Browser', role: 'Local Air-Gap UI', status: 'ONLINE', metrics: '127.0.0.1 (Loopback)', component: 'Web Client' } },
    { id: 'frontend', type: 'coreNode', position: { x: 280, y: 140 }, data: { label: 'Vite Frontend Server', role: 'Static Bundle & UI Proxy', port: 5173, status: 'ONLINE', metrics: 'Port 5173', component: 'Frontend Server' } },
    { id: 'backend', type: 'coreNode', position: { x: 520, y: 140 }, data: { label: 'Clarix Backend API', role: 'Security Harness & Controller', port: 8000, status: 'ONLINE', metrics: 'Port 8000', component: 'Backend Daemon' } },
    { id: 'ollama', type: 'aiNode', position: { x: 780, y: 140 }, data: { label: 'Ollama LLM Engine', role: 'Offline Inference', port: 11434, status: 'ONLINE', metrics: 'Port 11434', component: 'Local LLM' } },
    { id: 'sec_injection', type: 'securityNode', position: { x: 380, y: 290 }, data: { label: 'Injection Guard', status: 'ACTIVE', component: 'Injection Scanner', rule: 'SEC-03 Multi-Vector' } },
    { id: 'sec_policy', type: 'securityNode', position: { x: 520, y: 290 }, data: { label: 'Policy Engine', status: 'ACTIVE', component: 'Policy Engine', rule: 'POL-001 - POL-008' } },
    { id: 'sec_approval', type: 'securityNode', position: { x: 660, y: 290 }, data: { label: 'Approval Gate', status: 'ACTIVE', component: 'Human Approval', rule: 'Cryptographic CAS' } },
    { id: 'sec_audit', type: 'securityNode', position: { x: 380, y: 410 }, data: { label: 'Audit Ledger', status: 'VERIFIED', component: 'Audit Log', rule: 'SHA-256 HMAC Chain' } },
    { id: 'sec_integrity', type: 'securityNode', position: { x: 520, y: 410 }, data: { label: 'Integrity Guard', status: 'VERIFIED', component: 'Integrity Daemon', rule: 'POL-006 Lockdown' } },
    { id: 'sec_egress', type: 'egressNode', position: { x: 660, y: 410 }, data: { label: 'Egress Socket Guard', status: 'ENFORCING', component: 'Air-Gap Guard', rule: 'POL-001 Socket Hook', blockedCount: 4 } },
    { id: 'outside_world', type: 'externalNode', position: { x: 960, y: 410 }, data: { label: 'Outside World', role: 'Public Internet & WAN', status: 'BLOCKED', metrics: 'Physical / Link Isolation', component: 'External WAN' } },
  ],
  edges: [
    { id: 'e_browser_fe', source: 'browser', target: 'frontend', animated: true, style: { stroke: '#0284c7', strokeWidth: 2 } },
    { id: 'e_fe_be', source: 'frontend', target: 'backend', animated: true, style: { stroke: '#0284c7', strokeWidth: 2.5 } },
    { id: 'e_be_ollama', source: 'backend', target: 'ollama', animated: true, style: { stroke: '#0284c7', strokeWidth: 2 } },
    { id: 'e_be_inj', source: 'backend', target: 'sec_injection', animated: false, style: { stroke: '#10b981', strokeWidth: 1.5, strokeDasharray: '4,4' } },
    { id: 'e_be_pol', source: 'backend', target: 'sec_policy', animated: false, style: { stroke: '#10b981', strokeWidth: 1.5, strokeDasharray: '4,4' } },
    { id: 'e_be_appr', source: 'backend', target: 'sec_approval', animated: false, style: { stroke: '#10b981', strokeWidth: 1.5, strokeDasharray: '4,4' } },
    { id: 'e_be_aud', source: 'backend', target: 'sec_audit', animated: false, style: { stroke: '#10b981', strokeWidth: 1.5, strokeDasharray: '4,4' } },
    { id: 'e_be_integ', source: 'backend', target: 'sec_integrity', animated: false, style: { stroke: '#10b981', strokeWidth: 1.5, strokeDasharray: '4,4' } },
    { id: 'e_be_egr', source: 'backend', target: 'sec_egress', animated: false, style: { stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '5,5' } },
    { id: 'e_egr_outside', source: 'sec_egress', target: 'outside_world', animated: true, style: { stroke: '#ef4444', strokeWidth: 2.5, strokeDasharray: '4,4' }, label: 'POL-001 SEVERED' },
  ],
};

export const networkService = {
  async getOverview(): Promise<NetworkOverview> {
    if (config.useMocks) return mock(() => MOCK_OVERVIEW);
    return request<NetworkOverview>('/api/network/overview');
  },

  async getInterfaces(): Promise<NetworkInterface[]> {
    if (config.useMocks) {
      return mock(() => [
        {
          name: 'Loopback Pseudo-Interface 1',
          ipv4: ['127.0.0.1'],
          ipv6: ['::1'],
          mac: '',
          isUp: true,
          speedMbps: 1000,
          mtu: 65536,
          counters: {
            bytesSent: 1542000,
            bytesRecv: 1542000,
            packetsSent: 12040,
            packetsRecv: 12040,
            errIn: 0,
            errOut: 0,
            dropIn: 0,
            dropOut: 0,
          },
        },
      ]);
    }
    return request<NetworkInterface[]>('/api/network/interfaces');
  },

  async getTraffic(windowSeconds = 60): Promise<TrafficTimeseries> {
    if (config.useMocks) {
      return mock(() => ({
        windowSeconds,
        rates: MOCK_OVERVIEW.rates || {},
        series: Array.from({ length: 15 }, (_, i) => ({
          t: `12:00:${String(i * 4).padStart(2, '0')}`,
          bytesSent: 1200 + Math.sin(i) * 400,
          bytesRecv: 1200 + Math.sin(i) * 400,
        })),
      }));
    }
    return request<TrafficTimeseries>(`/api/network/traffic?window=${windowSeconds}`);
  },

  async getConnections(scope = 'all'): Promise<SocketConnection[]> {
    if (config.useMocks) {
      return mock(() => [
        { proto: 'TCP', laddr: { ip: '127.0.0.1', port: 8000 }, raddr: { ip: '127.0.0.1', port: 54320 }, status: 'ESTABLISHED', pid: 1420, procName: 'python.exe', exe: 'C:\\Python310\\python.exe', classification: 'LOOPBACK', isClarix: true },
        { proto: 'TCP', laddr: { ip: '127.0.0.1', port: 5173 }, raddr: { ip: '127.0.0.1', port: 54321 }, status: 'ESTABLISHED', pid: 8940, procName: 'node.exe', exe: 'C:\\Program Files\\nodejs\\node.exe', classification: 'LOOPBACK', isClarix: true },
      ]);
    }
    return request<SocketConnection[]>(`/api/network/connections?scope=${scope}`);
  },

  async getListeners(): Promise<ListenerPort[]> {
    if (config.useMocks) {
      return mock(() => [
        { proto: 'TCP', port: 8000, ip: '127.0.0.1', pid: 1420, procName: 'python.exe', exe: 'C:\\Python310\\python.exe', isClarix: true, isWildcard: false },
        { proto: 'TCP', port: 5173, ip: '127.0.0.1', pid: 8940, procName: 'node.exe', exe: 'C:\\Program Files\\nodejs\\node.exe', isClarix: true, isWildcard: false },
        { proto: 'TCP', port: 11434, ip: '127.0.0.1', pid: 3200, procName: 'ollama.exe', exe: 'C:\\Users\\ollama.exe', isClarix: true, isWildcard: false },
      ]);
    }
    return request<ListenerPort[]>('/api/network/listeners');
  },

  async getServices(): Promise<LocalServices> {
    if (config.useMocks) return mock(() => ({ services: MOCK_OVERVIEW.services || [] }));
    return request<LocalServices>('/api/network/services');
  },

  async getBlocked(limit = 100, offset = 0): Promise<BlockedConnectionsResponse> {
    if (config.useMocks) {
      return mock(() => ({
        total: 4,
        items: [
          { t: '12:01:05', destination: 'api.openai.com', port: 443, direction: 'OUTBOUND', reason: 'POL-001 Air-gap block: cloud LLM prohibited', component: 'AirGap Guard', enforcedBy: 'clarix.airgap.guard' },
          { t: '12:02:14', destination: 'telemetry.anthropic.com', port: 443, direction: 'OUTBOUND', reason: 'POL-001 Air-gap block: telemetry severed', component: 'AirGap Guard', enforcedBy: 'clarix.airgap.guard' },
          { t: '12:03:30', destination: '1.1.1.1', port: 53, direction: 'OUTBOUND', reason: 'POL-001 Air-gap block: external DNS forbidden', component: 'AirGap Guard', enforcedBy: 'clarix.airgap.guard' },
          { t: '12:04:18', destination: '8.8.8.8', port: 443, direction: 'OUTBOUND', reason: 'POL-001 Air-gap block: WAN socket dropped', component: 'AirGap Guard', enforcedBy: 'clarix.airgap.guard' },
        ],
      }));
    }
    return request<BlockedConnectionsResponse>(`/api/network/blocked?limit=${limit}&offset=${offset}`);
  },

  async getMap(): Promise<NetworkMapResponse> {
    if (config.useMocks) return mock(() => MOCK_MAP);
    return request<NetworkMapResponse>('/api/network/map');
  },
};
