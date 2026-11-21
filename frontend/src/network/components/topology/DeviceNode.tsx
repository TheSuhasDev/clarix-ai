import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Router, GitCommit, Monitor, HardDrive, Shield, Bot } from 'lucide-react';
import { DeviceType, DeviceStatus } from '../../types/network';

export interface DeviceNodeData {
  label: string;
  type: DeviceType;
  ip: string;
  status: DeviceStatus;
  model?: string;
  alerts?: number;
}

const getDeviceIcon = (type: DeviceType) => {
  switch (type) {
    case 'router':
      return <Router size={18} color="#176BFF" />;
    case 'switch':
      return <GitCommit size={18} color="#00D9F5" />;
    case 'pc':
      return <Monitor size={18} color="#8174FF" />;
    case 'server':
      return <HardDrive size={18} color="#176BFF" />;
    case 'firewall':
      return <Shield size={18} color="#16C784" />;
    case 'harness':
      return <Bot size={18} color="#176BFF" />;
    default:
      return <HardDrive size={18} color="#176BFF" />;
  }
};

export const DeviceNode = memo(({ data, selected }: NodeProps<DeviceNodeData>) => {
  const isCritical = data.status === 'critical';
  const isWarning = data.status === 'warning';

  let borderColor = 'rgba(255, 255, 255, 0.95)';
  let glowShadow = '0 6px 20px rgba(23, 107, 255, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.9)';
  let statusDotColor = '#16C784';
  let statusText = 'Optimal';

  if (isCritical) {
    borderColor = '#F04455';
    glowShadow = '0 8px 24px rgba(240, 68, 85, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.9)';
    statusDotColor = '#F04455';
    statusText = 'Critical';
  } else if (isWarning) {
    borderColor = '#F4A62A';
    glowShadow = '0 8px 24px rgba(244, 166, 42, 0.25), inset 0 1px 2px rgba(255, 255, 255, 0.9)';
    statusDotColor = '#F4A62A';
    statusText = 'Warning';
  }

  if (selected) {
    borderColor = '#176BFF';
    glowShadow = '0 10px 32px rgba(23, 107, 255, 0.35), inset 0 1px 2px rgba(255, 255, 255, 1)';
  }

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        border: `1.5px solid ${borderColor}`,
        borderRadius: '16px',
        padding: '12px 16px',
        minWidth: '168px',
        boxShadow: glowShadow,
        transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#176BFF', width: 7, height: 7, border: '2px solid #FFFFFF' }} />
      <Handle type="target" position={Position.Left} style={{ background: '#176BFF', width: 7, height: 7, border: '2px solid #FFFFFF' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(23, 107, 255, 0.1) 0%, rgba(0, 217, 245, 0.1) 100%)',
            border: '1px solid rgba(23, 107, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {getDeviceIcon(data.type)}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '2px 8px',
            borderRadius: '9999px',
            background: isCritical
              ? 'rgba(240, 68, 85, 0.12)'
              : isWarning
              ? 'rgba(244, 166, 42, 0.12)'
              : 'rgba(22, 199, 132, 0.12)',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: statusDotColor,
              boxShadow: `0 0 6px ${statusDotColor}`,
            }}
          />
          <span
            style={{
              fontSize: '0.66rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              color: statusDotColor,
            }}
          >
            {statusText}
          </span>
        </div>
      </div>

      <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#14243B', letterSpacing: '-0.2px' }}>
        {data.label}
      </div>

      <div
        style={{
          fontSize: '0.72rem',
          color: '#5A7189',
          fontFamily: 'var(--font-mono)',
          marginTop: '3px',
        }}
      >
        {data.ip}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: '#176BFF', width: 7, height: 7, border: '2px solid #FFFFFF' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#176BFF', width: 7, height: 7, border: '2px solid #FFFFFF' }} />
    </div>
  );
});

DeviceNode.displayName = 'DeviceNode';
