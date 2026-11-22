import React, { useState } from 'react';
import { HeaderBanner } from '../components/layout/HeaderBanner';
import { NetworkHealthCard } from '../components/dashboard/NetworkHealthCard';
import { NetworkTopologyMiniCard } from '../components/dashboard/NetworkTopologyMiniCard';
import { IncidentSummaryCards } from '../components/dashboard/IncidentSummaryCards';
import { RecentIncidentsTable } from '../components/dashboard/RecentIncidentsTable';
import { AIInvestigationCard } from '../components/dashboard/AIInvestigationCard';
import { IncidentVolumeTimeline } from '../components/dashboard/IncidentVolumeTimeline';
import { IncidentTrendChart } from '../components/charts/IncidentTrendChart';
import { CiscoTerminalModal } from '../components/common/CiscoTerminalModal';
import { IncidentDetailModal } from '../components/incidents/IncidentDetailModal';
import { HumanApprovalModal } from '../components/common/HumanApprovalModal';
import {
  NetworkStatus,
  TopologyData,
  Incident,
  NavigationPage,
  DemoMode,
} from '../types/network';

interface DashboardPageProps {
  status: NetworkStatus;
  topology: TopologyData;
  incidents: Incident[];
  demoMode: DemoMode;
  onSelectDemoMode: (mode: DemoMode) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onNavigate: (page: NavigationPage) => void;
  onNavigateToAI: (query: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  status,
  topology,
  incidents,
  demoMode,
  onSelectDemoMode,
  onRefresh,
  isRefreshing,
  onNavigate,
  onNavigateToAI,
}) => {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [terminalModalOpen, setTerminalModalOpen] = useState<boolean>(false);
  const [terminalCommands, setTerminalCommands] = useState<string[]>([]);
  const [terminalTitle, setTerminalTitle] = useState<string>('');
  const [terminalIncidentId, setTerminalIncidentId] = useState<string>('FAULT-001');

  // Human Approval State
  const [approvalModalOpen, setApprovalModalOpen] = useState<boolean>(false);
  const [approvalDeviceId, setApprovalDeviceId] = useState<string>('R1');
  const [approvalDeviceName, setApprovalDeviceName] = useState<string>('Router R1');
  const [approvalIncidentId, setApprovalIncidentId] = useState<string>('FAULT-001');
  const [approvalCommands, setApprovalCommands] = useState<string[]>([]);
  const [approvalImpact, setApprovalImpact] = useState<string>('');
  const [approvalProblem, setApprovalProblem] = useState<string>('');

  const handleAIInvestigateClick = () => {
    onNavigateToAI('Analyze Network');
  };

  const handleAIRemediationClick = () => {
    setApprovalDeviceId('R1');
    setApprovalDeviceName('Router R1');
    setApprovalIncidentId('FAULT-001');
    setApprovalCommands([
      'configure terminal',
      'interface GigabitEthernet0/0',
      'no shutdown',
      'end',
    ]);
    setApprovalProblem('Interface GigabitEthernet0/0 is administratively down, breaking default path to Core Switch.');
    setApprovalImpact('Brings interface up/up and restores OSPF adjacency with SW-001 without network downtime.');
    setApprovalModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <HeaderBanner
        title="Network Security Dashboard"
        subtitle="Monitor, investigate, prioritize and resolve network incidents."
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      />

      {/* 3-Column Grid Matching Reference Composition */}
      <div className="dashboard-grid-layout">
        {/* Column 1: Health Score + AI Investigation */}
        <div className="dashboard-column">
          <NetworkHealthCard status={status} />
          <AIInvestigationCard
            demoMode={demoMode}
            onOpenInvestigation={handleAIInvestigateClick}
            onOpenRemediation={handleAIRemediationClick}
          />
        </div>

        {/* Column 2: Center (Topology with DemoSelector + Stat Summary Pills + Incident Table) */}
        <div className="dashboard-column">
          <NetworkTopologyMiniCard
            topology={topology}
            demoMode={demoMode}
            onSelectDemoMode={onSelectDemoMode}
            onAnalyzeWithAI={handleAIInvestigateClick}
            onExpand={() => onNavigate('topology')}
            onSelectNode={() => onNavigate('topology')}
          />
          <IncidentSummaryCards
            status={status}
            onFilterClick={() => onNavigate('incidents')}
          />
          <RecentIncidentsTable
            incidents={incidents}
            onViewAll={() => onNavigate('incidents')}
            onSelectIncident={(inc) => setSelectedIncident(inc)}
          />
        </div>

        {/* Column 3: Incident Timeline + Volume Trend Area Chart */}
        <div className="dashboard-column">
          <IncidentVolumeTimeline
            onStepClick={(title) => {
              setTerminalTitle(`Playbook Step: ${title}`);
              setTerminalCommands([
                'show logging | include Gi0/0',
                'show cdp neighbors detail',
                'show ip route summary',
              ]);
              setTerminalIncidentId('PLAYBOOK-STEP');
              setTerminalModalOpen(true);
            }}
          />
          <IncidentTrendChart />
        </div>
      </div>

      {/* Cisco Terminal Modal */}
      <CiscoTerminalModal
        isOpen={terminalModalOpen}
        onClose={() => setTerminalModalOpen(false)}
        title={terminalTitle}
        commands={terminalCommands}
        incidentId={terminalIncidentId}
        explanation="Proposed Cisco IOS commands staged for change approval. Commands restore disabled interfaces and update operational telemetry."
      />

      {/* Incident Detail Modal */}
      <IncidentDetailModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onNavigateToAI={onNavigateToAI}
      />

      {/* Human Approval Modal */}
      <HumanApprovalModal
        isOpen={approvalModalOpen}
        onClose={() => setApprovalModalOpen(false)}
        deviceId={approvalDeviceId}
        deviceName={approvalDeviceName}
        incidentId={approvalIncidentId}
        proposedCommands={approvalCommands}
        expectedImpact={approvalImpact}
        problemSummary={approvalProblem}
        onActionComplete={onRefresh}
      />
    </div>
  );
};
