import React from 'react';
import { Server, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { NetworkStatus } from '../../types/network';

interface DeviceStatisticsProps {
  status: NetworkStatus;
}

export const DeviceStatistics: React.FC<DeviceStatisticsProps> = ({ status }) => {
  return (
    <div className="dashboard-card specular-rim" style={{ padding: '18px' }}>
      <div className="card-title-row" style={{ marginBottom: '14px' }}>
        <h3 className="card-title-text">
          <Server size={18} color="#176BFF" />
          Device Fleet Status
        </h3>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 800,
            padding: '3px 10px',
            borderRadius: '9999px',
            background: 'rgba(23, 107, 255, 0.1)',
            color: '#176BFF',
            letterSpacing: '0.4px',
          }}
        >
          {status.total_devices} TOTAL NODES
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.7)',
            border: '1px solid rgba(23, 107, 255, 0.1)',
            borderRadius: '14px',
            padding: '12px 10px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(23, 107, 255, 0.04)',
          }}
        >
          <div style={{ fontSize: '0.74rem', color: '#5A7189', fontWeight: 600, marginBottom: '4px' }}>
            Total Fleet
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#14243B', fontFamily: 'var(--font-mono)' }}>
            {status.total_devices}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(22, 199, 132, 0.1)',
            border: '1px solid rgba(22, 199, 132, 0.25)',
            borderRadius: '14px',
            padding: '12px 10px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(22, 199, 132, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.74rem', color: '#0E8053', fontWeight: 700, marginBottom: '4px' }}>
            <CheckCircle2 size={13} />
            <span>Online</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0E8053', fontFamily: 'var(--font-mono)' }}>
            {status.online_devices}
          </div>
        </div>

        <div
          style={{
            background: status.offline_devices > 0 ? 'rgba(240, 68, 85, 0.1)' : 'rgba(255, 255, 255, 0.7)',
            border: status.offline_devices > 0 ? '1px solid rgba(240, 68, 85, 0.25)' : '1px solid rgba(23, 107, 255, 0.1)',
            borderRadius: '14px',
            padding: '12px 10px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.74rem', color: status.offline_devices > 0 ? '#C22A3A' : '#5A7189', fontWeight: 700, marginBottom: '4px' }}>
            <XCircle size={13} />
            <span>Offline</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: status.offline_devices > 0 ? '#C22A3A' : '#5A7189', fontFamily: 'var(--font-mono)' }}>
            {status.offline_devices}
          </div>
        </div>

        <div
          style={{
            background: status.error_devices > 0 ? 'rgba(244, 166, 42, 0.12)' : 'rgba(255, 255, 255, 0.7)',
            border: status.error_devices > 0 ? '1px solid rgba(244, 166, 42, 0.3)' : '1px solid rgba(23, 107, 255, 0.1)',
            borderRadius: '14px',
            padding: '12px 10px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.74rem', color: status.error_devices > 0 ? '#B27008' : '#5A7189', fontWeight: 700, marginBottom: '4px' }}>
            <AlertTriangle size={13} />
            <span>Degraded</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: status.error_devices > 0 ? '#B27008' : '#5A7189', fontFamily: 'var(--font-mono)' }}>
            {status.error_devices}
          </div>
        </div>
      </div>
    </div>
  );
};
