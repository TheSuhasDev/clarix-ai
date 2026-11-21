import { DemoMode, DiagnoseResponse, FaultDetail } from '../types/network';

export class NetworkDiagnosticService {
  public async analyzeNetwork(mode: DemoMode): Promise<DiagnoseResponse> {
    // Deterministic diagnostic reasoning based on current simulated device state
    if (mode === 'healthy') {
      return {
        query: 'Analyze Network Telemetry',
        demo_mode: 'healthy',
        status: 'healthy',
        summary:
          'All Systems Operational. No network fault detected in the available diagnostic evidence. All 12 internal devices are online, link telemetry is nominal with 0% packet loss, and air-gap security controls are active.',
        incident_count: 0,
        incidents: [],
        confidence: 0.99,
        simulated: true,
      };
    }

    const incidents: FaultDetail[] = [
      {
        id: 'FAULT-001',
        device_id: 'R1',
        device_name: 'Router R1',
        severity: 'Critical',
        problem: 'Interface administratively down.',
        root_cause: 'GigabitEthernet0/0 is disabled.',
        evidence: [
          'Interface GigabitEthernet0/0 line protocol is down (administratively down)',
          'Last state change: 48 minutes ago (manual shutdown detected)',
          'OSPF adjacency with Core Switch SW-001 timed out (DeadTimerExpired)',
          '0 packets transmitted across segment Gi0/0',
        ],
        recommended_solution: 'Enable the interface using the suggested Cisco IOS commands.',
        commands: [
          'configure terminal',
          'interface GigabitEthernet0/0',
          'no shutdown',
          'end',
        ],
        expected_result: "Interface line protocol status changes to 'up/up', ping to 192.168.1.1 succeeds with 0% loss.",
      },
      {
        id: 'FAULT-002',
        device_id: 'SW-001',
        device_name: 'SW-001',
        severity: 'Warning',
        problem: 'Incorrect VLAN assignment.',
        root_cause: 'The access port is assigned to an unexpected VLAN.',
        evidence: [
          'Access port Gi1/0/12 tagged for VLAN 99 (Quarantine)',
          'Admin PC expected traffic segment: VLAN 10 (Management)',
          'ARP requests broadcast on VLAN 99 receive 0 responses from management gateway',
        ],
        recommended_solution:
          'Inspect the switchport configuration and assign the correct VLAN after verifying the intended network design.',
        commands: [
          'configure terminal',
          'interface GigabitEthernet1/0/12',
          'switchport mode access',
          'switchport access vlan 10',
          'end',
        ],
        expected_result:
          'Port Gi1/0/12 learned into VLAN 10 forwarding database; management communication restored.',
      },
      {
        id: 'FAULT-003',
        device_id: 'WS-002',
        device_name: 'Workstation 002',
        severity: 'Warning',
        problem: 'Incorrect default gateway.',
        root_cause:
          'The workstation has an incorrect default gateway and cannot reach devices outside its local subnet.',
        evidence: [
          'Workstation IP configuration: IP 192.168.20.102 / 24, Gateway: 192.168.20.254 (Unreachable)',
          'Valid router LAN IP on segment: 192.168.20.1',
          "ICMP echo tests to 192.168.30.10 (LLM Server) fail with 'Destination host unreachable'",
        ],
        recommended_solution: 'Configure the correct gateway after verifying the router\'s LAN IP address.',
        commands: [
          '# Configure correct default gateway on workstation',
          'ip default-gateway 192.168.20.1',
        ],
        expected_result:
          'Inter-subnet routing table updated; packets to 192.168.30.0/24 egress through 192.168.20.1.',
      },
      {
        id: 'FAULT-004',
        device_id: 'RAG-SRV',
        device_name: 'Local RAG Server',
        severity: 'Critical',
        problem: 'Retrieval service unavailable.',
        root_cause:
          'The local retrieval service is not responding. The LLM may be unable to retrieve internal documents.',
        evidence: [
          'HTTP health check GET http://192.168.30.11:6333/health returned Connection Refused',
          'Qdrant vector engine process inactive (dead)',
          'Clarix AI inference requests lacking internal context due to vector search timeout',
        ],
        recommended_solution:
          'Inspect the local RAG service, backend health and connectivity to the local vector database.',
        commands: [
          '# Host Service Remediation',
          'systemctl restart clarix-rag.service',
          'curl -s http://127.0.0.1:6333/health',
        ],
        expected_result:
          'Vector retrieval service restarts on port 6333; embeddings query latency drops to < 15ms.',
      },
    ];

    return {
      query: 'Analyze Network Telemetry',
      demo_mode: 'faulty',
      status: 'faulty',
      summary: 'CLARIX AI – NETWORK INVESTIGATION: Detected 4 critical and warning incidents across the network topology.',
      incident_count: 4,
      incidents,
      confidence: 0.98,
      simulated: true,
    };
  }
}

export const networkDiagnosticService = new NetworkDiagnosticService();
