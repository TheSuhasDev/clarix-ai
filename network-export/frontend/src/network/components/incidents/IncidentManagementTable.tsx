import React, { useState } from 'react';
import { Search, Terminal, ChevronRight } from 'lucide-react';
import { Incident, IncidentCategory } from '../../types/network';
import { StatusBadge } from '../common/StatusBadge';

interface IncidentManagementTableProps {
  incidents: Incident[];
  onSelectIncident: (inc: Incident) => void;
  onOpenRemediation: (inc: Incident) => void;
}

export const IncidentManagementTable: React.FC<IncidentManagementTableProps> = ({
  incidents,
  onSelectIncident,
  onOpenRemediation,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const categories: IncidentCategory[] = [
    'Interface Down',
    'IP Address Conflict',
    'Incorrect Subnet Mask',
    'Default Gateway Failure',
    'Routing Failure',
    'DNS Failure',
    'DHCP Failure',
    'VLAN Mismatch',
    'Packet Loss',
    'Device Unreachable',
  ];

  const filtered = incidents.filter((inc) => {
    if (filterSeverity !== 'all' && inc.severity.toLowerCase() !== filterSeverity.toLowerCase()) {
      return false;
    }
    if (filterStatus === 'critical' && inc.severity.toLowerCase() !== 'critical') {
      return false;
    }
    if (filterStatus === 'active' && inc.status.toLowerCase() === 'resolved') {
      return false;
    }
    if (filterStatus === 'resolved' && inc.status.toLowerCase() !== 'resolved') {
      return false;
    }
    if (filterCategory !== 'all' && inc.incident_type !== filterCategory) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        inc.id.toLowerCase().includes(q) ||
        inc.device_name.toLowerCase().includes(q) ||
        inc.device_ip.toLowerCase().includes(q) ||
        inc.incident_type.toLowerCase().includes(q) ||
        inc.assigned_to.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="dashboard-card specular-rim" style={{ padding: '22px' }}>
      {/* Filters & Search Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '18px',
        }}
      >
        {/* Status Pill Tabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'all', label: 'All Incidents' },
            { id: 'critical', label: 'Critical Only' },
            { id: 'active', label: 'Active (Open)' },
            { id: 'resolved', label: 'Resolved' },
          ].map((tab) => {
            const isActive = filterStatus === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  padding: '6px 16px',
                  borderRadius: '9999px',
                  background: isActive ? 'linear-gradient(135deg, #176BFF 0%, #00D9F5 100%)' : 'rgba(255, 255, 255, 0.7)',
                  color: isActive ? '#FFFFFF' : '#5A7189',
                  border: isActive ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgba(23, 107, 255, 0.12)',
                  boxShadow: isActive ? '0 4px 14px rgba(23, 107, 255, 0.28)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 180ms ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Dropdown Filters & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{
              background: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(23, 107, 255, 0.15)',
              borderRadius: '9999px',
              color: '#14243B',
              fontSize: '0.76rem',
              fontWeight: 600,
              padding: '6px 14px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            style={{
              background: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(23, 107, 255, 0.15)',
              borderRadius: '9999px',
              color: '#14243B',
              fontSize: '0.76rem',
              fontWeight: 600,
              padding: '6px 14px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Search Box */}
          <div className="search-box" style={{ width: '220px' }}>
            <Search size={14} color="#5A7189" />
            <input
              type="text"
              placeholder="Search incidents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Incident Data Table */}
      <div className="table-responsive">
        <table className="noc-data-table">
          <thead>
            <tr>
              <th>Incident ID</th>
              <th>Device Name</th>
              <th>Device IP</th>
              <th>Category</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Detected</th>
              <th>Assigned Action</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#5A7189', fontWeight: 600 }}>
                  No incidents match the selected filters.
                </td>
              </tr>
            ) : (
              filtered.map((inc) => (
                <tr
                  key={inc.id}
                  onClick={() => onSelectIncident(inc)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <span className="incident-id-badge">{inc.id}</span>
                  </td>
                  <td>
                    <span style={{ color: '#14243B', fontWeight: 700 }}>{inc.device_name}</span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#5A7189' }}>{inc.device_ip}</span>
                  </td>
                  <td>
                    <span style={{ color: '#176BFF', fontWeight: 600 }}>{inc.incident_type}</span>
                  </td>
                  <td>
                    <StatusBadge status={inc.severity} size="sm" />
                  </td>
                  <td>
                    <StatusBadge status={inc.status} size="sm" />
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: '#5A7189' }}>{inc.detected_at}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.78rem', color: '#14243B' }}>{inc.assigned_action}</span>
                  </td>
                  <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        onClick={() => onOpenRemediation(inc)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '9999px',
                          background: 'rgba(23, 107, 255, 0.08)',
                          border: '1px solid rgba(23, 107, 255, 0.22)',
                          color: '#176BFF',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        <Terminal size={13} />
                        <span>IOS Commands</span>
                      </button>
                      <button
                        onClick={() => onSelectIncident(inc)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: 'rgba(255, 255, 255, 0.7)',
                          border: '1px solid rgba(23, 107, 255, 0.1)',
                          color: '#5A7189',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
