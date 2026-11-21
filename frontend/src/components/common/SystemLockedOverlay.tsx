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
  const [dismissed, setDismissed] = useState(false);

  // Recovery modal state
  const [recoverModalOpen, setRecoverModalOpen] = useState(false);
  const [mode, setMode] = useState<'restore_snapshot' | 'rebaseline'>('rebaseline');
  const [recReason, setRecReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
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
    const timer = setInterval(refreshStatus, 4000);

    const onLockedEvent = (ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      setLocked(true);
      setDismissed(false);
      if (detail?.reason) setReason(detail.reason);
      if (detail?.evidence) setEvidence(detail.evidence);
    };

    window.addEventListener('clarix:system_locked', onLockedEvent);
    return () => {
      clearInterval(timer);
      window.removeEventListener('clarix:system_locked', onLockedEvent);
    };
  }, []);

  async function handleRecover() {
    setErrorMsg('');
    if (!recReason.trim() || recReason.trim().length < 8) {
      setErrorMsg('A detailed reason of at least 8 characters is required.');
      return;
    }
    if (mode === 'rebaseline' && confirmation.trim() !== REBASELINE_PHRASE) {
      setErrorMsg(`Confirmation phrase mismatch. Enter exactly: "${REBASELINE_PHRASE}"`);
      return;
    }

    setSubmitting(true);
    try {
      await auditService.recoverIntegrity(mode, recReason.trim(), confirmation.trim());
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
          maxWidth: '720px',
          width: '100%',
          backgroundColor: '#1b0808',
          border: '2px solid #ef4444',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
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
                POL-006 Cryptographic Lockdown
              </span>
            </div>
            <h2 id="lockdown-title" style={{ margin: '6px 0 0 0', fontSize: '1.45rem', fontWeight: 700, color: '#fef2f2' }}>
              SYSTEM LOCKED — Tamper Detected
            </h2>
          </div>
        </div>

        <p style={{ color: '#fecaca', fontSize: '0.92rem', lineHeight: 1.5, margin: '0 0 18px 0' }}>
          Clarix AI detected an unauthorized modification outside the official audited API path.
          To protect classified documents and execution integrity, the system has entered <strong>fail-closed lockdown</strong>.
          Agent chat, tool execution, approvals, document ingestion, and permission changes are blocked.
        </p>

        {reason && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#fca5a5', fontWeight: 700, marginBottom: '4px' }}>
              Detection Reason
            </div>
            <div style={{ backgroundColor: '#2d0a0a', border: '1px solid #7f1d1d', borderRadius: '6px', padding: '10px 14px', color: '#fee2e2', fontSize: '0.88rem', fontWeight: 600 }}>
              {reason}
            </div>
          </div>
        )}

        {evidence && (
          <div style={{ marginBottom: '22px' }}>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#fca5a5', fontWeight: 700, marginBottom: '4px' }}>
              Cryptographic Tamper Evidence
            </div>
            <pre
              style={{
                backgroundColor: '#0f0202',
                border: '1px solid #991b1b',
                borderRadius: '6px',
                padding: '12px',
                color: '#f87171',
                fontSize: '0.82rem',
                fontFamily: 'ui-monospace, monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                margin: 0,
                maxHeight: '140px',
                overflowY: 'auto',
              }}
            >
              {evidence}
            </pre>
          </div>
        )}

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
              <RefreshCw width={14} height={14} /> Re-check
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
              <Key width={16} height={16} /> Recover System
            </button>
          </div>
        </div>
      </div>

      {/* Recovery Modal */}
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
              maxWidth: '560px',
              width: '100%',
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '10px',
              padding: '24px',
              color: '#f4f4f5',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>System Integrity Recovery</h3>
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

            <div style={{ marginBottom: '16px' }}>
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

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#d4d4d8', marginBottom: '6px' }}>
                Operator Justification / Incident Reason *
              </label>
              <textarea
                value={recReason}
                onChange={(e) => setRecReason(e.target.value)}
                rows={3}
                placeholder="Explain the security investigation and reason for recovery..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: '#09090b',
                  border: '1px solid #3f3f46',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '8px 12px',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {mode === 'rebaseline' && (
              <div style={{ marginBottom: '20px' }}>
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
                disabled={submitting}
                onClick={handleRecover}
                style={{
                  background: '#10b981',
                  border: 'none',
                  color: '#fff',
                  padding: '8px 20px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
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
