import React from 'react';

interface StatusBadgeProps {
  status: 'healthy' | 'warning' | 'critical' | 'offline' | 'Critical' | 'High' | 'Medium' | 'Low' | 'Warning' | 'Open' | 'Investigating' | 'Containment' | 'Resolved';
  size?: 'sm' | 'md';
  showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm', showDot = true }) => {
  const s = status.toLowerCase();

  let bg = 'rgba(23, 107, 255, 0.1)';
  let border = 'rgba(23, 107, 255, 0.25)';
  let color = '#176BFF';
  let dotColor = '#176BFF';

  if (s === 'healthy' || s === 'resolved' || s === 'low') {
    bg = 'rgba(22, 199, 132, 0.12)';
    border = 'rgba(22, 199, 132, 0.3)';
    color = '#0E8053';
    dotColor = '#16C784';
  } else if (s === 'warning' || s === 'medium' || s === 'investigating' || s === 'containment') {
    bg = 'rgba(244, 166, 42, 0.14)';
    border = 'rgba(244, 166, 42, 0.35)';
    color = '#B27008';
    dotColor = '#F4A62A';
  } else if (s === 'critical' || s === 'high' || s === 'open') {
    bg = 'rgba(240, 68, 85, 0.12)';
    border = 'rgba(240, 68, 85, 0.35)';
    color = '#C22A3A';
    dotColor = '#F04455';
  } else if (s === 'offline') {
    bg = 'rgba(90, 113, 137, 0.12)';
    border = 'rgba(90, 113, 137, 0.25)';
    color = '#5A7189';
    dotColor = '#5A7189';
  }

  const isSmall = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: isSmall ? '2px 8px' : '4px 12px',
        borderRadius: '9999px',
        fontSize: isSmall ? '0.72rem' : '0.8rem',
        fontWeight: 700,
        backgroundColor: bg,
        border: `1px solid ${border}`,
        color: color,
        textTransform: 'capitalize',
        letterSpacing: '0.3px',
      }}
    >
      {showDot && (
        <span
          style={{
            width: isSmall ? '6px' : '8px',
            height: isSmall ? '6px' : '8px',
            borderRadius: '50%',
            backgroundColor: dotColor,
            boxShadow: `0 0 6px ${dotColor}`,
          }}
        />
      )}
      {status}
    </span>
  );
};
