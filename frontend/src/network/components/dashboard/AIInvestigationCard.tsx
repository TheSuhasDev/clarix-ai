import React from 'react';
import { Sparkles, ShieldAlert, Cpu } from 'lucide-react';
import { DemoMode } from '../../types/network';

interface AIInvestigationCardProps {
  demoMode: DemoMode;
  onOpenInvestigation: () => void;
  onOpenRemediation: () => void;
}

export const AIInvestigationCard: React.FC<AIInvestigationCardProps> = ({
  demoMode,
  onOpenInvestigation,
  onOpenRemediation,
}) => {
  const isHealthy = demoMode === 'healthy';

  return (
    <div
      className="dashboard-card specular-rim"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      <div className="card-title-row" style={{ marginBottom: 0 }}>
        <h3 className="card-title-text">
          <Sparkles size={18} color="#176BFF" />
          Clarix AI Assistant
        </h3>
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            padding: '3px 9px',
            borderRadius: '9999px',
            background: isHealthy ? 'rgba(22, 199, 132, 0.12)' : 'rgba(240, 68, 85, 0.12)',
            color: isHealthy ? '#0E8053' : '#C22A3A',
            border: `1px solid ${isHealthy ? 'rgba(22, 199, 132, 0.3)' : 'rgba(240, 68, 85, 0.3)'}`,
          }}
        >
          {isHealthy ? 'ENCLAVE HEALTHY' : '4 FAULTS DETECTED'}
        </span>
      </div>

      {/* Robot Illustration in Soft Glass Frame */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '12px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(23, 107, 255, 0.06) 0%, rgba(0, 217, 245, 0.06) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.9)',
          boxShadow: '0 4px 16px rgba(23, 107, 255, 0.05)',
        }}
      >
        <div
          style={{
            width: '68px',
            height: '68px',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1.5px solid rgba(255, 255, 255, 0.95)',
            boxShadow: '0 4px 16px rgba(90, 80, 200, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <img
            src="/network-assets/robot-2.jpg"
            alt="Clarix AI Assistant"
            className="robot-image-contain"
            style={{ objectPosition: '67% 25%' }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/network-assets/robot-dashboard.svg';
            }}
          />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#14243B' }}>
            {isHealthy ? 'Zero Faults in Evidence' : 'Diagnostic Anomalies Found'}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#5A7189', lineHeight: 1.35, marginTop: '2px' }}>
            {isHealthy
              ? 'Local LLM & RAG available. Air-gap boundary fully enforced.'
              : 'Local LLM isolated 4 critical interface & routing issues.'}
          </div>
        </div>
      </div>

      {/* Attribution Statistics */}
      <div>
        <div
          style={{
            fontSize: '0.72rem',
            fontWeight: 800,
            color: '#7E92A6',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            marginBottom: '8px',
          }}
        >
          Root Cause Attribution
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.6)',
            border: '1px solid rgba(23, 107, 255, 0.08)',
          }}
        >
          {/* Mini Bar Graph */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '36px' }}>
            <div
              style={{
                width: '14px',
                height: isHealthy ? '8px' : '20px',
                background: isHealthy ? 'rgba(22, 199, 132, 0.35)' : 'rgba(244, 166, 42, 0.45)',
                borderRadius: '3px',
              }}
              title={isHealthy ? 'Nominal' : 'Switch VLAN: 25%'}
            />
            <div
              style={{
                width: '16px',
                height: isHealthy ? '10px' : '36px',
                background: isHealthy ? 'rgba(22, 199, 132, 0.5)' : '#F04455',
                borderRadius: '3px',
                boxShadow: isHealthy ? 'none' : '0 2px 8px rgba(240, 68, 85, 0.4)',
              }}
              title={isHealthy ? 'Nominal' : 'R1 Gi0/0 Down: 45%'}
            />
            <div
              style={{
                width: '14px',
                height: isHealthy ? '8px' : '26px',
                background: isHealthy ? 'rgba(22, 199, 132, 0.35)' : '#176BFF',
                borderRadius: '3px',
              }}
              title={isHealthy ? 'Nominal' : 'RAG Down: 30%'}
            />
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#14243B', lineHeight: 1.1 }}>
              {isHealthy ? '0' : '4'}{' '}
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: isHealthy ? '#16C784' : '#F04455',
                }}
              >
                {isHealthy ? 'Faults' : 'Active Faults'}
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#5A7189' }}>
              {isHealthy ? 'All devices nominal' : 'Telemetry anomaly alert'}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <button
          onClick={onOpenInvestigation}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 12px',
            borderRadius: '9999px',
            background: 'rgba(23, 107, 255, 0.08)',
            border: '1px solid rgba(23, 107, 255, 0.25)',
            color: '#176BFF',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 180ms ease',
          }}
        >
          <Cpu size={14} />
          <span>Clarix AI Analysis</span>
        </button>

        {!isHealthy && (
          <button
            onClick={onOpenRemediation}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '9999px',
              background: 'rgba(240, 68, 85, 0.1)',
              border: '1px solid rgba(240, 68, 85, 0.28)',
              color: '#F04455',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 180ms ease',
            }}
          >
            <ShieldAlert size={14} />
            <span>Remediate (4)</span>
          </button>
        )}
      </div>
    </div>
  );
};
