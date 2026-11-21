import React, { useState } from 'react';
import { NetworkTopologyFlow } from '../components/topology/NetworkTopologyFlow';
import { DeviceStatistics } from '../components/dashboard/DeviceStatistics';
import { DemoSelector } from '../components/topology/DemoSelector';
import { TopologyData, Device, NetworkStatus, DemoMode } from '../types/network';
import { CiscoTerminalModal } from '../components/common/CiscoTerminalModal';
import { networkService } from '../services/networkService';

interface TopologyPageProps {
  topology: TopologyData;
  devices: Device[];
  status: NetworkStatus;
  demoMode: DemoMode;
  onSelectDemoMode: (mode: DemoMode) => void;
  onNavigateToAI: (query: string) => void;
}

export const TopologyPage: React.FC<TopologyPageProps> = ({
  topology,
  devices,
  status,
  demoMode,
  onSelectDemoMode,
  onNavigateToAI,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalCommands, setModalCommands] = useState<string[]>([]);
  const [modalEvidence, setModalEvidence] = useState<string[]>([]);

  const handleDiagnose = (dev: Device) => {
    onNavigateToAI(`Why is ${dev.hostname} (${dev.ip_address}) reporting ${dev.status} status?`);
  };

  const handleTestPing = async (dev: Device) => {
    const res = await networkService.verify(dev.id, dev.ip_address, 'ping', demoMode);
    setModalTitle(`Ping Connectivity Verification: ${dev.hostname}`);
    setModalCommands(res.raw_output.split('\n'));
    setModalEvidence([
      `Target IP: ${dev.ip_address}`,
      `Test outcome: ${res.result.toUpperCase()}`,
      `Packet Loss: ${res.packet_loss_pct}%`,
      `Latency: ${res.latency_ms} ms`,
    ]);
    setModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="workspace-header">
        <div className="workspace-title-box">
          <h1>Interactive Network Topology Mesh</h1>
          <p>
            12-node isolated enclave topology. Choose between Demo 1 (Healthy) and Demo 2 (Faulty) scenarios.
          </p>
        </div>
      </div>

      {/* Demo Selector Component */}
      <DemoSelector
        currentMode={demoMode}
        onSelectMode={onSelectDemoMode}
        onAnalyzeWithAI={() => onNavigateToAI('Analyze Network')}
      />

      <DeviceStatistics status={status} />

      {/* Full Interactive React Flow Canvas */}
      <NetworkTopologyFlow
        topology={topology}
        devices={devices}
        onDiagnoseDevice={handleDiagnose}
        onTestPingDevice={handleTestPing}
      />

      <CiscoTerminalModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        commands={modalCommands}
        evidence={modalEvidence}
        explanation="Simulated ICMP Echo verification executed against target network node."
      />
    </div>
  );
};
