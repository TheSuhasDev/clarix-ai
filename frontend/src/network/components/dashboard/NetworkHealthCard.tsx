import React from 'react';
import { GaugeMeter } from '../common/GaugeMeter';
import { NetworkStatus } from '../../types/network';
import { ShieldCheck, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

interface NetworkHealthCardProps {
  status: NetworkStatus;
}

export const NetworkHealthCard: React.FC<NetworkHealthCardProps> = ({ status }) => {
  return (
    <div
      className="dashboard-card specular-rim"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div className="card-title-row">
        <h3 className="card-title-text">
          <ShieldCheck size={18} color="#176BFF" />
          Network Health
        </h3>
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: '9999px',
            background: 'rgba(23, 107, 255, 0.1)',
            color: '#176BFF',
            letterSpacing: '0.4px',
          }}
        >
          LIVE TELEMETRY
        </span>
      </div>

      {/* Gauge Meter */}
      <GaugeMeter score={status.health_score} label={status.health_rating} size={220} />

      {/* Metrics breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.6)',
            border: '1px solid rgba(23, 107, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#5A7189' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00D9F5' }} />
            <span>Active Cases</span>
          </div>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#14243B' }}>
            {status.active_incidents}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.6)',
            border: '1px solid rgba(23, 107, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#5A7189' }}>
            <AlertCircle size={14} color="#F04455" />
            <span>Critical Incidents</span>
          </div>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: status.critical_incidents > 0 ? '#F04455' : '#16C784' }}>
            {status.critical_incidents}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.6)',
            border: '1px solid rgba(23, 107, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#5A7189' }}>
            <Clock size={14} color="#5A7189" />
            <span>Avg Resolution</span>
          </div>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#14243B' }}>
            {status.avg_resolution_time_min}m
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.6)',
            border: '1px solid rgba(23, 107, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#5A7189' }}>
            <CheckCircle2 size={14} color="#16C784" />
            <span>SLA Availability</span>
          </div>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#16C784' }}>
            {status.availability_pct}%
          </span>
        </div>
      </div>

      {/* Operational Status Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderRadius: '14px',
          background: status.health_score === 100 ? 'rgba(22, 199, 132, 0.1)' : 'rgba(240, 68, 85, 0.1)',
          border: `1px solid ${status.health_score === 100 ? 'rgba(22, 199, 132, 0.25)' : 'rgba(240, 68, 85, 0.25)'}`,
          marginTop: '4px',
        }}
      >
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#5A7189' }}>System State</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: status.health_score === 100 ? '#16C784' : '#F04455',
              boxShadow: `0 0 8px ${status.health_score === 100 ? '#16C784' : '#F04455'}`,
            }}
          />
          <span
            style={{
              fontSize: '0.82rem',
              fontWeight: 800,
              color: status.health_score === 100 ? '#0D6843' : '#A31828',
            }}
          >
            {status.health_score === 100 ? 'ALL SYSTEMS OPERATIONAL' : 'DEGRADED ENCLAVE'}
          </span>
        </div>
      </div>
    </div>
  );
};
