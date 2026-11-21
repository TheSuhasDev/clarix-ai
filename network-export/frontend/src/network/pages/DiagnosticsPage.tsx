import React, { useState } from 'react';
import { Activity, Terminal, Play } from 'lucide-react';
import { networkService } from '../services/networkService';
import { NetworkPerformanceChart } from '../components/charts/NetworkPerformanceChart';

export const DiagnosticsPage: React.FC = () => {
  const [targetDevice, setTargetDevice] = useState<string>('R1');
  const [commandType, setCommandType] = useState<string>('ping');
  const [running, setRunning] = useState<boolean>(false);
  const [output, setOutput] = useState<string>(
    '# Ready for diagnostic execution.\n# Select a target device and test type to initiate verification probe.'
  );

  const handleRunDiagnostic = async () => {
    setRunning(true);
    setOutput(`Executing ${commandType.toUpperCase()} on ${targetDevice}...\nSending probes across simulated Cisco IOS XE telemetry bus...`);
    try {
      const res = await networkService.verify(targetDevice, undefined, commandType);
      setTimeout(() => {
        setOutput(
          `# Target: ${res.device_id}\n# Test: ${res.test.toUpperCase()}\n# Latency: ${res.latency_ms} ms\n# Packet Loss: ${res.packet_loss_pct}%\n# Result: ${res.result.toUpperCase()}\n\n${res.raw_output}`
        );
        setRunning(false);
      }, 700);
    } catch {
      setRunning(false);
      setOutput('Diagnostic timeout or error connecting to device socket.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="workspace-header">
        <div className="workspace-title-box">
          <h1>Network Diagnostics & Probes</h1>
          <p>
            Run ICMP echo tests, traceroute paths, and verify OSPF adjacency convergence.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px' }}>
        {/* Diagnostic Command Form */}
        <div className="dashboard-card specular-rim" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card-title-text" style={{ fontSize: '0.96rem' }}>
            <Activity size={18} color="#176BFF" />
            <span>Diagnostic Probe Suite</span>
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', color: '#7E92A6', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
              Target Cisco Device
            </label>
            <select
              value={targetDevice}
              onChange={(e) => setTargetDevice(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.85)',
                border: '1px solid rgba(23, 107, 255, 0.18)',
                borderRadius: '12px',
                color: '#14243B',
                fontWeight: 600,
                padding: '10px 14px',
                fontSize: '0.84rem',
                outline: 'none',
              }}
            >
              <option value="R1">Router R1 (192.168.1.1) [CRITICAL]</option>
              <option value="R2">Router R2 (10.0.0.2)</option>
              <option value="FW-001">Firewall FW-001 (192.168.0.254)</option>
              <option value="SW-001">Switch SW-001 (192.168.10.1) [WARNING]</option>
              <option value="SW-002">Switch SW-002 (192.168.20.1)</option>
              <option value="SW-003">Switch SW-003 (192.168.30.1)</option>
              <option value="RAG-SRV">Local RAG Server (192.168.30.11) [CRITICAL]</option>
              <option value="LLM-SRV">Local LLM Server (192.168.30.10)</option>
              <option value="WS-002">Workstation 002 (192.168.20.102) [WARNING]</option>
              <option value="ADMIN-PC">Admin PC (192.168.10.100)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', color: '#7E92A6', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
              Test / Diagnostic Type
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { id: 'ping', label: 'ICMP Echo Ping (5 Packets)' },
                { id: 'traceroute', label: 'Traceroute Hop Analysis' },
                { id: 'interface_brief', label: 'Show IP Interface Brief' },
                { id: 'arp_inspect', label: 'ARP Cache Inspection' },
              ].map((opt) => (
                <label
                  key={opt.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    background: commandType === opt.id ? 'rgba(23, 107, 255, 0.1)' : 'rgba(255, 255, 255, 0.6)',
                    border: commandType === opt.id ? '1px solid rgba(23, 107, 255, 0.35)' : '1px solid rgba(23, 107, 255, 0.08)',
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: commandType === opt.id ? '#176BFF' : '#5A7189',
                    cursor: 'pointer',
                    transition: 'all 160ms ease',
                  }}
                >
                  <input
                    type="radio"
                    name="cmdType"
                    checked={commandType === opt.id}
                    onChange={() => setCommandType(opt.id)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleRunDiagnostic}
            disabled={running}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, #176BFF 0%, #00D9F5 100%)',
              color: '#FFFFFF',
              fontSize: '0.82rem',
              fontWeight: 700,
              border: '1px solid rgba(255, 255, 255, 0.45)',
              boxShadow: '0 6px 20px rgba(23, 107, 255, 0.32)',
              cursor: running ? 'wait' : 'pointer',
              marginTop: '6px',
            }}
          >
            <Play size={16} />
            <span>{running ? 'Executing Probes...' : 'Run Diagnostics'}</span>
          </button>
        </div>

        {/* Live Terminal Output Console */}
        <div className="dashboard-card specular-rim" style={{ padding: '22px', display: 'flex', flexDirection: 'column' }}>
          <div className="card-title-row" style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={18} color="#176BFF" />
              <h3 className="card-title-text" style={{ fontSize: '0.96rem' }}>Console Output Stream</h3>
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '9999px',
                background: 'rgba(23, 107, 255, 0.1)',
                color: '#176BFF',
                fontFamily: 'var(--font-mono)',
              }}
            >
              SIMULATED CISCO CLI
            </span>
          </div>

          <pre
            style={{
              flex: 1,
              minHeight: '280px',
              background: '#0E1A29',
              border: '1px solid rgba(23, 107, 255, 0.2)',
              borderRadius: '14px',
              padding: '16px 20px',
              color: '#00D9F5',
              fontSize: '0.82rem',
              lineHeight: 1.6,
              fontFamily: 'var(--font-mono)',
              overflowX: 'auto',
              boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.35)',
            }}
          >
            {output}
          </pre>
        </div>
      </div>

      {/* Network Performance Charts */}
      <NetworkPerformanceChart />
    </div>
  );
};
