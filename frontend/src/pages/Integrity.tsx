import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
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
import { useAsync } from '../hooks/useAsync';
import { auditService, type VerifierComparison } from '../services';
import { useConsole } from '../state/ConsoleContext';
import type { AuditEvent } from '../types';
import { cx } from '../utils/format';
import { isCryptoAvailable, sha256Hex, verifyChain, type ChainLink, type VerifyResult } from '../utils/sha256';

export default function Integrity() {
  const { settings, toast } = useConsole();
  const cryptoOk = settings.webCrypto && isCryptoAvailable();

  const { data, loading, error, reload } = useAsync(() => auditService.chain());
  const { data: intStatus, reload: reloadStatus } = useAsync(() => auditService.getIntegrityStatus());

  const [comparison, setComparison] = useState<VerifierComparison | null>(null);
  const [comparing, setComparing] = useState(false);
  const [links, setLinks] = useState<ChainLink[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [results, setResults] = useState<Record<string, VerifyResult>>({});
  const [verifying, setVerifying] = useState(false);
  const [text, setText] = useState('');
  const [digest, setDigest] = useState('');
  const [genErr, setGenErr] = useState('');

  const loadComparison = useCallback(async () => {
    try {
      setComparing(true);
      const comp = await auditService.compareVerifiers();
      setComparison(comp);
    } catch {
      // ignore transient poll error
    } finally {
      setComparing(false);
    }
  }, []);

  const verify = useCallback(async (l: ChainLink[]) => {
    if (!cryptoOk || !l.length) return;
    setVerifying(true);
    try {
      const r = await verifyChain(l);
      setResults(Object.fromEntries(r.map((x) => [x.id, x])));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Verification failed', 'red');
    } finally {
      setVerifying(false);
    }
  }, [cryptoOk, toast]);

  useEffect(() => {
    if (!data) return;
    const l = data.map((d) => d.link).filter((x) => x.hash);
    setEvents(data.map((d) => d.event));
    setLinks(l);
    void verify(l);
  }, [data, verify]);

  useEffect(() => {
    loadComparison();
    const timer = setInterval(() => {
      loadComparison();
      reloadStatus();
    }, 3000);
    return () => clearInterval(timer);
  }, [loadComparison, reloadStatus]);

  const broken = Object.values(results).filter((r) => !r.ok);
  const isLocked = intStatus?.locked || comparison?.status === 'TAMPER_DETECTED';
  const status = !cryptoOk
    ? 'UNAVAILABLE'
    : isLocked
    ? 'LOCKED'
    : !Object.keys(results).length
    ? 'PENDING'
    : broken.length
    ? 'BROKEN'
    : 'VERIFIED';

  async function generate() {
    setGenErr('');
    try {
      setDigest(await sha256Hex(text));
    } catch (e) {
      setDigest('');
      setGenErr(e instanceof Error ? e.message : 'Hashing failed');
    }
  }

  const DEMO_STEPS = [
    {
      num: 1,
      title: 'Baseline Check',
      desc: 'Confirm all 40 seed events are cryptographically sealed and verified.',
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
      cmd: 'Review side-by-side comparison below',
    },
    {
      num: 5,
      title: 'Audit-Signed Recovery',
      desc: 'Rebaseline with admin credentials and mandatory 20+ character security justification.',
      cmd: 'Click "Recover System" in lockdown overlay',
    },
  ];

  return (
    <Page>
      <PageHeader
        icon={<FileText color="#2563ff" />}
        title="Tamper Lockdown & Cryptographic Verification"
        subtitle="Keyed HMAC-SHA256, external anchor, signed security state, and fail-closed lockdown (POL-006)."
        aside={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Pill tone={cryptoOk ? 'green' : 'amber'} large>
              <ShieldCheck />Web Crypto API (SubtleCrypto)
            </Pill>
          </div>
        }
      />

      {!settings.webCrypto && <div className="cx-banner"><AlertTriangle />Web Crypto verification is switched off in Settings.</div>}
      {settings.webCrypto && !isCryptoAvailable() && <div className="cx-banner cx-banner--red"><AlertTriangle />Web Crypto is unavailable. Open this app from localhost or HTTPS.</div>}

      {/* Top Status Card */}
      <Card className="ig-top">
        <span className={cx('cx-icon-box', isLocked ? 'cx-icon-box--red' : 'cx-icon-box--blue')} style={{ width: '4rem', height: '4rem' }}>
          {isLocked ? <ShieldAlert color="#ef4444" /> : <ShieldCheck />}
        </span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="cx-row">
            <h2 className="ig-top__h">
              {isLocked ? 'POL-006 FAIL-CLOSED LOCKDOWN ACTIVE' : 'Ledger Integrity & Cryptographic Seal'}
            </h2>
            <Pill tone={status === 'VERIFIED' ? 'green' : status === 'LOCKED' || status === 'BROKEN' ? 'red' : 'gray'}>
              {status === 'VERIFIED' ? '✓ VERIFIED' : status === 'LOCKED' ? '✕ SYSTEM LOCKED' : status}
            </Pill>
          </div>
          <p className="cx-sub" style={{ margin: '.3rem 0 0' }}>
            {isLocked
              ? `Cryptographic tampering detected. System locked under POL-006. Reason: ${intStatus?.reason || comparison?.clarix.reason || 'Out-of-band tampering'}`
              : `Each event is signed with an isolated HMAC key and anchored to an external verifiable state. All defense layers operational.`}
          </p>
        </div>
        <div className="cx-row">
          <button
            type="button"
            className="cx-btn cx-btn--primary"
            disabled={!cryptoOk || verifying}
            onClick={() => {
              void verify(links);
              void loadComparison();
              void reload();
            }}
          >
            {verifying || comparing ? <Spinner label="Verifying" /> : <><RefreshCw />Re-Verify Entire System</>}
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
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>
                  ATTACKER / NAIVE VIEW
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9' }}>
                  Legacy Plain SHA-256 Chain
                </h3>
              </div>
              <Pill tone={comparison?.legacy.status === 'VALID' ? 'green' : 'red'}>
                {comparison?.legacy.status === 'VALID' ? '✓ VALID / CLEAN' : '✕ DETECTED'}
              </Pill>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.45, margin: '0 0 12px 0' }}>
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
                ⚠️ The "Smart Attacker" Blindspot:
              </div>
              <div>
                If an attacker alters row 14 and recalculates downstream SHA-256 hashes, the naive verifier
                reports <strong>100% CLEAN</strong>. It cannot detect that history was rewritten.
              </div>
            </div>

            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Status: <code style={{ color: '#38bdf8' }}>{comparison?.legacy.reason || 'Unbroken parent-child hashes'}</code>
            </div>
          </div>

          {/* Right Column: Clarix 4-Layer Verifier */}
          <div
            style={{
              backgroundColor: isLocked ? '#1f0909' : '#061a12',
              border: isLocked ? '2px solid #ef4444' : '1px solid #059669',
              borderRadius: '8px',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: isLocked ? '#fca5a5' : '#6ee7b7', fontWeight: 700 }}>
                  CLARIX PRODUCTION DEFENSE
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                  Keyed HMAC + Anchor + Signed State
                </h3>
              </div>
              <Pill tone={isLocked ? 'red' : 'green'}>
                {isLocked ? '✕ TAMPER DETECTED' : '✓ VERIFIED'}
              </Pill>
            </div>

            <p style={{ fontSize: '0.82rem', color: isLocked ? '#fecaca' : '#a7f3d0', lineHeight: 1.45, margin: '0 0 12px 0' }}>
              Clarix uses 4 independent verification layers with isolated secret keys and external anchors.
              Even if hashes are recalculated, the attack is stopped cold.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
                {comparison?.clarix.layers.hmac_chain.ok !== false ? (
                  <CheckCircle2 width={15} height={15} color="#10b981" />
                ) : (
                  <XCircle width={15} height={15} color="#ef4444" />
                )}
                <span>
                  <strong>1. HMAC-SHA256 Chain:</strong> Keyed with air-gapped <code>audit.key</code>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
                {comparison?.clarix.layers.external_anchor.ok !== false ? (
                  <CheckCircle2 width={15} height={15} color="#10b981" />
                ) : (
                  <XCircle width={15} height={15} color="#ef4444" />
                )}
                <span>
                  <strong>2. External Head Anchor:</strong> Head hash sealed outside the database
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
                {comparison?.clarix.layers.signed_security_state.ok !== false ? (
                  <CheckCircle2 width={15} height={15} color="#10b981" />
                ) : (
                  <XCircle width={15} height={15} color="#ef4444" />
                )}
                <span>
                  <strong>3. Signed Security State:</strong> Tools, policies, and schemas signed
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
                {comparison?.clarix.layers.schema_triggers.ok !== false ? (
                  <CheckCircle2 width={15} height={15} color="#10b981" />
                ) : (
                  <XCircle width={15} height={15} color="#ef4444" />
                )}
                <span>
                  <strong>4. SQLite Immutability Triggers:</strong> Fail-closed block on UPDATE/DELETE
                </span>
              </div>
            </div>

            {isLocked && (
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
                <strong>Detection Detail:</strong> {comparison?.clarix.reason || intStatus?.reason}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Guided 90-Second Demo Walkthrough Panel */}
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
                <p style={{ fontSize: '0.76rem', color: '#a1a1aa', margin: '0 0 10px 0', lineHeight: 1.4 }}>
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
                <code style={{ fontSize: '0.68rem', color: '#38bdf8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {st.cmd}
                </code>
                {st.cmd.startsWith('python') && <CopyButton text={st.cmd} label={`Copy Step ${st.num}`} />}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Visual cryptographic chain linkage */}
      <Card
        title="Visual Cryptographic Chain Linkage"
        icon={<Link2 color="#2563ff" />}
        aside={
          <span className="cx-muted cx-mono" style={{ fontSize: '.7rem', fontWeight: 400, textTransform: 'none' }}>
            Genesis → Block N (Merkle root)
          </span>
        }
        className="ig-chain"
      >
        {loading && <Loading rows={3} height={110} />}
        {error && <ErrorState message={error} onRetry={reload} />}
        {data && !links.length && <p className="cx-sub">No hashed events available (Web Crypto disabled or unavailable).</p>}
        <ol className="chain">
          {links.map((l, i) => {
            const ev = events.find((e) => e.id === l.id);
            const r = results[l.id];
            const bad = r && !r.ok;
            return (
              <li key={l.id}>
                {i > 0 && (
                  <div className="chain__link">
                    <ArrowDown width={12} height={12} />
                    <span>LINK: hash(prevHash + payload)</span>
                  </div>
                )}
                <div className={cx('chain__block', bad && 'is-bad')}>
                  <i className="chain__dot" />
                  <div className="chain__head">
                    <b className="cx-id">{l.id}</b>
                    <span className="cx-mono">[{ev?.component}]</span>
                    <span className="cx-mono cx-muted chain__ts">{ev?.timestamp}</span>
                    {r ? (
                      <Pill tone={r.ok ? 'green' : 'red'}>{r.ok ? '✓ VERIFIED' : '✕ BROKEN'}</Pill>
                    ) : (
                      <Pill tone="gray">UNVERIFIED</Pill>
                    )}
                  </div>
                  <p className="chain__act">
                    <b>Action:</b> {ev?.action} • <b>Classification:</b> {ev?.classification} • <b>Payload:</b> <code>{l.payload}</code>
                  </p>
                  {bad && <p className="cx-sub tone-red" style={{ margin: '.2rem 0' }}>{r.reason}</p>}
                  <div className="chain__hash">
                    <span>HMAC-SHA256 Current Hash:</span>
                    <code className="tone-green">{l.hash}</code>
                    <CopyButton text={l.hash} label={`Copy hash of ${l.id}`} />
                  </div>
                  <div className="chain__hash">
                    <span>Previous Parent Hash:</span>
                    <code>{l.prevHash}</code>
                    <CopyButton text={l.prevHash} label={`Copy parent hash of ${l.id}`} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* Interactive SHA-256 Generator */}
      <Card title="Interactive Web Crypto SHA-256 Generator" icon={<Lock color="#2563ff" />}>
        <p className="cx-sub">Type any string to compute its SHA-256 digest locally with the browser’s SubtleCrypto API (real hashing).</p>
        <form className="cx-row" style={{ flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); void generate(); }}>
          <input className="cx-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type payload or audit text to test…" aria-label="Text to hash" />
          <button type="submit" className="cx-btn cx-btn--primary" disabled={!cryptoOk}><Hash />Generate SHA-256</button>
        </form>
        {genErr && <p className="cx-sub tone-red" role="alert">{genErr}</p>}
        {digest && <div className="chain__hash" style={{ marginTop: '.8rem' }} role="status"><span>Digest:</span><code className="tone-green">{digest}</code><CopyButton text={digest} label="Copy digest" /></div>}
      </Card>
    </Page>
  );
}
