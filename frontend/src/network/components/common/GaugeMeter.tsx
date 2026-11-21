import React from 'react';

interface GaugeMeterProps {
  score: number;
  label?: string;
  size?: number;
}

export const GaugeMeter: React.FC<GaugeMeterProps> = ({ score, label = 'Optimal', size = 210 }) => {
  const radius = 76;
  const cx = 100;
  const cy = 92;
  const strokeWidth = 12;
  const circumference = Math.PI * radius; // Semi-circle circumference

  const normalizedScore = Math.min(Math.max(score, 0), 100);
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  const getScoreColor = () => {
    if (score >= 80) return '#16C784';
    if (score >= 50) return '#F4A62A';
    return '#F04455';
  };

  return (
    <div style={{ width: size, margin: '8px auto', position: 'relative', textAlign: 'center' }}>
      <div style={{ width: size, height: size * 0.6, position: 'relative' }}>
        <svg
          viewBox="0 0 200 115"
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="liquidBlueGauge" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#176BFF" />
              <stop offset="60%" stopColor="#00D9F5" />
              <stop offset="100%" stopColor="#16C784" />
            </linearGradient>
            <filter id="gaugeSoftGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#00D9F5" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* Background Track with soft glass light */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="rgba(23, 107, 255, 0.1)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Value Progress Arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="url(#liquidBlueGauge)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            filter="url(#gaugeSoftGlow)"
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
        </svg>

        {/* Center Numbers */}
        <div
          style={{
            position: 'absolute',
            bottom: '2px',
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: '2.2rem',
              fontWeight: 800,
              color: '#14243B',
              letterSpacing: '-1px',
              lineHeight: 1,
              fontFamily: 'var(--font-sans)',
            }}
          >
            {score}
            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#5A7189', marginLeft: '2px' }}>
              %
            </span>
          </div>
          <div
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              color: getScoreColor(),
              marginTop: '4px',
            }}
          >
            {label}
          </div>
        </div>
      </div>
    </div>
  );
};
