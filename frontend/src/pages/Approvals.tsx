import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Eye, Plus, ExternalLink } from 'lucide-react';
import { Card, ClassPill, EmptyState, ErrorState, Loading, Modal, Page, PageHeader, Pill, RiskPill, Spinner, Tabs } from '../components/common';
import { useAsync } from '../hooks/useAsync';
import { approvalService } from '../services';
import { useConsole } from '../state/ConsoleContext';
import type { ApprovalRequest } from '../types';

export default function Approvals() {
  const { toast, refreshCounts, settings } = useConsole();
  const { data, loading, error, reload, setData } = useAsync(() => approvalService.list());
  const [tab, setTab] = useState('pending');
  const [detail, setDetail] = useState<ApprovalRequest | null>(null);
  const [denyModalTarget, setDenyModalTarget] = useState<ApprovalRequest | null>(null);
  const [denyNote, setDenyNote] = useState('');
  const [denyError, setDenyError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(() => Math.floor(Date.now() / 1000));

  // Live seconds ticker for 300s countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll every 3.5s to keep /approvals and /agent cockpit in live sync
  useEffect(() => {
    const pollTimer = setInterval(() => {
      void reload();
      refreshCounts();
    }, 3500);
    return () => clearInterval(pollTimer);
  }, [reload, refreshCounts]);

  const pending = (data ?? []).filter((a) => a.status === 'PENDING');
  const history = (data ?? []).filter((a) => a.status !== 'PENDING');
  const list = tab === 'pending' ? pending : history;

  function calculateRemainingSec(a: ApprovalRequest): number {
    let expSec: number;
    if (typeof a.expiresAt === 'number') {
      expSec = Math.floor(a.expiresAt);
    } else if (a.expiresAt) {
      expSec = Math.floor(new Date(a.expiresAt).getTime() / 1000);
    } else {
      const createdSec = Math.floor(new Date(a.createdAt).getTime() / 1000);
      expSec = (isNaN(createdSec) ? currentTimeSec : createdSec) + 300;
    }
    return Math.max(0, Math.floor(expSec - currentTimeSec));
  }

  async function resolve(a: ApprovalRequest, decision: 'APPROVED' | 'DENIED', note?: string) {
    setBusy(a.id);
    try {
      const u = await approvalService.resolve(a.id, decision, note);
      setData((d) => (d ?? []).map((x) => (x.id === a.id ? { ...x, ...u } : x)));
      toast(
        `${a.id} ${decision === 'APPROVED' ? 'approved' : 'denied'}. Execution ${decision === 'APPROVED' ? 'started / resumed' : 'cancelled'}.`,
        decision === 'APPROVED' ? 'green' : 'amber'
      );
      setDetail(null);
      setDenyModalTarget(null);
      setDenyNote('');
      setDenyError('');
      await reload();
      refreshCounts();
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('expired') || msg.includes('not found') || msg.includes('already') || msg.includes('handled')) {
        toast('This request has expired or was already handled', 'amber');
      } else {
        toast(msg || 'Could not resolve request', 'red');
      }
      await reload();
      refreshCounts();
    } finally {
      setBusy(null);
    }
  }

  function handleOpenDeny(a: ApprovalRequest) {
    setDenyModalTarget(a);
    setDenyNote('');
    setDenyError('');
  }

  function handleConfirmDeny() {
    if (!denyModalTarget) return;
    const trimmed = denyNote.trim();
    if (!trimmed) {
      setDenyError('A justification note is required to deny an approval request.');
      return;
    }
    void resolve(denyModalTarget, 'DENIED', trimmed);
  }

  async function simulate() {
    setSimulating(true);
    try {
      const a = await approvalService.simulate();
      setData((d) => [a, ...(d ?? []).filter((x) => x.id !== a.id)]);
      setTab('pending');
      refreshCounts();
      toast('Simulated high-risk request queued.', 'blue');
    } catch (e: any) {
      toast(e?.message || 'Failed to simulate request', 'red');
    } finally {
      setSimulating(false);
    }
  }

  return (
    <Page>
      <PageHeader
        icon={<Eye color="#2563ff" />}
        title="Human-in-the-loop approval queue"
        subtitle="Cryptographic gate requiring authorized SOC operator approval for high-risk actions or confidential data access."
        aside={
          settings.demoMode ? (
            <button
              type="button"
              className="cx-btn cx-btn--primary"
              disabled={simulating}
              onClick={() => void simulate()}
            >
              {simulating ? <Spinner label="Simulating..." /> : <><Plus />Simulate High-Risk Request</>}
            </button>
          ) : undefined
        }
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'pending', label: 'Pending Approvals', count: pending.length },
          { id: 'history', label: 'Resolution History', count: history.length },
        ]}
      />

      {loading && <Loading rows={1} height={220} />}
      {error && <Card><ErrorState message={error} onRetry={reload} /></Card>}
      {data && list.length === 0 && (
        <Card>
          <EmptyState
            title={tab === 'pending' ? 'No pending approvals' : 'Nothing resolved yet'}
            hint={
              tab === 'pending'
                ? 'Use “Simulate High-Risk Request” to see how a request is handled.'
                : 'Resolved requests appear here.'
            }
          />
        </Card>
      )}

      <div className="cx-stack">
        {list.map((a) => {
          const remaining = calculateRemainingSec(a);
          const isPending = a.status === 'PENDING';
          const isExpired = a.status === 'EXPIRED' || (a.status === 'DENIED' && a.resolvedBy === 'system') || (isPending && remaining === 0);

          return (
            <Card key={a.id} className="ap">
              <div className="ap__head">
                <b className="tone-blue cx-mono">Approval Request #{a.id}</b>
                <span className="cx-muted">•</span>
                <span className="cx-muted cx-mono" style={{ fontSize: '.78rem' }}>
                  {a.createdAt}
                </span>

                {a.runId && (
                  <>
                    <span className="cx-muted">•</span>
                    <Link
                      to={`/agent?runId=${a.runId}`}
                      className="tone-blue"
                      style={{
                        fontSize: '.78rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        textDecoration: 'underline',
                      }}
                    >
                      <ExternalLink width={12} height={12} /> View Run in Cockpit
                    </Link>
                  </>
                )}

                <span className="cx-push cx-row" style={{ gap: '8px' }}>
                  <RiskPill risk={a.risk} />
                  <ClassPill value={a.classification} />
                  {a.role && <Pill tone="violet">ROLE: {a.role.toUpperCase()}</Pill>}
                  <Pill
                    tone={
                      isExpired
                        ? 'gray'
                        : a.status === 'APPROVED'
                        ? 'green'
                        : a.status === 'DENIED'
                        ? 'red'
                        : 'blue'
                    }
                    dot
                  >
                    {isExpired ? 'EXPIRED' : a.status}
                  </Pill>
                </span>
              </div>

              <span className="cx-label cx-label--caps">Action in Plain Words:</span>
              <p className="ap__action" style={{ fontWeight: 600, color: 'var(--ink, #0f172a)' }}>
                “{a.action}”
              </p>

              {/* Render planned steps if available */}
              {a.planSteps && a.planSteps.length > 0 && (
                <div
                  style={{
                    backgroundColor: 'rgba(37, 99, 255, 0.04)',
                    border: '1px solid rgba(37, 99, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    marginBottom: '14px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: 'var(--ink, #1e293b)',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>Planned Steps & Tools ({a.planSteps.length})</span>
                  </div>
                  <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '0.82rem', color: '#334155' }}>
                    {a.planSteps.map((s) => (
                      <li key={s.step} style={{ marginBottom: '6px' }}>
                        <span style={{ fontWeight: 600 }}>{s.description}</span>{' '}
                        <code
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 6px',
                            backgroundColor: 'rgba(0,0,0,0.06)',
                            borderRadius: '4px',
                            color: '#2563eb',
                            marginLeft: '4px',
                          }}
                        >
                          {s.tool}
                        </code>
                        {s.needsApproval && (
                          <span
                            style={{
                              marginLeft: '6px',
                              fontSize: '0.7rem',
                              color: '#d97706',
                              fontWeight: 700,
                            }}
                          >
                            [Needs Human Sign-Off]
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="ap__meta">
                <div>
                  <small>Requested Tool(s):</small>
                  <b>{a.tool}</b>
                </div>
                <div>
                  <small>Target Resource:</small>
                  <b className="tone-green">{a.resource}</b>
                </div>
                <div>
                  <small>Requester:</small>
                  <b>{a.requester}</b>
                </div>
              </div>

              <div className="ap__foot">
                {isPending && !isExpired ? (
                  <span
                    className="cx-mono"
                    style={{
                      fontSize: '.82rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: remaining < 60 ? '#ef4444' : remaining < 180 ? '#d97706' : '#2563eb',
                      fontWeight: 600,
                    }}
                  >
                    <Clock width={15} height={15} />
                    Live Countdown: <strong>{remaining}s</strong> remaining before auto-expiry
                  </span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span className="cx-muted cx-mono" style={{ fontSize: '.78rem' }}>
                      {a.status === 'APPROVED' ? 'Approved' : isExpired ? 'Expired' : 'Denied'} by{' '}
                      <strong>{a.resolvedBy || 'system'}</strong> at {a.resolvedAt || 'timeout'}
                    </span>
                    {a.note && (
                      <span style={{ fontSize: '.76rem', color: 'var(--mute, #64748b)' }}>
                        Note: <em>&quot;{a.note}&quot;</em>
                      </span>
                    )}
                  </div>
                )}

                <span className="cx-push cx-row" style={{ gap: '8px' }}>
                  {isPending && !isExpired && (
                    <>
                      <button
                        type="button"
                        className="cx-btn cx-btn--danger"
                        disabled={busy === a.id}
                        onClick={() => handleOpenDeny(a)}
                      >
                        Deny
                      </button>
                      <button
                        type="button"
                        className="cx-btn cx-btn--primary"
                        disabled={busy === a.id}
                        onClick={() => void resolve(a, 'APPROVED')}
                      >
                        {busy === a.id ? <Spinner label="Approving..." /> : 'Approve'}
                      </button>
                    </>
                  )}
                  <button type="button" className="cx-btn cx-btn--ghost" onClick={() => setDetail(a)}>
                    Inspect Details
                  </button>
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Deny Justification Modal */}
      {denyModalTarget && (
        <Modal
          title={`Deny Approval Request #${denyModalTarget.id}`}
          onClose={() => setDenyModalTarget(null)}
          footer={
            <>
              <button
                type="button"
                className="cx-btn cx-btn--ghost"
                onClick={() => setDenyModalTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cx-btn cx-btn--danger"
                disabled={busy === denyModalTarget.id || !denyNote.trim()}
                onClick={handleConfirmDeny}
              >
                {busy === denyModalTarget.id ? <Spinner label="Denying..." /> : 'Confirm Deny & Cancel Action'}
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#334155', lineHeight: 1.5 }}>
              You are denying approval for: <strong>“{denyModalTarget.action}”</strong>
            </p>
            <div
              style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                color: '#92400e',
              }}
            >
              <strong>Security Protocol Notice:</strong> A mandatory justification note is required to log the operator decision in the audit trail.
            </div>
            <div>
              <label
                htmlFor="deny-note"
                style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px', color: '#1e293b' }}
              >
                Mandatory Denial Justification Note:
              </label>
              <textarea
                id="deny-note"
                className="cx-textarea"
                rows={3}
                placeholder="Explain why this action or plan was denied (e.g. unauthorized tool usage, scope violation)..."
                value={denyNote}
                onChange={(e) => {
                  setDenyNote(e.target.value);
                  setDenyError('');
                }}
                autoFocus
              />
              {denyError && (
                <div style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: '4px', fontWeight: 600 }}>
                  {denyError}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Inspect Details Modal */}
      {detail && (
        <Modal
          title={<>Approval Request #{detail.id}</>}
          onClose={() => setDetail(null)}
          footer={
            detail.status === 'PENDING' ? (
              <>
                <button
                  type="button"
                  className="cx-btn cx-btn--danger"
                  onClick={() => {
                    const d = detail;
                    setDetail(null);
                    handleOpenDeny(d);
                  }}
                >
                  Deny
                </button>
                <button
                  type="button"
                  className="cx-btn cx-btn--primary"
                  onClick={() => void resolve(detail, 'APPROVED')}
                >
                  Approve
                </button>
              </>
            ) : (
              <button type="button" className="cx-btn cx-btn--ghost" onClick={() => setDetail(null)}>
                Close
              </button>
            )
          }
        >
          <dl className="kv">
            <dt>Action</dt>
            <dd style={{ fontWeight: 600 }}>{detail.action}</dd>
            <dt>Tool(s)</dt>
            <dd>{detail.tool}</dd>
            <dt>Target Resource</dt>
            <dd className="tone-green">{detail.resource}</dd>
            <dt>Requester</dt>
            <dd>{detail.requester}</dd>
            {detail.role && (
              <>
                <dt>Agent Role</dt>
                <dd><Pill tone="violet">{detail.role.toUpperCase()}</Pill></dd>
              </>
            )}
            {detail.runId && (
              <>
                <dt>Linked Run</dt>
                <dd>
                  <Link to={`/agent?runId=${detail.runId}`} className="tone-blue" style={{ textDecoration: 'underline' }}>
                    {detail.runId} (Open in Cockpit)
                  </Link>
                </dd>
              </>
            )}
            <dt>Risk</dt>
            <dd><RiskPill risk={detail.risk} /></dd>
            <dt>Classification</dt>
            <dd><ClassPill value={detail.classification} /></dd>
            <dt>Created At</dt>
            <dd>{detail.createdAt}</dd>
            <dt>Status</dt>
            <dd>
              <Pill tone={detail.status === 'APPROVED' ? 'green' : detail.status === 'PENDING' ? 'blue' : 'red'}>
                {detail.status}
              </Pill>
            </dd>
            {detail.resolvedBy && (
              <>
                <dt>Resolved By</dt>
                <dd>{detail.resolvedBy}</dd>
                <dt>Resolved At</dt>
                <dd>{detail.resolvedAt}</dd>
              </>
            )}
            {detail.note && (
              <>
                <dt>Justification</dt>
                <dd style={{ fontStyle: 'italic' }}>{detail.note}</dd>
              </>
            )}
          </dl>
        </Modal>
      )}
    </Page>
  );
}
