import React, { useState } from 'react';
import { Server, Activity, Search, Cpu, Router, GitCommit, Monitor, HardDrive, Shield } from 'lucide-react';
import { Device, DeviceType } from '../types/network';
import { StatusBadge } from '../components/common/StatusBadge';
import { CiscoTerminalModal } from '../components/common/CiscoTerminalModal';
import { networkService } from '../services/networkService';

interface DevicesPageProps {
  devices: Device[];
  onNavigateToAI: (query: string) => void;
}

const getDeviceIcon = (type: DeviceType) => {
  switch (type) {
    case 'router':
      return <Router size={20} color="#176BFF" />;
    case 'switch':
      return <GitCommit size={20} color="#00D9F5" />;
    case 'pc':
      return <Monitor size={20} color="#8174FF" />;
    case 'server':
      return <HardDrive size={20} color="#176BFF" />;
    case 'firewall':
      return <Shield size={20} color="#16C784" />;
    default:
      return <Server size={20} color="#176BFF" />;
  }
};

export const DevicesPage: React.FC<DevicesPageProps> = ({ devices, onNavigateToAI }) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [pingModalOpen, setPingModalOpen] = useState(false);
  const [pingTitle, setPingTitle] = useState('');
  const [pingOutput, setPingOutput] = useState<string[]>([]);

  const filtered = devices.filter((d) => {
    if (filterType !== 'all' && d.type !== filterType) return false;
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        d.hostname.toLowerCase().includes(q) ||
        d.ip_address.toLowerCase().includes(q) ||
        d.model.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleTestPing = async (dev: Device) => {
    const res = await networkService.verify(dev.id, dev.ip_address, 'ping');
    setPingTitle(`Ping ICMP Verification: ${dev.hostname} (${dev.ip_address})`);
    setPingOutput(res.raw_output.split('\n'));
    setPingModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="workspace-header">
        <div className="workspace-title-box">
          <h1>Network Fleet Devices</h1>
          <p>
            Monitored Cisco infrastructure nodes, access switches, endpoints, and server infrastructure.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className="dashboard-card specular-rim"
        style={{
          padding: '14px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              background: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(23, 107, 255, 0.15)',
              borderRadius: '9999px',
              color: '#14243B',
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '6px 14px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Device Types</option>
            <option value="router">Routers</option>
            <option value="switch">Switches</option>
            <option value="firewall">Firewalls</option>
            <option value="server">Servers</option>
            <option value="pc">Workstations (PCs)</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              background: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(23, 107, 255, 0.15)',
              borderRadius: '9999px',
              color: '#14243B',
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '6px 14px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="healthy">Healthy</option>
            <option value="warning">Warning / Degraded</option>
            <option value="critical">Critical / Offline</option>
          </select>
        </div>

        <div className="search-box" style={{ width: '260px' }}>
          <Search size={15} color="#5A7189" />
          <input
            type="text"
            placeholder="Search by hostname, IP, model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Grid of Devices */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
        {filtered.map((dev) => (
          <div
            key={dev.id}
            className="dashboard-card specular-rim"
            style={{
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Card Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '10px',
                    background: 'rgba(23, 107, 255, 0.08)',
                    border: '1px solid rgba(23, 107, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {getDeviceIcon(dev.type)}
                </div>
                <div>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#14243B', margin: 0 }}>{dev.hostname}</h3>
                  <div style={{ fontSize: '0.74rem', color: '#5A7189', fontFamily: 'var(--font-mono)' }}>
                    {dev.ip_address}
                  </div>
                </div>
              </div>

              <StatusBadge status={dev.status} size="sm" />
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.65)',
                border: '1px solid rgba(23, 107, 255, 0.08)',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '0.78rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#7E92A6' }}>Hardware:</span>
                <span style={{ color: '#14243B', fontWeight: 600 }}>{dev.model}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#7E92A6' }}>Location:</span>
                <span style={{ color: '#14243B' }}>{dev.location}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#7E92A6' }}>OS Version:</span>
                <span style={{ color: '#176BFF', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{dev.os_version}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#7E92A6' }}>Uptime:</span>
                <span style={{ color: '#0E8053', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{dev.uptime}</span>
              </div>
            </div>

            {/* Interfaces list */}
            {dev.interfaces.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '0.7rem', color: '#7E92A6', textTransform: 'uppercase', fontWeight: 800 }}>
                  Ports & Links
                </div>
                {dev.interfaces.map((iface) => (
                  <div
                    key={iface.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.74rem',
                      fontFamily: 'var(--font-mono)',
                      padding: '4px 8px',
                      background: 'rgba(255, 255, 255, 0.6)',
                      border: '1px solid rgba(23, 107, 255, 0.06)',
                      borderRadius: '6px',
                    }}
                  >
                    <span style={{ color: '#14243B', fontWeight: 600 }}>{iface.name}</span>
                    <span style={{ color: iface.status === 'up' ? '#0E8053' : '#C22A3A', fontWeight: 800 }}>
                      {iface.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px' }}>
              <button
                onClick={() => onNavigateToAI(`Why is ${dev.hostname} (${dev.ip_address}) reporting issues?`)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '9999px',
                  background: 'linear-gradient(135deg, #176BFF 0%, #00D9F5 100%)',
                  color: '#FFFFFF',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(23, 107, 255, 0.25)',
                }}
              >
                <Cpu size={14} />
                <span>AI Troubleshoot</span>
              </button>

              <button
                onClick={() => handleTestPing(dev)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '9999px',
                  background: 'rgba(22, 199, 132, 0.12)',
                  border: '1px solid rgba(22, 199, 132, 0.3)',
                  color: '#0E8053',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <Activity size={14} />
                <span>Ping</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <CiscoTerminalModal
        isOpen={pingModalOpen}
        onClose={() => setPingModalOpen(false)}
        title={pingTitle}
        commands={pingOutput}
        explanation="Simulated ICMP Echo verification output returned from network device."
      />
    </div>
  );
};
