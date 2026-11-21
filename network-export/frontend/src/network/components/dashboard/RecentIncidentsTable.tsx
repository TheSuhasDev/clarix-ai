import React from 'react';
import { ExternalLink, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Incident } from '../../types/network';
import { StatusBadge } from '../common/StatusBadge';

interface RecentIncidentsTableProps {
  incidents: Incident[];
  onViewAll: () => void;
  onSelectIncident: (inc: Incident) => void;
}

export const RecentIncidentsTable: React.FC<RecentIncidentsTableProps> = ({
  incidents,
  onViewAll,
  onSelectIncident,
}) => {
  const avatarMap: Record<string, string> = {
    'Sarah Chen': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=60&q=80',
    'Alex Morgan': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=60&q=80',
    'David Lee': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=60&q=80',
    'Elena Rostova': 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=60&q=80',
    'Marcus Vance': 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=60&q=80',
  };

  return (
    <div className="dashboard-card specular-rim incidents-table-card">
      <div className="card-title-row" style={{ marginBottom: '12px' }}>
        <div>
          <h3 className="card-title-text" style={{ fontSize: '0.96rem' }}>
            Network Incidents Management
          </h3>
          <p style={{ fontSize: '0.76rem', color: '#5A7189', margin: '2px 0 0 0' }}>
            {incidents.length > 0
              ? `${incidents.length} active network degradation and fault anomalies`
              : 'All 12 internal network nodes operating with zero incidents'}
          </p>
        </div>

        <button
          onClick={onViewAll}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.78rem',
            color: '#176BFF',
            fontWeight: 700,
            cursor: 'pointer',
            background: 'rgba(23, 107, 255, 0.08)',
            border: '1px solid rgba(23, 107, 255, 0.2)',
            borderRadius: '9999px',
            padding: '5px 12px',
            transition: 'all 180ms ease',
          }}
        >
          <span>View All Incidents</span>
          <ExternalLink size={13} />
        </button>
      </div>

      {incidents.length === 0 ? (
        /* Empty State with Robot-3 / robot-empty artwork */
        <div
          style={{
            padding: '24px 20px',
            background: 'linear-gradient(135deg, rgba(22, 199, 132, 0.08) 0%, rgba(240, 253, 248, 0.7) 100%)',
            border: '1px solid rgba(22, 199, 132, 0.25)',
            borderRadius: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            boxShadow: '0 8px 24px rgba(22, 199, 132, 0.08)',
          }}
        >
          {/* Robot Visual in Glass Orb */}
          <div
            style={{
              width: '88px',
              height: '88px',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1.5px solid rgba(255, 255, 255, 0.95)',
              boxShadow: '0 6px 20px rgba(22, 199, 132, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            <img
              src="/network-assets/robot-3.jpg"
              alt="All Systems Healthy"
              className="robot-image-contain"
              style={{ objectPosition: '62% 35%' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/network-assets/robot-empty.svg';
              }}
            />
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#0D6843',
                fontWeight: 800,
                fontSize: '0.98rem',
              }}
            >
              <CheckCircle2 size={18} color="#16C784" />
              <span>ALL SYSTEMS OPERATIONAL</span>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#325A47', marginTop: '4px', lineHeight: 1.4 }}>
              Zero network incidents detected. All 12 internal network devices are responding normally with 100% SLA availability and strict air-gap boundary enforcement.
            </div>
          </div>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="noc-data-table">
            <thead>
              <tr>
                <th>Assigned Analyst</th>
                <th>Incident ID</th>
                <th>Device / Category</th>
                <th>Severity</th>
                <th>Detected At</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {incidents.slice(0, 4).map((inc) => (
                <tr
                  key={inc.id}
                  onClick={() => onSelectIncident(inc)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img
                        src={
                          avatarMap[inc.assigned_to] ||
                          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'
                        }
                        alt={inc.assigned_to}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '1.5px solid rgba(23, 107, 255, 0.25)',
                        }}
                      />
                      <span style={{ color: '#14243B', fontWeight: 600 }}>
                        {inc.assigned_to}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="incident-id-badge">{inc.id}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#14243B', fontWeight: 600 }}>{inc.incident_type}</span>
                      <span style={{ fontSize: '0.72rem', color: '#5A7189' }}>
                        {inc.device_name} ({inc.device_ip})
                      </span>
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={inc.severity} size="sm" />
                  </td>
                  <td>
                    <span style={{ fontSize: '0.76rem', color: '#5A7189', fontFamily: 'var(--font-mono)' }}>
                      {inc.detected_at}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      style={{
                        padding: '5px 12px',
                        borderRadius: '9999px',
                        background: 'rgba(23, 107, 255, 0.08)',
                        border: '1px solid rgba(23, 107, 255, 0.2)',
                        color: '#176BFF',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        cursor: 'pointer',
                        transition: 'all 180ms ease',
                      }}
                    >
                      <span>Inspect</span>
                      <ChevronRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
