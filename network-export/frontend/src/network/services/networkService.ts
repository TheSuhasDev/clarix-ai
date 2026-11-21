import {
  NetworkStatus,
  TopologyData,
  Device,
  InterfaceInfo,
  Incident,
  DiagnoseResponse,
  RemediateResponse,
  VerifyResponse,
  DemoMode,
} from '../types/network';
import { demoNetworkService } from './demoNetworkService';
import { networkDiagnosticService } from './networkDiagnosticService';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8080';
const DEFAULT_TIMEOUT_MS = 3500;

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

class NetworkService {
  private backendAvailable: boolean | null = null;

  public async checkBackendHealth(): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/network/status?demo_mode=healthy`, { method: 'GET' }, 1500);
      this.backendAvailable = res.ok;
      return res.ok;
    } catch {
      this.backendAvailable = false;
      return false;
    }
  }

  public isBackendConnected(): boolean {
    return this.backendAvailable ?? false;
  }

  public async getStatus(demoMode: DemoMode = 'healthy'): Promise<{ data: NetworkStatus; isLiveBackend: boolean }> {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/network/status?demo_mode=${demoMode}`);
      if (res.ok) {
        const json = await res.json();
        this.backendAvailable = true;
        return { data: json, isLiveBackend: true };
      }
    } catch {
      this.backendAvailable = false;
    }
    return { data: demoNetworkService.getStatus(demoMode), isLiveBackend: false };
  }

  public async getTopology(demoMode: DemoMode = 'healthy'): Promise<{ data: TopologyData; isLiveBackend: boolean }> {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/network/topology?demo_mode=${demoMode}`);
      if (res.ok) {
        const json = await res.json();
        this.backendAvailable = true;
        return { data: json, isLiveBackend: true };
      }
    } catch {
      this.backendAvailable = false;
    }
    return { data: demoNetworkService.getTopology(demoMode), isLiveBackend: false };
  }

  public async getDevices(
    status?: string,
    type?: string,
    demoMode: DemoMode = 'healthy'
  ): Promise<{ data: Device[]; isLiveBackend: boolean }> {
    try {
      const params = new URLSearchParams({ demo_mode: demoMode });
      if (status && status !== 'all') params.append('status', status);
      if (type && type !== 'all') params.append('type', type);
      const res = await fetchWithTimeout(`${API_BASE}/api/network/devices?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        this.backendAvailable = true;
        return { data: json, isLiveBackend: true };
      }
    } catch {
      this.backendAvailable = false;
    }
    let filtered = demoNetworkService.getDevices(demoMode);
    if (status && status !== 'all') {
      filtered = filtered.filter((d) => d.status.toLowerCase() === status.toLowerCase());
    }
    if (type && type !== 'all') {
      filtered = filtered.filter((d) => d.type.toLowerCase() === type.toLowerCase());
    }
    return { data: filtered, isLiveBackend: false };
  }

  public async getDeviceById(id: string, demoMode: DemoMode = 'healthy'): Promise<Device | undefined> {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/network/devices/${encodeURIComponent(id)}?demo_mode=${demoMode}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    const devices = demoNetworkService.getDevices(demoMode);
    return devices.find((d) => d.id.toLowerCase() === id.toLowerCase() || d.hostname.toLowerCase() === id.toLowerCase());
  }

  public async getInterfaces(deviceId?: string, demoMode: DemoMode = 'healthy'): Promise<Record<string, InterfaceInfo[]>> {
    try {
      const url = deviceId
        ? `${API_BASE}/api/network/interfaces?device_id=${encodeURIComponent(deviceId)}&demo_mode=${demoMode}`
        : `${API_BASE}/api/network/interfaces?demo_mode=${demoMode}`;
      const res = await fetchWithTimeout(url);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    const devices = demoNetworkService.getDevices(demoMode);
    const result: Record<string, InterfaceInfo[]> = {};
    for (const dev of devices) {
      if (!deviceId || dev.id.toLowerCase() === deviceId.toLowerCase()) {
        result[dev.id] = dev.interfaces;
      }
    }
    return result;
  }

  public async getIncidents(
    severity?: string,
    status?: string,
    category?: string,
    demoMode: DemoMode = 'healthy'
  ): Promise<{ data: Incident[]; isLiveBackend: boolean }> {
    try {
      const params = new URLSearchParams({ demo_mode: demoMode });
      if (severity && severity !== 'all') params.append('severity', severity);
      if (status && status !== 'all') params.append('status', status);
      if (category && category !== 'all') params.append('category', category);
      const res = await fetchWithTimeout(`${API_BASE}/api/network/incidents?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        return { data: json, isLiveBackend: true };
      }
    } catch {
      // fallback
    }
    let incidents = demoNetworkService.getIncidents(demoMode);
    if (severity && severity !== 'all') {
      incidents = incidents.filter((i) => i.severity.toLowerCase() === severity.toLowerCase());
    }
    if (status && status !== 'all') {
      incidents = incidents.filter((i) => i.status.toLowerCase() === status.toLowerCase());
    }
    if (category && category !== 'all') {
      incidents = incidents.filter((i) => i.incident_type.toLowerCase() === category.toLowerCase());
    }
    return { data: incidents, isLiveBackend: false };
  }

  public async diagnose(query?: string, demoMode: DemoMode = 'healthy', deviceId?: string): Promise<DiagnoseResponse> {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/network/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query || 'Analyze Network', demo_mode: demoMode, device_id: deviceId }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    return networkDiagnosticService.analyzeNetwork(demoMode);
  }

  public async remediate(
    incidentId: string,
    proposedCommands: string[],
    requireApproval = true,
    deviceId?: string
  ): Promise<RemediateResponse> {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/network/remediate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_id: incidentId,
          device_id: deviceId,
          proposed_commands: proposedCommands,
          require_approval: requireApproval,
          approved: !requireApproval,
        }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    return {
      request_id: `PROP-${Date.now()}`,
      incident_id: incidentId,
      device_id: deviceId,
      status: requireApproval ? 'pending_approval' : 'approved',
      message: requireApproval
        ? 'Remediation proposal generated and queued for operator review. No direct execution occurred.'
        : 'Remediation approved and executed in simulation sandbox.',
      execution_output: !requireApproval
        ? `# Simulated execution applied on ${deviceId || incidentId}:\n` +
          proposedCommands.map((c) => `> ${c}`).join('\n') +
          '\n# Status: SUCCESS (Simulated)'
        : undefined,
      simulated: true,
    };
  }

  public async verify(
    deviceId: string,
    targetIp?: string,
    command = 'ping',
    demoMode: DemoMode = 'healthy'
  ): Promise<VerifyResponse> {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/network/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, target_ip: targetIp, command, demo_mode: demoMode }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    const isFaulty = demoMode === 'faulty';
    const devUpper = deviceId.toUpperCase();
    const hasFault = isFaulty && (devUpper.includes('R1') || devUpper.includes('RAG') || devUpper.includes('WS-002') || devUpper.includes('SW-001'));

    return {
      device_id: deviceId,
      test: command,
      result: hasFault ? 'failed' : 'passed',
      latency_ms: hasFault && (devUpper.includes('R1') || devUpper.includes('RAG')) ? 0.0 : hasFault ? 28.4 : 0.85,
      packet_loss_pct: hasFault && (devUpper.includes('R1') || devUpper.includes('RAG')) ? 100.0 : hasFault ? 18.5 : 0.0,
      raw_output: hasFault && (devUpper.includes('R1') || devUpper.includes('RAG'))
        ? 'Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to target, timeout is 2 seconds:\n.....\nSuccess rate is 0 percent (0/5)'
        : hasFault
        ? 'Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to target, timeout is 2 seconds:\n.!.!.\nSuccess rate is 40 percent (2/5), degraded latency = 28ms'
        : 'Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to target, timeout is 2 seconds:\n!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = 1/1/2 ms',
      simulated: true,
    };
  }
}

export const networkService = new NetworkService();
