import { useEffect, useState } from 'react';
import { ShieldAlert, AlertTriangle, RefreshCw, Key, X } from 'lucide-react';
import { auditService, type IntegrityStatus } from '../../services';
import { useConsole } from '../../state/ConsoleContext';

const REBASELINE_PHRASE = 'I CONFIRM REBASELINE OF SECURITY STATE';

export function SystemLockedOverlay() {
  const { toast } = useConsole();
  const [locked, setLocked] = useState(false);
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [detectedAt, setDetectedAt] = useState<string>('');
  const [dismissed, setDismissed] = useState(false);

  // Recovery modal state
  const [recoverModalOpen, setRecoverModalOpen] = useState(false);
  const [mode, setMode] = useState<'restore_snapshot' | 'rebaseline'>('rebaseline');
  const [recReason, setRecReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [adminToken, setAdminToken] = useState('admin-token-demo');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Check integrity status
  async function refreshStatus() {
    try {
      const st: IntegrityStatus = await auditService.getIntegrityStatus();
      if (st.locked) {
        setLocked(true);
        if (st.reason) setReason(st.reason);
        if (st.evidence) setEvidence(st.evidence);
        if (st.last_checked) setDetectedAt(st.last_checked);
      } else {
        setLocked(false);
        setDismissed(false);
      }
    } catch {
      // ignore network errors on poll
    }
  }

  useEffect(() => {
    refreshStatus();
    // Poll fast: 2.5s matching backend checker
    const timer = setInterval(refreshStatus, 2500);

    const onLockedEvent = (ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      setLocked(true);
      setDismissed(false);
      if (detail?.reason) setReason(detail.reason);
      if (detail?.evidence) setEvidence(detail.evidence);
      setDetectedAt(new Date().toLocaleTimeString());
    };

    window.addEventListener('clarix:system_locked', onLockedEvent);
    return () => {
      clearInterval(timer);
      window.removeEventListener('clarix:system_locked', onLockedEvent);
    };
  }, []);

  async function handleRecover() {
    setErrorMsg('');
    const trimmedReason = recReason.trim();
    if (!trimmedReason || trimmedReason.length < 20) {
      setErrorMsg(`A detailed security justification of at least 20 characters is mandatory. Current length: ${trimmedReason.length}`);
      return;
    }
    if (mode === 'rebaseline' && confirmation.trim() !== REBASELINE_PHRASE) {
      setErrorMsg(`Confirmation phrase mismatch. Enter exactly: "${REBASELINE_PHRASE}"`);
      return;
    }

    setSubmitting(true);
    try {
      await auditService.recoverIntegrity(mode, trimmedReason, confirmation.trim());
      toast('System unlocked and integrity rebaselined successfully.', 'green');
      setRecoverModalOpen(false);
      setLocked(false);
      setDismissed(false);
      setRecReason('');
      setConfirmation('');
      await refreshStatus();
    } catch (e: any) {
      setErrorMsg(e.message || 'Recovery failed. Check server logs.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!locked || dismissed) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(25, 0, 0, 0.94)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="lockdown-title"
    >
      <div
        style={{
          maxWidth: '760px',
          width: '100%',
          backgroundColor: '#1b0808',
          border: '2px solid #ef4444',
          borderRadius: '12px',
          padding: '30px',
          boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #ef4444',
              flexShrink: 0,
            }}
          >
            <ShieldAlert width={32} height={32} color="#ef4444" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                FAIL-CLOSED ACTIVE
              </span>
              <span style={{ color: '#fca5a5', fontSize: '0.8rem', fontWeight: 600 }}>
                POL-006 Cryptographic Tamper Lockdown
              </span>
              {detectedAt && (
                <span style={{ color: '#94a3b8', fontSize: '0.74rem', marginLeft: 'auto' }}>
                  Detected: {detectedAt}
                </span>
              )}
            </div>
            <h2 id="lockdown-title" style={{ margin: '6px 0 0 0', fontSize: '1.45rem', fontWeight: 700, color: '#fef2f2' }}>
              SYSTEM LOCKED — Unauthorized Modification Detected
            </h2>
          </div>
        </div>

        <p style={{ color: '#fecaca', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 16px 0' }}>
          Clarix AI cryptographic integrity monitoring detected an out-of-band modification bypassing the audited API.
          Under security policy <strong>POL-006</strong>, the entire environment has entered <strong>fail-closed lockdown</strong> to prevent classified document exfiltration or compromised reasoning.
        </p>

        {/* Plain English Explanation */}
        {reason && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '0.76rem', textTransform: 'uppercase', color: '#fca5a5', fontWeight: 700, marginBottom: '4px' }}>
              What was modified (Plain English):
            </div>
            <div style={{ backgroundColor: '#2d0a0a', border: '1px solid #7f1d1d', borderRadius: '6px', padding: '10px 14px', color: '#fee2e2', fontSize: '0.88rem', fontWeight: 600 }}>
              {reason}
            </div>
          </div>
        )}

        {/* Expected vs Found Evidence */}
        {evidence && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '0.76rem', textTransform: 'uppercase', color: '#fca5a5', fontWeight: 700, marginBottom: '4px' }}>
              Cryptographic Tamper Evidence (Expected vs Found):
            </div>
            <pre
              style={{
                backgroundColor: '#0f0202',
                border: '1px solid #991b1b',
                borderRadius: '6px',
                padding: '10px 12px',
                color: '#f87171',
                fontSize: '0.8rem',
                fontFamily: 'ui-monospace, monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                margin: 0,
                maxHeight: '120px',
                overflowY: 'auto',
              }}
            >
              {evidence}
            </pre>
          </div>
        )}

        {/* Blocked Operations Summary */}
        <div
          style={{
            backgroundColor: '#120404',
            border: '1px solid #450a0a',
            borderRadius: '6px',
            padding: '10px 14px',
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase' }}>
            All High-Privilege & Execution Operations Suspended (HTTP 423 Locked):
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px', fontSize: '0.78rem', color: '#fca5a5' }}>
            <div>🚫 Agent Chat & Reasoning</div>
            <div>🚫 RAG Document Ingestion</div>
            <div>🚫 Tool Sandbox Execution</div>
            <div>🚫 Approval Resolutions</div>
            <div>🚫 Policy / Permission Edits</div>
            <div>🚫 Model Inference Loop</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '14px', borderTop: '1px solid #450a0a' }}>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            style={{
              background: 'transparent',
              border: '1px solid #7f1d1d',
              color: '#fca5a5',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Inspect Logs (Read-Only)
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={refreshStatus}
              style={{
                background: '#2b0c0c',
                border: '1px solid #7f1d1d',
                color: '#fecaca',
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw width={14} height={14} /> Re-check Integrity
            </button>
            <button
              type="button"
              onClick={() => setRecoverModalOpen(true)}
              style={{
                background: '#ef4444',
                border: '1px solid #dc2626',
                color: '#fff',
                padding: '8px 20px',
                borderRadius: '6px',
                fontSize: '0.88rem',
                cursor: 'pointer',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
              }}
            >
              <Key width={16} height={16} /> Start Recovery
            </button>
          </div>
        </div>
      </div>

      {/* Real Recovery Flow Modal */}
      {recoverModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              maxWidth: '580px',
              width: '100%',
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '10px',
              padding: '24px',
              color: '#f4f4f5',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>System Integrity Recovery</h3>
                <span style={{ fontSize: '0.76rem', color: '#a1a1aa' }}>
                  Authenticated procedure to restore integrity and log a permanent audit record
                </span>
              </div>
              <button
                type="button"
                onClick={() => setRecoverModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}
              >
                <X width={18} height={18} />
              </button>
            </div>

            {errorMsg && (
              <div
                style={{
                  backgroundColor: '#450a0a',
                  border: '1px solid #991b1b',
                  color: '#fca5a5',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '0.84rem',
                  marginBottom: '16px',
                }}
              >
                <AlertTriangle width={15} height={15} style={{ display: 'inline', marginRight: '6px' }} />
                {errorMsg}
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                Administrator Credential Token
              </label>
              <input
                type="password"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                placeholder="Bearer admin token"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: '#09090b',
                  border: '1px solid #3f3f46',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '8px 12px',
                  fontSize: '0.84rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                Recovery Action
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '10px',
                    borderRadius: '6px',
                    border: mode === 'rebaseline' ? '2px solid #ef4444' : '1px solid #3f3f46',
                    backgroundColor: mode === 'rebaseline' ? '#271010' : '#27272a',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="rec_mode"
                    checked={mode === 'rebaseline'}
                    onChange={() => setMode('rebaseline')}
                    style={{ marginTop: '2px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Cryptographic Rebaseline</div>
                    <div style={{ fontSize: '0.74rem', color: '#a1a1aa' }}>
                      Audit, sign state, and re-anchor head
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '10px',
                    borderRadius: '6px',
                    border: mode === 'restore_snapshot' ? '2px solid #3b82f6' : '1px solid #3f3f46',
                    backgroundColor: mode === 'restore_snapshot' ? '#0f172a' : '#27272a',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="rec_mode"
                    checked={mode === 'restore_snapshot'}
                    onChange={() => setMode('restore_snapshot')}
                    style={{ marginTop: '2px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Restore Snapshot</div>
                    <div style={{ fontSize: '0.74rem', color: '#a1a1aa' }}>
                      Revert database to verified snapshot
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8' }}>
                  Operator Justification / Incident Reason *
                </label>
                <span style={{ fontSize: '0.74rem', color: recReason.trim().length >= 20 ? '#10b981' : '#f87171' }}>
                  {recReason.trim().length} / 20 min chars
                </span>
              </div>
              <textarea
                value={recReason}
                onChange={(e) => setRecReason(e.target.value)}
                rows={3}
                placeholder="Explain the security investigation, incident resolution, and reason for unlocking system (min 20 chars)..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: '#09090b',
                  border: recReason.trim().length > 0 && recReason.trim().length < 20 ? '1px solid #ef4444' : '1px solid #3f3f46',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '8px 12px',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {mode === 'rebaseline' && (
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#fca5a5', marginBottom: '4px' }}>
                  Confirmation Phrase Required
                </label>
                <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '6px' }}>
                  Type: <code>{REBASELINE_PHRASE}</code>
                </div>
                <input
                  type="text"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder={REBASELINE_PHRASE}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    backgroundColor: '#09090b',
                    border: '1px solid #7f1d1d',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    fontFamily: 'monospace',
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setRecoverModalOpen(false)}
                style={{
                  background: '#27272a',
                  border: '1px solid #3f3f46',
                  color: '#d4d4d8',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || recReason.trim().length < 20}
                onClick={handleRecover}
                style={{
                  background: recReason.trim().length >= 20 ? '#10b981' : '#374151',
                  border: 'none',
                  color: '#fff',
                  padding: '8px 20px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: submitting || recReason.trim().length < 20 ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {submitting ? 'Verifying...' : 'Unlock System'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
