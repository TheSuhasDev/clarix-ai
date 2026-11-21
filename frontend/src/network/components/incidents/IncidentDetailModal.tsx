import React, { useState } from 'react';
import { X, AlertOctagon, Copy, Check, ShieldCheck, User, Calendar, Cpu } from 'lucide-react';
import { Incident } from '../../types/network';
import { StatusBadge } from '../common/StatusBadge';
import { networkService } from '../../services/networkService';

interface IncidentDetailModalProps {
  incident: Incident | null;
  onClose: () => void;
  onNavigateToAI: (query: string) => void;
}

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  incident,
  onClose,
  onNavigateToAI,
}) => {
  const [copied, setCopied] = useState(false);
  const [approvalRequested, setApprovalRequested] = useState(false);

  if (!incident) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(incident.cisco_commands.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRequestApproval = async () => {
    try {
      await networkService.remediate(incident.id, incident.cisco_commands, true);
      setApprovalRequested(true);
    } catch {
      setApprovalRequested(true);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(20, 36, 59, 0.35)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="glass-floating specular-rim"
        style={{
          width: '100%',
          maxWidth: '750px',
          background: 'rgba(255, 255, 255, 0.94)',
          border: '1px solid rgba(255, 255, 255, 0.95)',
          borderRadius: '24px',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(23, 107, 255, 0.16)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(23, 107, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(245, 250, 255, 0.7) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertOctagon size={22} color="#F04455" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#14243B', margin: 0 }}>
                  {incident.id} : {incident.incident_type}
                </h3>
                <StatusBadge status={incident.severity} size="sm" />
              </div>
              <span style={{ fontSize: '0.76rem', color: '#5A7189' }}>
                {incident.device_name} ({incident.device_ip})
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(23, 107, 255, 0.06)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#5A7189',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Metadata Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              background: 'rgba(255, 255, 255, 0.7)',
              border: '1px solid rgba(23, 107, 255, 0.1)',
              padding: '14px',
              borderRadius: '16px',
              fontSize: '0.8rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <User size={16} color="#176BFF" />
              <div>
                <div style={{ color: '#7E92A6', fontSize: '0.72rem', fontWeight: 700 }}>Assigned Analyst</div>
                <div style={{ color: '#14243B', fontWeight: 700 }}>{incident.assigned_to}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Calendar size={16} color="#176BFF" />
              <div>
                <div style={{ color: '#7E92A6', fontSize: '0.72rem', fontWeight: 700 }}>Detected Time</div>
                <div style={{ color: '#14243B', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {incident.detected_at}
                </div>
              </div>
            </div>

            <div>
              <div style={{ color: '#7E92A6', fontSize: '0.72rem', fontWeight: 700, marginBottom: '2px' }}>Current Status</div>
              <StatusBadge status={incident.status} size="sm" />
            </div>
          </div>

          {/* Description */}
          <div>
            <div style={{ fontSize: '0.74rem', color: '#7E92A6', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
              Incident Description
            </div>
            <p style={{ fontSize: '0.86rem', color: '#14243B', lineHeight: '1.5', margin: 0 }}>
              {incident.description}
            </p>
          </div>

          {/* Root Cause */}
          {incident.root_cause && (
            <div
              style={{
                background: 'rgba(240, 68, 85, 0.08)',
                borderLeft: '4px solid #F04455',
                padding: '12px 16px',
                borderRadius: '10px',
              }}
            >
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#C22A3A', marginBottom: '4px' }}>
                IDENTIFIED ROOT CAUSE
              </div>
              <div style={{ fontSize: '0.84rem', color: '#821523', fontWeight: 600 }}>{incident.root_cause}</div>
            </div>
          )}

          {/* Cisco IOS Remediation Commands */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.74rem', color: '#7E92A6', fontWeight: 800, textTransform: 'uppercase' }}>
                Remediation Playbook (Cisco IOS)
              </span>
              <button
                onClick={handleCopy}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  color: copied ? '#0E8053' : '#176BFF',
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy Commands'}</span>
              </button>
            </div>
            <pre
              style={{
                background: '#0E1A29',
                border: '1px solid rgba(23, 107, 255, 0.2)',
                borderRadius: '12px',
                padding: '14px 16px',
                color: '#00D9F5',
                fontSize: '0.82rem',
                lineHeight: '1.6',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {incident.cisco_commands.map((cmd, i) => (
                <div key={i}>
                  <span style={{ color: '#5A7189', marginRight: '10px' }}>{i + 1}</span>
                  <span>{cmd}</span>
                </div>
              ))}
            </pre>
          </div>

          {approvalRequested && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(22, 199, 132, 0.12)',
                border: '1px solid rgba(22, 199, 132, 0.35)',
                color: '#0D6843',
                fontSize: '0.82rem',
                fontWeight: 700,
              }}
            >
              <ShieldCheck size={18} />
              <span>Change Request submitted. Awaiting NOC Supervisor approval.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(23, 107, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(245, 250, 255, 0.6) 0%, rgba(255, 255, 255, 0.95) 100%)',
          }}
        >
          <button
            onClick={() => {
              onClose();
              onNavigateToAI(`Why is ${incident.device_name} having ${incident.incident_type}?`);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '9999px',
              background: 'rgba(23, 107, 255, 0.08)',
              border: '1px solid rgba(23, 107, 255, 0.25)',
              color: '#176BFF',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Cpu size={14} />
            <span>Deep Dive in AI Troubleshooter</span>
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 18px',
                borderRadius: '9999px',
                background: 'rgba(255, 255, 255, 0.8)',
                border: '1px solid rgba(23, 107, 255, 0.15)',
                color: '#5A7189',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
            <button
              onClick={handleRequestApproval}
              disabled={approvalRequested}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 20px',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, #176BFF 0%, #00D9F5 100%)',
                color: '#FFFFFF',
                fontSize: '0.82rem',
                fontWeight: 700,
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 4px 14px rgba(23, 107, 255, 0.25)',
                cursor: approvalRequested ? 'not-allowed' : 'pointer',
                opacity: approvalRequested ? 0.6 : 1,
              }}
            >
              <ShieldCheck size={16} />
              <span>{approvalRequested ? 'Approval Requested' : 'Request Change Approval'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
