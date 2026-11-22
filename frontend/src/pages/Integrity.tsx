import { useCallback, useEffect, useState, useRef } from 'react';
import {
  FileText,
  Hash,
  Link2,
  Lock,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  ArrowDown,
  CheckCircle2,
  XCircle,
  PlayCircle,
} from 'lucide-react';
import { Card, CopyButton, ErrorState, Loading, Page, PageHeader, Pill, Spinner } from '../components/common';
import { auditService, type VerifierComparison, type ServerVerifyResult, type IntegrityStatus } from '../services';
import { useConsole } from '../state/ConsoleContext';
import type { AuditEvent } from '../types';
import { cx } from '../utils/format';
import { isCryptoAvailable, sha256Hex, type ChainLink } from '../utils/sha256';

function isLayerOk(layer: any): boolean {
  if (layer === undefined || layer === null) return true;
  if (typeof layer === 'boolean') return layer;
  if (typeof layer === 'object' && typeof layer.ok === 'boolean') return layer.ok;
  return true;
}

export type IntegrityOverallStatus = 'VERIFIED' | 'TAMPERED' | 'CHECKING' | 'UNAVAILABLE';

export default function Integrity() {
  const { settings, toast } = useConsole();

  const [comparison, setComparison] = useState<VerifierComparison | null>(null);
  const [intStatus, setIntStatus] = useState<IntegrityStatus | null>(null);
  const [serverVerify, setServerVerify] = useState<ServerVerifyResult | null>(null);
  const [links, setLinks] = useState<ChainLink[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loadingChain, setLoadingChain] = useState(true);
  const [chainError, setChainError] = useState<string | null>(null);

  const [overallStatus, setOverallStatus] = useState<IntegrityOverallStatus>('CHECKING');
  const [verifying, setVerifying] = useState(false);
  const [lastVerifiedTime, setLastVerifiedTime] = useState<string>('');

  // Educational SHA-256 generator state
  const [text, setText] = useState('');
  const [digest, setDigest] = useState('');
  const [genErr, setGenErr] = useState('');

  const isMountedRef = useRef(true);

  // Load chain data
  const loadChain = useCallback(async () => {
    try {
      setLoadingChain(true);
      setChainError(null);
      const chainData = await auditService.chain();
      if (!isMountedRef.current) return;
      const l = chainData.map((d) => d.link).filter((x) => x.hash);
      setEvents(chainData.map((d) => d.event));
      setLinks(l);
    } catch (e: any) {
      if (!isMountedRef.current) return;
      setChainError(e?.message || 'Failed to load audit chain');
    } finally {
      if (isMountedRef.current) setLoadingChain(false);
    }
  }, []);

  // Verification routine using solely backend API endpoints as single source of truth
  const runVerification = useCallback(async (isManual = false) => {
    if (isManual) setVerifying(true);
    try {
      // 8-second timeout guard
      const fetchWithTimeout = async () => {
        return await Promise.all([
          auditService.verifyServer(),
          auditService.getIntegrityStatus(),
          auditService.compareVerifiers(),
        ]);
      };

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Integrity verification timed out (8s)')), 8000)
      );

      const [vRes, statusRes, compRes] = await Promise.race([fetchWithTimeout(), timeoutPromise]);

      if (!isMountedRef.current) return;

      setServerVerify(vRes);
      setIntStatus(statusRes);
      setComparison(compRes);

      const ts = vRes?.verifiedAt || new Date().toLocaleTimeString();
      setLastVerifiedTime(ts);

      const isLocked = statusRes?.locked || compRes?.status === 'TAMPER_DETECTED' || !vRes?.ok;
      if (isLocked) {
        setOverallStatus('TAMPERED');
      } else {
        setOverallStatus('VERIFIED');
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setOverallStatus('UNAVAILABLE');
      if (isManual) {
        toast(err?.message || 'Verification service unreachable', 'red');
      }
    } finally {
      if (isMountedRef.current && isManual) {
        setVerifying(false);
      }
    }
  }, [toast]);

  useEffect(() => {
    isMountedRef.current = true;
    void loadChain();
    void runVerification(true);

    const timer = setInterval(() => {
      void runVerification(false);
    }, 3000);

    return () => {
      isMountedRef.current = false;
      clearInterval(timer);
    };
  }, [loadChain, runVerification]);

  // Educational SHA-256 generation
  async function generate() {
    setGenErr('');
    try {
      if (isCryptoAvailable()) {
        setDigest(await sha256Hex(text));
      } else {
        setGenErr('SubtleCrypto is unavailable in this environment.');
      }
    } catch (e: any) {
      setDigest('');
      setGenErr(e?.message || 'Hashing failed');
    }
  }

  const isDemo = Boolean(settings.demoMode || intStatus?.demoMode || intStatus?.ledger === 'demo' || comparison?.dbState?.demoMode);
  const realCount = intStatus?.anchor?.count || serverVerify?.count || events.length || 40;

  const DEMO_STEPS = [
    {
      num: 1,
      title: 'Baseline Check',
      desc: `Confirm all ${realCount} seed events are cryptographically sealed and verified.`,
      cmd: 'python tools/attack_demo.py --list',
    },
    {
      num: 2,
      title: 'Smart Adversary Attack',
      desc: 'Alter event #14 (BLOCK -> ALLOW) and recompute downstream SHA-256 chain.',
      cmd: 'python tools/attack_demo.py --edit-row 14 --rehash',
    },
    {
      num: 3,
      title: 'Legacy Verifier Blindness',
      desc: 'Execute naive verifier: it passes 100% CLEAN because hash links appear unbroken.',
      cmd: 'python tools/attack_demo.py --legacy-verify',
    },
    {
      num: 4,
      title: 'Clarix Fail-Closed Lockdown',
      desc: 'Observe Clarix detect HMAC mismatch & anchor violation within 2.5s and lock down.',
      cmd: 'Review side-by-side comparison above',
    },
    {
      num: 5,
      title: 'Audit-Signed Recovery',
      desc: 'Rebaseline with admin credentials and mandatory 20+ character security justification.',
      cmd: 'Click "Recover System" in lockdown overlay',
    },
  ];

  const serverEvidence = intStatus?.evidence || comparison?.clarix?.evidence || intStatus?.reason || serverVerify?.problems?.[0]?.reason || 'Cryptographic integrity mismatch';

  const isLegacyFooled = comparison?.legacy?.status === 'FOOLED' || (overallStatus === 'TAMPERED' && comparison?.legacy?.ok);
  const isLegacyNA = comparison?.legacy?.status === 'NOT_APPLICABLE' || overallStatus === 'VERIFIED';

  return (
    <Page>
      <PageHeader
        icon={<FileText color="#2563ff" />}
        title="Tamper Lockdown & Cryptographic Verification"
        subtitle="Keyed HMAC-SHA256, external anchor, signed security state, and fail-closed lockdown (POL-006)."
      />

      {/* Top Status Card */}
      <Card className="ig-top">
        <span
          className={cx('cx-icon-box', overallStatus === 'TAMPERED' ? 'cx-icon-box--red' : 'cx-icon-box--blue')}
          style={{ width: '4rem', height: '4rem' }}
        >
          {overallStatus === 'TAMPERED' ? <ShieldAlert color="#ef4444" /> : <ShieldCheck color="#10b981" />}
        </span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="cx-row" style={{ alignItems: 'center', gap: '12px' }}>
            <h2 className="ig-top__h" style={{ color: 'var(--ink, #0f172a)', fontWeight: 800 }}>
              {overallStatus === 'TAMPERED'
                ? 'POL-006 FAIL-CLOSED LOCKDOWN ACTIVE'
                : 'Ledger Integrity & Cryptographic Seal'}
            </h2>
            <Pill
              tone={
                overallStatus === 'VERIFIED'
                  ? 'green'
                  : overallStatus === 'TAMPERED'
                  ? 'red'
                  : overallStatus === 'CHECKING'
                  ? 'blue'
                  : 'amber'
              }
            >
              {overallStatus === 'VERIFIED'
                ? '✓ VERIFIED'
                : overallStatus === 'TAMPERED'
                ? '✕ TAMPERED'
                : overallStatus === 'CHECKING'
                ? 'CHECKING...'
                : 'UNAVAILABLE'}
            </Pill>
          </div>
          <p className="cx-sub" style={{ margin: '.3rem 0 0', color: 'var(--mute, #475569)' }}>
            {overallStatus === 'TAMPERED'
              ? `Cryptographic tampering detected. System locked under POL-006. Evidence: ${typeof serverEvidence === 'object' ? JSON.stringify(serverEvidence) : String(serverEvidence)}`
              : overallStatus === 'VERIFIED'
              ? 'Each event is signed with an isolated HMAC key and anchored to an external verifiable state. All defense layers operational.'
              : overallStatus === 'CHECKING'
              ? 'Cryptographic integrity verification in progress...'
              : 'Integrity verification service is currently unreachable or timed out.'}
          </p>
          {lastVerifiedTime && (
            <div style={{ fontSize: '0.78rem', color: 'var(--mute, #64748b)', marginTop: '4px' }}>
              Last checked: <span style={{ color: 'var(--ink, #0f172a)', fontFamily: 'monospace', fontWeight: 600 }}>{lastVerifiedTime}</span>
            </div>
          )}
        </div>
        <div className="cx-row" style={{ gap: '8px' }}>
          {overallStatus === 'UNAVAILABLE' && (
            <button
              type="button"
              className="cx-btn cx-btn--secondary"
              onClick={() => {
                void loadChain();
                void runVerification(true);
              }}
            >
              Retry
            </button>
          )}
          <button
            type="button"
            className="cx-btn cx-btn--primary"
            disabled={verifying}
            onClick={() => {
              void loadChain();
              void runVerification(true);
            }}
          >
            {verifying ? <Spinner label="Verifying" /> : <><RefreshCw />Re-Verify Entire System</>}
          </button>
        </div>
      </Card>

      {/* Side-by-Side: Attacker View vs Clarix View */}
      <Card
        title="Attacker View vs. Clarix View (Live Cryptographic Defense Comparison)"
        icon={<ShieldCheck color="#2563ff" />}
        aside={
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Auto-refreshes every 3s | Demonstrates why naive SHA-256 chains fail
          </span>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
          {/* Left Column: Legacy Naive Verifier */}
          <div
            style={{
              backgroundColor: '#0c131d',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#cbd5e1', fontWeight: 700 }}>
                  ATTACKER / NAIVE VIEW
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                  Legacy Plain SHA-256 Chain
                </h3>
              </div>
              <Pill tone={isLegacyFooled ? 'green' : isLegacyNA ? 'gray' : 'red'}>
                {isLegacyFooled ? 'CLEAN (fooled)' : isLegacyNA ? 'NOT APPLICABLE' : '✕ DETECTED'}
              </Pill>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.45, margin: '0 0 12px 0' }}>
              Standard unkeyed SHA-256 hash chains (used in naive demos and simple tutorials) verify only:
              <code>sha256(prev_hash + payload)</code>.
            </p>

            <div
              style={{
                backgroundColor: '#111827',
                border: '1px solid #374151',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '0.8rem',
                color: '#e5e7eb',
                marginBottom: '12px',
              }}
            >
              <div style={{ fontWeight: 600, color: '#f59e0b', marginBottom: '4px' }}>
                ⚠️ The &quot;Smart Attacker&quot; Blindspot:
              </div>
              <div>
                If an attacker alters row 14 and recalculates downstream SHA-256 hashes, the naive verifier
                reports <strong>100% CLEAN</strong>. It cannot detect that history was rewritten.
              </div>
            </div>

            <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
              Status:{' '}
              <code style={{ color: isLegacyFooled ? '#22c55e' : isLegacyNA ? '#cbd5e1' : '#ef4444' }}>
                {isLegacyFooled
                  ? 'CLEAN (fooled)'
                  : isLegacyNA
                  ? "NOT APPLICABLE (legacy can't verify a keyed ledger)"
                  : comparison?.legacy?.reason || comparison?.legacy?.message || 'Hash continuity failure'}
              </code>
            </div>
          </div>

          {/* Right Column: Clarix Production Defense */}
          <div
            style={{
              backgroundColor: overallStatus === 'TAMPERED' ? '#1f0909' : '#061a12',
              border: overallStatus === 'TAMPERED' ? '2px solid #ef4444' : '1px solid #059669',
              borderRadius: '8px',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    color: overallStatus === 'TAMPERED' ? '#fca5a5' : '#6ee7b7',
                    fontWeight: 700,
                  }}
                >
                  CLARIX PRODUCTION DEFENSE
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                  Keyed HMAC + Anchor + Signed State
                </h3>
              </div>
              <Pill tone={overallStatus === 'TAMPERED' ? 'red' : 'green'}>
                {overallStatus === 'TAMPERED' ? '✕ TAMPERED (HMAC mismatch)' : '✓ VERIFIED'}
              </Pill>
            </div>

            <p
              style={{
                fontSize: '0.82rem',
                color: overallStatus === 'TAMPERED' ? '#fecaca' : '#a7f3d0',
                lineHeight: 1.45,
                margin: '0 0 12px 0',
              }}
            >
              Clarix uses 4 independent verification layers with isolated secret keys and external anchors.
              Even if hashes are recalculated, the attack is stopped cold.
            </p>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginBottom: '12px',
                color: overallStatus === 'TAMPERED' ? '#fee2e2' : '#f1f5f9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
                {isLayerOk(comparison?.clarix?.layers?.hmac_chain) && overallStatus !== 'TAMPERED' ? (
                  <CheckCircle2 width={15} height={15} color="#10b981" />
                ) : (
                  <XCircle width={15} height={15} color="#ef4444" />
                )}
                <span>
                  <strong>1. HMAC-SHA256 Chain:</strong> Keyed with air-gapped <code>audit.key</code>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
                {isLayerOk(comparison?.clarix?.layers?.external_anchor) && overallStatus !== 'TAMPERED' ? (
                  <CheckCircle2 width={15} height={15} color="#10b981" />
                ) : (
                  <XCircle width={15} height={15} color="#ef4444" />
                )}
                <span>
                  <strong>2. External Head Anchor:</strong> Head hash sealed outside the database
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
                {isLayerOk(comparison?.clarix?.layers?.signed_state ?? comparison?.clarix?.layers?.signed_security_state) &&
                overallStatus !== 'TAMPERED' ? (
                  <CheckCircle2 width={15} height={15} color="#10b981" />
                ) : (
                  <XCircle width={15} height={15} color="#ef4444" />
                )}
                <span>
                  <strong>3. Signed Security State:</strong> Tools, policies, and schemas signed
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
                {isLayerOk(comparison?.clarix?.layers?.triggers ?? comparison?.clarix?.layers?.schema_triggers) &&
                overallStatus !== 'TAMPERED' ? (
                  <CheckCircle2 width={15} height={15} color="#10b981" />
                ) : (
                  <XCircle width={15} height={15} color="#ef4444" />
                )}
                <span>
                  <strong>4. SQLite Immutability Triggers:</strong> Fail-closed block on UPDATE/DELETE
                </span>
              </div>
            </div>

            {overallStatus === 'TAMPERED' && (
              <div
                style={{
                  backgroundColor: '#3b0d0d',
                  border: '1px solid #7f1d1d',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#fee2e2',
                  fontSize: '0.78rem',
                }}
              >
                <strong>Detection Evidence:</strong> {typeof serverEvidence === 'object' ? JSON.stringify(serverEvidence) : String(serverEvidence)}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Guided 90-Second Demo Walkthrough Panel: Demo mode only, or enter demo mode banner */}
      {isDemo ? (
        <Card
          title="Guided 90-Second Tamper Demo (Judge Presentation Flow)"
          icon={<PlayCircle color="#10b981" />}
          aside={<span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Step-by-step competition script</span>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            {DEMO_STEPS.map((st) => (
              <div
                key={st.num}
                style={{
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: '#2563eb',
                        color: '#fff',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {st.num}
                    </span>
                    <strong style={{ fontSize: '0.86rem', color: '#f4f4f5' }}>{st.title}</strong>
                  </div>
                  <p style={{ fontSize: '0.76rem', color: '#cbd5e1', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                    {st.desc}
                  </p>
                </div>

                <div
                  style={{
                    backgroundColor: '#09090b',
                    border: '1px solid #27272a',
                    borderRadius: '4px',
                    padding: '6px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                  }}
                >
                  <code
                    style={{
                      fontSize: '0.68rem',
                      color: '#38bdf8',
                      whiteSpace: 'normal',
                      wordBreak: 'break-all',
                    }}
                  >
                    {st.cmd}
                  </code>
                  {st.cmd.startsWith('python') && <CopyButton text={st.cmd} label={`Copy Step ${st.num}`} />}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card title="Guided 90-Second Tamper Demo" icon={<PlayCircle color="#3b82f6" />}>
          <p className="cx-sub" style={{ color: '#cbd5e1', margin: 0 }}>
            Enter Demo Mode to run the tamper demo.
          </p>
        </Card>
      )}

      {/* Visual cryptographic chain linkage */}
      <Card
        title="Visual Cryptographic Chain Linkage"
        icon={<Link2 color="#2563ff" />}
        aside={
          <span className="cx-muted cx-mono" style={{ fontSize: '.7rem', fontWeight: 400, textTransform: 'none', color: '#cbd5e1' }}>
            Genesis → Block N (hash chain)
          </span>
        }
        className="ig-chain"
      >
        {loadingChain && <Loading rows={3} height={110} />}
        {chainError && <ErrorState message={chainError} onRetry={loadChain} />}
        {!loadingChain && !links.length && <p className="cx-sub" style={{ color: 'var(--mute, #475569)' }}>No hashed events available.</p>}
        <ol className="chain">
          {links.map((l, i) => {
            const ev = events.find((e) => e.id === l.id);
            const problem = serverVerify?.problems?.find((p: { id: string }) => p.id === l.id);
            const isTampered = Boolean(problem);
            return (
              <li key={l.id}>
                {i > 0 && (
                  <div className="chain__link">
                    <ArrowDown width={12} height={12} />
                    <span>LINK: HMAC(key, prevHash + event)</span>
                  </div>
                )}
                <div className={cx('chain__block', isTampered && 'is-bad')}>
                  <i className="chain__dot" />
                  <div className="chain__head">
                    <b className="cx-id">{l.id}</b>
                    <span className="cx-mono">[{ev?.component}]</span>
                    <span className="cx-mono cx-muted chain__ts">{ev?.timestamp}</span>
                    {overallStatus === 'CHECKING' ? (
                      <Pill tone="gray">CHECKING</Pill>
                    ) : overallStatus === 'UNAVAILABLE' ? (
                      <Pill tone="amber">UNAVAILABLE</Pill>
                    ) : isTampered ? (
                      <Pill tone="red">✕ TAMPERED</Pill>
                    ) : (
                      <Pill tone="green">✓ VERIFIED</Pill>
                    )}
                  </div>
                  <p className="chain__act" style={{ color: 'var(--ink, #0f172a)' }}>
                    <b>Action:</b> {ev?.action} • <b>Classification:</b> {ev?.classification} • <b>Payload:</b> <code>{typeof l.payload === 'object' ? JSON.stringify(l.payload) : String(l.payload ?? '')}</code>
                  </p>
                  {isTampered && (
                    <p className="cx-sub tone-red" style={{ margin: '.2rem 0', fontWeight: 600 }}>
                      ✕ {problem?.reason || 'Record contents do not match HMAC verification'}
                    </p>
                  )}
                  <div className="chain__hash">
                    <span style={{ color: 'var(--mute, #475569)', fontWeight: 600 }}>HMAC-SHA256 Current Hash:</span>
                    <code className="tone-green">{l.hash}</code>
                    <CopyButton text={l.hash} label={`Copy hash of ${l.id}`} />
                  </div>
                  <div className="chain__hash">
                    <span style={{ color: 'var(--mute, #475569)', fontWeight: 600 }}>Previous Parent Hash:</span>
                    <code>{l.prevHash}</code>
                    <CopyButton text={l.prevHash} label={`Copy parent hash of ${l.id}`} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* Educational Standalone SHA-256 Generator */}
      <Card title="Educational Tool: Standalone SHA-256 Generator" icon={<Lock color="#2563ff" />}>
        <p className="cx-sub" style={{ color: 'var(--mute, #475569)' }}>
          Educational utility only — Clarix ledger verification is strictly performed by the backend using keyed HMAC-SHA256 and never uses this client-side generator. Type any string to compute a SHA-256 digest.
        </p>
        <form
          className="cx-row"
          style={{ flexWrap: 'nowrap' }}
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <input
            className="cx-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type payload or test text to hash…"
            aria-label="Text to hash"
          />
          <button type="submit" className="cx-btn cx-btn--primary">
            <Hash />Generate SHA-256
          </button>
        </form>
        {genErr && <p className="cx-sub tone-red" role="alert">{genErr}</p>}
        {digest && (
          <div className="chain__hash" style={{ marginTop: '.8rem' }} role="status">
            <span style={{ color: 'var(--mute, #475569)', fontWeight: 600 }}>SHA-256 Digest:</span>
            <code className="tone-green">{digest}</code>
            <CopyButton text={digest} label="Copy digest" />
          </div>
        )}
      </Card>
    </Page>
  );
}
