import React from 'react';
import { X, Server, Activity, Cpu } from 'lucide-react';
import { Device } from '../../types/network';
import { StatusBadge } from '../common/StatusBadge';

interface DeviceDetailsDrawerProps {
  device: Device | null;
  onClose: () => void;
  onDiagnose: (device: Device) => void;
  onTestPing: (device: Device) => void;
}

export const DeviceDetailsDrawer: React.FC<DeviceDetailsDrawerProps> = ({
  device,
  onClose,
  onDiagnose,
  onTestPing,
}) => {
  if (!device) return null;

  return (
    <div
      className="glass-floating specular-rim"
      style={{
        width: '380px',
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.95)',
        borderRadius: '24px',
        padding: '22px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: '0 24px 64px rgba(23, 107, 255, 0.16), 0 4px 16px rgba(20, 36, 59, 0.08)',
        overflowY: 'auto',
        maxHeight: '100%',
        margin: '12px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(23, 107, 255, 0.1) 0%, rgba(0, 217, 245, 0.1) 100%)',
              border: '1px solid rgba(23, 107, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Server size={20} color="#176BFF" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#14243B', margin: 0 }}>{device.hostname}</h3>
            <span style={{ fontSize: '0.74rem', color: '#5A7189', fontFamily: 'var(--font-mono)' }}>
              {device.ip_address}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'rgba(23, 107, 255, 0.06)',
            border: 'none',
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#5A7189',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Status Badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <StatusBadge status={device.status} size="md" />
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: '9999px',
            background: 'rgba(255, 255, 255, 0.8)',
            border: '1px solid rgba(23, 107, 255, 0.15)',
            color: '#5A7189',
            textTransform: 'uppercase',
          }}
        >
          {device.type}
        </span>
        {device.active_alerts > 0 && (
          <span
            style={{
              fontSize: '0.72rem',
              padding: '4px 10px',
              borderRadius: '9999px',
              background: 'rgba(240, 68, 85, 0.12)',
              border: '1px solid rgba(240, 68, 85, 0.3)',
              color: '#C22A3A',
              fontWeight: 800,
            }}
          >
            {device.active_alerts} Alerts
          </span>
        )}
      </div>

      {/* Hardware & Spec Details */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.65)',
          border: '1px solid rgba(23, 107, 255, 0.08)',
          borderRadius: '16px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          fontSize: '0.8rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#7E92A6' }}>Hardware Model:</span>
          <span style={{ color: '#14243B', fontWeight: 600 }}>{device.model}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#7E92A6' }}>Operating System:</span>
          <span style={{ color: '#14243B', fontFamily: 'var(--font-mono)' }}>{device.os_version}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#7E92A6' }}>Physical Location:</span>
          <span style={{ color: '#14243B' }}>{device.location}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#7E92A6' }}>System Uptime:</span>
          <span style={{ color: '#0E8053', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{device.uptime}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#7E92A6' }}>Telemetry Status:</span>
          <span style={{ color: '#176BFF', fontWeight: 600 }}>Connected (Live)</span>
        </div>
      </div>

      {/* Utilization telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.65)',
            border: '1px solid rgba(23, 107, 255, 0.08)',
            borderRadius: '14px',
            padding: '12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#7E92A6', fontWeight: 600, marginBottom: '2px' }}>CPU Load</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: device.cpu_usage > 75 ? '#F04455' : '#176BFF' }}>
            {device.cpu_usage}%
          </div>
        </div>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.65)',
            border: '1px solid rgba(23, 107, 255, 0.08)',
            borderRadius: '14px',
            padding: '12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#7E92A6', fontWeight: 600, marginBottom: '2px' }}>Memory Load</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: device.memory_usage > 75 ? '#F04455' : '#16C784' }}>
            {device.memory_usage}%
          </div>
        </div>
      </div>

      {/* Interfaces List */}
      <div>
        <div
          style={{
            fontSize: '0.74rem',
            color: '#7E92A6',
            fontWeight: 800,
            textTransform: 'uppercase',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Interfaces ({device.interfaces.length})</span>
          <span style={{ fontSize: '0.7rem', color: '#176BFF', fontWeight: 700 }}>Cisco Brief</span>
        </div>

        {device.interfaces.length === 0 ? (
          <div style={{ fontSize: '0.76rem', color: '#7E92A6', fontStyle: 'italic' }}>
            Standard edge workstation port connected to upstream switch.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {device.interfaces.map((iface) => {
              const isDown = iface.status !== 'up';
              return (
                <div
                  key={iface.name}
                  style={{
                    background: isDown ? 'rgba(240, 68, 85, 0.08)' : 'rgba(255, 255, 255, 0.65)',
                    border: isDown ? '1px solid rgba(240, 68, 85, 0.25)' : '1px solid rgba(23, 107, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    fontSize: '0.78rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, color: '#14243B', fontFamily: 'var(--font-mono)' }}>
                      {iface.name}
                    </span>
                    <span
                      style={{
                        color: isDown ? '#C22A3A' : '#0E8053',
                        fontWeight: 800,
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                      }}
                    >
                      {iface.status}
                    </span>
                  </div>
                  {iface.ip_address && (
                    <div style={{ color: '#5A7189', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                      IP: {iface.ip_address}
                    </div>
                  )}
                  {iface.errors !== undefined && iface.errors > 0 && (
                    <div style={{ color: '#C22A3A', fontSize: '0.72rem', marginTop: 2, fontWeight: 600 }}>
                      Errors: {iface.errors} (Packet loss: {iface.packet_loss_pct}%)
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '10px' }}>
        <button
          onClick={() => onDiagnose(device)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '9px 14px',
            borderRadius: '9999px',
            background: 'linear-gradient(135deg, #176BFF 0%, #00D9F5 100%)',
            color: '#FFFFFF',
            fontSize: '0.8rem',
            fontWeight: 700,
            border: '1px solid rgba(255, 255, 255, 0.4)',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(23, 107, 255, 0.25)',
          }}
        >
          <Cpu size={15} />
          <span>AI Diagnose</span>
        </button>

        <button
          onClick={() => onTestPing(device)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '9px 14px',
            borderRadius: '9999px',
            background: 'rgba(22, 199, 132, 0.12)',
            border: '1px solid rgba(22, 199, 132, 0.3)',
            color: '#0E8053',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Activity size={15} />
          <span>Test Ping</span>
        </button>
      </div>
    </div>
  );
};
