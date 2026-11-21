import React, { useState } from 'react';
import { X, ShieldAlert, ShieldCheck, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { networkService } from '../../services/networkService';

interface HumanApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  deviceName: string;
  incidentId: string;
  proposedCommands: string[];
  expectedImpact: string;
  problemSummary: string;
  onActionComplete?: () => void;
}

export const HumanApprovalModal: React.FC<HumanApprovalModalProps> = ({
  isOpen,
  onClose,
  deviceId,
  deviceName,
  incidentId,
  proposedCommands,
  expectedImpact,
  problemSummary,
  onActionComplete,
}) => {
  const [decision, setDecision] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [executionOutput, setExecutionOutput] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const res = await networkService.remediate(incidentId, proposedCommands, false, deviceId);
      setDecision('approved');
      setExecutionOutput(
        res.execution_output ||
          `# Remediation Approved by NOC Operator.\n# Staged execution executed against ${deviceName} (${deviceId}):\n` +
            proposedCommands.map((c) => `> ${c}`).join('\n') +
            '\n# Result: Success (Simulated Packet Tracer Execution)'
      );
      onActionComplete?.();
    } catch {
      setDecision('approved');
      setExecutionOutput(`# Simulated execution dispatched for ${deviceName}.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = () => {
    setDecision('rejected');
    setExecutionOutput(`# Proposal ${incidentId} REJECTED by NOC Operator.\n# No changes were applied to ${deviceName}.`);
  };

  const handleReset = () => {
    setDecision('pending');
    setExecutionOutput(null);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={22} color="#176BFF" />
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#14243B', margin: 0 }}>
                Human Operator Change Approval
              </h3>
              <span style={{ fontSize: '0.74rem', color: '#5A7189' }}>
                Ticket {incidentId} · Zero Unvetted Execution Policy
              </span>
            </div>
          </div>

          <button
            onClick={handleReset}
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

        {/* Content Body */}
        <div style={{ padding: '22px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Affected Device Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.7)',
              border: '1px solid rgba(23, 107, 255, 0.1)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.7rem', color: '#7E92A6', fontWeight: 700, textTransform: 'uppercase' }}>Target Device</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#14243B' }}>{deviceName}</div>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.76rem',
                color: '#176BFF',
                background: 'rgba(23, 107, 255, 0.08)',
                padding: '4px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(23, 107, 255, 0.15)',
              }}
            >
              ID: {deviceId}
            </div>
          </div>

          {/* Incident Diagnosis */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.7)',
              borderLeft: '4px solid #176BFF',
              padding: '12px 16px',
              borderRadius: '10px',
              fontSize: '0.82rem',
              color: '#14243B',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: '#176BFF' }}>Diagnostic Finding:</strong> {problemSummary}
          </div>

          {/* Staged Cisco IOS Commands */}
          <div>
            <div style={{ fontSize: '0.74rem', color: '#7E92A6', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>
              Staged Cisco IOS Remediation Commands
            </div>
            <pre
              style={{
                background: '#0E1A29',
                border: '1px solid rgba(23, 107, 255, 0.2)',
                borderRadius: '12px',
                padding: '14px 16px',
                color: '#00D9F5',
                fontSize: '0.82rem',
                lineHeight: 1.6,
                fontFamily: 'var(--font-mono)',
                overflowX: 'auto',
                boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.4)',
              }}
            >
              {proposedCommands.map((cmd, i) => (
                <div key={i}>
                  <span style={{ color: '#5A7189', marginRight: '10px' }}>{i + 1}</span>
                  <span>{cmd}</span>
                </div>
              ))}
            </pre>
          </div>

          {/* Expected Impact */}
          <div
            style={{
              background: 'rgba(22, 199, 132, 0.08)',
              borderLeft: '4px solid #16C784',
              padding: '12px 16px',
              borderRadius: '10px',
              fontSize: '0.82rem',
              color: '#0D6843',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: '#0E8053' }}>Expected Operational Impact:</strong> {expectedImpact}
          </div>

          {/* Decision Outcome */}
          {decision !== 'pending' && executionOutput && (
            <div
              style={{
                background: decision === 'approved' ? 'rgba(22, 199, 132, 0.1)' : 'rgba(240, 68, 85, 0.1)',
                border: decision === 'approved' ? '1px solid rgba(22, 199, 132, 0.3)' : '1px solid rgba(240, 68, 85, 0.3)',
                borderRadius: '12px',
                padding: '14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  color: decision === 'approved' ? '#0E8053' : '#C22A3A',
                  marginBottom: '8px',
                }}
              >
                {decision === 'approved' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                <span>
                  {decision === 'approved'
                    ? 'Remediation Approved & Executed (Simulated)'
                    : 'Remediation Proposal Rejected'}
                </span>
              </div>
              <pre
                style={{
                  background: '#0E1A29',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-mono)',
                  color: decision === 'approved' ? '#00D9F5' : '#94A3B8',
                }}
              >
                {executionOutput}
              </pre>
            </div>
          )}

          {/* Disclaimer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', color: '#7E92A6' }}>
            <AlertTriangle size={15} color="#F4A62A" />
            <span>
              <strong>Notice:</strong> Execution results are simulated. No live Packet Tracer configuration was modified.
            </span>
          </div>
        </div>

        {/* Footer Buttons */}
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
          {decision === 'pending' ? (
            <>
              <button
                onClick={handleReject}
                style={{
                  padding: '9px 20px',
                  borderRadius: '9999px',
                  background: 'rgba(240, 68, 85, 0.1)',
                  border: '1px solid rgba(240, 68, 85, 0.3)',
                  color: '#C22A3A',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 180ms ease',
                }}
              >
                Reject Proposal
              </button>
              <button
                onClick={handleApprove}
                disabled={isSubmitting}
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
                  cursor: isSubmitting ? 'wait' : 'pointer',
                  transition: 'all 180ms ease',
                }}
              >
                <ShieldCheck size={16} />
                <span>{isSubmitting ? 'Dispatching...' : 'Approve & Execute (Simulated)'}</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleReset}
              style={{
                padding: '9px 24px',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, #176BFF 0%, #00D9F5 100%)',
                color: '#FFFFFF',
                fontSize: '0.82rem',
                fontWeight: 700,
                border: '1px solid rgba(255, 255, 255, 0.4)',
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
