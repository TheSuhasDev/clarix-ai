import React from 'react';
import { CheckCircle2, Search, AlertTriangle, ShieldCheck, RefreshCw, ChevronDown } from 'lucide-react';

interface IncidentVolumeTimelineProps {
  onStepClick?: (stepTitle: string) => void;
}

export const IncidentVolumeTimeline: React.FC<IncidentVolumeTimelineProps> = ({
  onStepClick,
}) => {
  const steps = [
    {
      title: 'Detection',
      time: '12:00 PM',
      action: 'Resolve',
      status: 'resolve',
      icon: <AlertTriangle size={11} color="#F04455" />,
    },
    {
      title: 'Investigation Started',
      time: '12:07 PM',
      action: 'Monitoring',
      status: 'monitoring',
      icon: <Search size={11} color="#176BFF" />,
    },
    {
      title: 'Fault Confirmed',
      time: '12:22 PM',
      action: 'Resolve',
      status: 'resolve',
      icon: <AlertTriangle size={11} color="#F4A62A" />,
    },
    {
      title: 'Containment Initiated',
      time: '12:28 PM',
      action: 'Detailed',
      status: 'monitoring',
      icon: <ShieldCheck size={11} color="#00D9F5" />,
    },
    {
      title: 'Recovery In Progress',
      time: '01:15 PM',
      action: 'Resolve',
      status: 'resolve',
      icon: <RefreshCw size={11} color="#16C784" />,
    },
    {
      title: 'Resolution Complete',
      time: '02:00 PM',
      action: 'Monitoring',
      status: 'monitoring',
      icon: <CheckCircle2 size={11} color="#16C784" />,
    },
  ];

  return (
    <div className="dashboard-card specular-rim" style={{ padding: '18px' }}>
      <div className="card-title-row" style={{ marginBottom: '10px' }}>
        <div>
          <h3 className="card-title-text" style={{ fontSize: '0.94rem' }}>Incident Playbook</h3>
          <span style={{ fontSize: '0.72rem', color: '#5A7189', fontFamily: 'var(--font-mono)' }}>
            INC-2847 · Interface Recovery
          </span>
        </div>
        <ChevronDown size={15} color="#5A7189" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative', marginTop: '6px' }}>
        {steps.map((step, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.55)',
              border: '1px solid rgba(23, 107, 255, 0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid rgba(23, 107, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(23, 107, 255, 0.08)',
                }}
              >
                {step.icon}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#14243B' }}>
                  {step.title}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#5A7189' }}>
                  {step.time}
                </span>
              </div>
            </div>

            <button
              onClick={() => onStepClick?.(step.title)}
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: '9999px',
                cursor: 'pointer',
                background:
                  step.status === 'resolve'
                    ? 'rgba(22, 199, 132, 0.12)'
                    : 'rgba(23, 107, 255, 0.1)',
                border:
                  step.status === 'resolve'
                    ? '1px solid rgba(22, 199, 132, 0.3)'
                    : '1px solid rgba(23, 107, 255, 0.25)',
                color: step.status === 'resolve' ? '#0E8053' : '#176BFF',
                transition: 'all 180ms ease',
              }}
            >
              {step.action}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
