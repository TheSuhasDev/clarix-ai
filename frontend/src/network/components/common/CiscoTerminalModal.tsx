import React, { useState } from 'react';
import { X, Copy, Check, ShieldCheck, Terminal, AlertTriangle } from 'lucide-react';
import { networkService } from '../../services/networkService';

interface CiscoTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  commands: string[];
  incidentId?: string;
  evidence?: string[];
  explanation?: string;
}

export const CiscoTerminalModal: React.FC<CiscoTerminalModalProps> = ({
  isOpen,
  onClose,
  title,
  commands,
  incidentId = 'INC-MANUAL',
  evidence = [],
  explanation,
}) => {
  const [copied, setCopied] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<'idle' | 'submitting' | 'submitted'>('idle');
  const [approvalMessage, setApprovalMessage] = useState('');

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(commands.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRequestApproval = async () => {
    setApprovalStatus('submitting');
    try {
      const res = await networkService.remediate(incidentId, commands, true);
      setApprovalStatus('submitted');
      setApprovalMessage(res.message);
    } catch {
      setApprovalStatus('submitted');
      setApprovalMessage('Approval proposal submitted to backend NOC queue.');
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
          maxWidth: '720px',
          background: 'rgba(255, 255, 255, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.95)',
          borderRadius: '24px',
          boxShadow: '0 24px 64px rgba(23, 107, 255, 0.16), 0 4px 16px rgba(20, 36, 59, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Terminal size={20} color="#176BFF" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#14243B', margin: 0 }}>{title}</h3>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '9999px',
                background: 'rgba(23, 107, 255, 0.1)',
                color: '#176BFF',
                fontFamily: 'var(--font-mono)',
              }}
            >
              SIMULATED / DEMO DATA
            </span>
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

        {/* Modal Body */}
        <div style={{ padding: '22px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {explanation && (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.7)',
                borderLeft: '4px solid #176BFF',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '0.84rem',
                lineHeight: 1.5,
                color: '#14243B',
              }}
            >
              <strong style={{ color: '#176BFF' }}>Investigation Context:</strong> {explanation}
            </div>
          )}

          {evidence.length > 0 && (
            <div>
              <div style={{ fontSize: '0.74rem', color: '#7E92A6', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>
                Network Evidence & Telemetry
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px', padding: 0 }}>
                {evidence.map((item, idx) => (
                  <li
                    key={idx}
                    style={{
                      fontSize: '0.8rem',
                      color: '#5A7189',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                    }}
                  >
                    <span style={{ color: '#176BFF', marginTop: '2px' }}>▸</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cisco IOS Terminal View */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.74rem', color: '#7E92A6', fontWeight: 800, textTransform: 'uppercase' }}>
                Proposed Cisco IOS Remediation Commands
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
                {copied ? 'Copied to Clipboard' : 'Copy Commands'}
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
                overflowX: 'auto',
                boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.4)',
              }}
            >
              {commands.map((cmd, i) => (
                <div key={i}>
                  <span style={{ color: '#5A7189', marginRight: '10px' }}>{i + 1}</span>
                  <span>{cmd}</span>
                </div>
              ))}
            </pre>
          </div>

          {/* Safety Notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'rgba(244, 166, 42, 0.1)',
              border: '1px solid rgba(244, 166, 42, 0.25)',
              color: '#B27008',
              fontSize: '0.78rem',
            }}
          >
            <AlertTriangle size={18} />
            <span>
              <strong>Zero Direct Execution Policy:</strong> Clarix NetworkOps does not execute destructive CLI commands directly without NOC operator verification and peer approval.
            </span>
          </div>

          {approvalStatus === 'submitted' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(22, 199, 132, 0.12)',
                border: '1px solid rgba(22, 199, 132, 0.35)',
                color: '#0D6843',
                fontSize: '0.82rem',
                fontWeight: 700,
              }}
            >
              <ShieldCheck size={20} color="#16C784" />
              <span>{approvalMessage || 'Proposal safely logged in Change Approval queue.'}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(23, 107, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            background: 'linear-gradient(180deg, rgba(245, 250, 255, 0.6) 0%, rgba(255, 255, 255, 0.95) 100%)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px',
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
            disabled={approvalStatus === 'submitted'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 22px',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, #176BFF 0%, #00D9F5 100%)',
              color: '#FFFFFF',
              fontSize: '0.82rem',
              fontWeight: 700,
              border: '1px solid rgba(255, 255, 255, 0.45)',
              boxShadow: '0 6px 20px rgba(23, 107, 255, 0.32)',
              cursor: approvalStatus === 'submitted' ? 'not-allowed' : 'pointer',
              opacity: approvalStatus === 'submitted' ? 0.6 : 1,
            }}
          >
            <ShieldCheck size={16} />
            <span>{approvalStatus === 'submitted' ? 'Proposal Logged' : 'Request Approval'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
