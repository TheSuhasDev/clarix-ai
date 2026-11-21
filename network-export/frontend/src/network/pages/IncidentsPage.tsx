import React, { useState } from 'react';
import { IncidentManagementTable } from '../components/incidents/IncidentManagementTable';
import { IncidentDetailModal } from '../components/incidents/IncidentDetailModal';
import { CiscoTerminalModal } from '../components/common/CiscoTerminalModal';
import { Incident } from '../types/network';

interface IncidentsPageProps {
  incidents: Incident[];
  onNavigateToAI: (query: string) => void;
}

export const IncidentsPage: React.FC<IncidentsPageProps> = ({
  incidents,
  onNavigateToAI,
}) => {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalTitle, setTerminalTitle] = useState('');
  const [terminalCommands, setTerminalCommands] = useState<string[]>([]);
  const [terminalId, setTerminalId] = useState('');

  const handleOpenRemediation = (inc: Incident) => {
    setTerminalTitle(`Cisco IOS Remediation: ${inc.id}`);
    setTerminalCommands(inc.cisco_commands);
    setTerminalId(inc.id);
    setTerminalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="workspace-header">
        <div className="workspace-title-box">
          <h1>Network Incidents & Triage</h1>
          <p>
            Filter, triage, and remediate enterprise network degradation and routing anomalies.
          </p>
        </div>
      </div>

      <IncidentManagementTable
        incidents={incidents}
        onSelectIncident={(inc) => setSelectedIncident(inc)}
        onOpenRemediation={handleOpenRemediation}
      />

      <IncidentDetailModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onNavigateToAI={onNavigateToAI}
      />

      <CiscoTerminalModal
        isOpen={terminalOpen}
        onClose={() => setTerminalOpen(false)}
        title={terminalTitle}
        commands={terminalCommands}
        incidentId={terminalId}
        explanation="Staged Cisco IOS CLI commands. Use Request Approval to submit change ticket to NOC queue."
      />
    </div>
  );
};
