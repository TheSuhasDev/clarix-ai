import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  CheckCircle2,
  ShieldAlert,
  Key,
  Terminal,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Database,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  FileCode,
  FileText,
  Sparkles,
} from 'lucide-react';
import {
  Card,
  ClassPill,
  DecisionPill,
  EmptyState,
  ErrorState,
  Loading,
  Page,
  PageHeader,
  RiskPill,
  SearchInput,
  CopyButton,
} from '../components/common';
import { useAsync } from '../hooks/useAsync';
import { auditService } from '../services';
import { useConsole } from '../state/ConsoleContext';
import type { Risk, AuditEvent } from '../types';
import { csvEscape, download } from '../utils/format';

const RISKS: ('All Risk Levels' | Risk)[] = ['All Risk Levels', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

interface AttackCardDef {
  id: string;
  title: string;
  desc: string;
  cmd: string;
  expected: string;
}

const ATTACK_EXPLANATIONS: AttackCardDef[] = [
  {
    id: 'edit_row_and_rehash',
    title: '1. Edit Row & Rehash (Smart Attack)',
    desc: 'Alters audited event #14 (BLOCK -> ALLOW) and recomputes plain SHA-256 hashes downstream. Legacy checkers pass; Clarix catches the missing secret HMAC key.',
    cmd: 'python tools/attack_demo.py --edit-row 14 --rehash',
    expected: 'HMAC signature mismatch on event EVT-000014 -> POL-006 FAIL-CLOSED LOCKDOWN within 2.5s.',
  },
  {
    id: 'truncate_tail',
    title: '2. Truncate Tail Events',
    desc: 'Deletes recent audit records directly from SQLite file to hide unauthorized activity. Caught because the external signed anchor records the exact committed event count.',
    cmd: 'python tools/attack_demo.py --truncate 3',
    expected: 'Database event count < Anchor count -> Immediate anchor mismatch lockdown.',
  },
  {
    id: 'forge_row',
    title: '3. Forge Counterfeit Row',
    desc: 'Injects a fabricated record into SQLite with synthetic timestamps and plain SHA-256. Fails because the row lacks a valid HMAC signature and exceeds anchor count.',
    cmd: 'python tools/attack_demo.py --forge',
    expected: 'Un-anchored row and invalid HMAC signature detected -> System lockdown.',
  },
  {
    id: 'rollback_db',
    title: '4. Rollback Database',
    desc: 'Overwrites current database with an earlier snapshot to roll back audits. Caught instantly by sequence monotonicity and external anchor validation.',
    cmd: 'python tools/attack_demo.py --rollback',
    expected: 'Head hash and count sequence mismatch against external anchor -> Immediate lockdown.',
  },
  {
    id: 'permission',
    title: '5. Elevate Tool Permission',
    desc: 'Alters tool permission level in the tools table directly in SQLite file. Detected because Clarix checks a cryptographically signed HMAC digest over all tool permissions.',
    cmd: 'python tools/attack_demo.py --permission shell NORMAL',
    expected: 'Signed security state signature mismatch -> Security State Violation lockdown.',
  },
  {
    id: 'disable_policy',
    title: '6. Disable Security Policy',
    desc: 'Sets enabled=0 on policies like POL-001 (Injection Defense) directly via raw SQLite. Caught because policy states are signed at boot and checked continuously.',
    cmd: 'python tools/attack_demo.py --disable-policy POL-001',
    expected: 'Signed policy configuration invalid -> Security State Violation lockdown.',
  },
  {
    id: 'drop_trigger',
    title: '7. Drop SQLite Triggers',
    desc: 'Drops database trigger audit_no_update and modifies an event row directly in the file. Trigger Guard verifies trigger existence and validity every 2.5 seconds.',
    cmd: 'python tools/attack_demo.py --drop-trigger',
    expected: 'Missing SQLite trigger detected within 2.5s -> POL-006 FAIL-CLOSED LOCKDOWN triggered.',
  },
];

export default function Audit() {
  const { toast } = useConsole();
  const { data, loading, error, reload } = useAsync(() => auditService.list());
  const { data: integrityStatus, reload: reloadStatus } = useAsync(() => auditService.getIntegrityStatus());

  const [q, setQ] = useState('');
  const [risk, setRisk] = useState<string>('All Risk Levels');
  const [comp, setComp] = useState('All Components');
  const [showCommands, setShowCommands] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [togglingDemo, setTogglingDemo] = useState(false);

  // Timezone display toggle: 'local' | 'utc'
  const [timeMode, setTimeMode] = useState<'local' | 'utc'>('local');

  // Pagination state: 10, 25, 50, 100, or 'all'
  const [pageSize, setPageSize] = useState<number | 'all'>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Row Details Drawer
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  // Server chain verification state
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    ok: boolean;
    count: number;
    head: string;
    ms: number;
    problems: any[];
    ledger?: string;
    dbPath?: string;
  } | null>(null);

  const isDemo = Boolean(integrityStatus?.ledger === 'demo' || integrityStatus?.demoMode);
  const dbPathDisplay = integrityStatus?.dbPath || (isDemo ? 'data/demo/clarix_demo.db' : 'data/clarix.db');

  useEffect(() => {
    const onDemoChanged = () => {
      void Promise.all([reload(), reloadStatus()]);
      setCurrentPage(1);
    };
    window.addEventListener('clarix:demo_mode_changed', onDemoChanged);
    return () => window.removeEventListener('clarix:demo_mode_changed', onDemoChanged);
  }, [reload, reloadStatus]);

  async function handleToggleDemoMode() {
    setTogglingDemo(true);
    try {
      const nextMode = !isDemo;
      const res = await auditService.toggleDemoMode(nextMode);
      toast(res.demoMode ? 'Switched to Demo Mode (isolated sandbox ledger).' : 'Returned to Live Ledger (production files untouched).', 'green');
      window.dispatchEvent(new CustomEvent('clarix:demo_mode_changed', { detail: res }));
      await Promise.all([reload(), reloadStatus()]);
      setCurrentPage(1);
    } catch (e: any) {
      toast(e?.message || 'Failed to toggle demo mode', 'red');
    } finally {
      setTogglingDemo(false);
    }
  }

  const comps = useMemo(() => ['All Components', ...Array.from(new Set((data ?? []).map((e) => e.component)))], [data]);

  const filteredRows = useMemo(() => {
    return (data ?? []).filter((e) => {
      const matchRisk = risk === 'All Risk Levels' || e.risk === risk;
      const matchComp = comp === 'All Components' || e.component === comp;
      const matchQuery =
        !q ||
        `${e.id} ${e.user} ${e.action} ${e.component} ${e.hash ?? ''} ${e.payload}`
          .toLowerCase()
          .includes(q.toLowerCase());
      return matchRisk && matchComp && matchQuery;
    });
  }, [data, q, risk, comp]);

  // Paginated rows
  const paginatedRows = useMemo(() => {
    if (pageSize === 'all') return filteredRows;
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredRows.length / pageSize));

  function formatTime(isoStr: string) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr.endsWith('Z') ? isoStr : isoStr + 'Z');
      if (isNaN(d.getTime())) return isoStr;
      if (timeMode === 'utc') {
        return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
      }
      // Local time with timezone abbreviation
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const shortTz = tz.includes('/') ? tz.split('/')[1].replace(/_/g, ' ') : tz;
      return `${timeStr} (${shortTz})`;
    } catch {
      return isoStr;
    }
  }

  function exportJson() {
    download('clarix-audit.json', JSON.stringify(filteredRows, null, 2), 'application/json');
    toast(`Exported ${filteredRows.length} events (JSON).`, 'green');
  }

  function exportCsv() {
    const head = ['timestamp', 'event_id', 'user', 'action', 'component', 'risk', 'decision', 'classification', 'sha256', 'prev_hash'];
    const lines = filteredRows.map((e) =>
      [e.timestamp, e.id, e.user, e.action, e.component, e.risk, e.decision, e.classification, e.hash ?? '', e.prevHash ?? '']
        .map(csvEscape)
        .join(',')
    );
    download('clarix-audit.csv', [head.join(','), ...lines].join('\n'), 'text/csv');
    toast(`Exported ${filteredRows.length} events (CSV).`, 'green');
  }

  async function exportAnchor() {
    try {
      const anchor = await auditService.exportAnchor();
      download('audit_anchor.json', JSON.stringify(anchor, null, 2), 'application/json');
      toast(`Exported external cryptographic anchor (count: ${anchor.count}).`, 'green');
    } catch (e: any) {
      toast(e.message || 'Failed to export anchor', 'red');
    }
  }

  async function handleResetDemo() {
    setResetting(true);
    try {
      const res = await auditService.resetDemo();
      toast(res.message || 'Demo ledger cleanly reset with 40 seed events.', 'green');
      await Promise.all([reload(), reloadStatus()]);
      setCurrentPage(1);
    } catch (e: any) {
      toast(e?.message || 'Failed to reset demo ledger', 'red');
    } finally {
      setResetting(false);
    }
  }

  async function handleVerifyChainNow() {
    setVerifying(true);
    try {
      const res = await auditService.verifyServer();
      setVerifyResult(res);
      if (res.ok) {
        toast(`Cryptographic verification passed: ${res.count} events checked in ${res.ms}ms.`, 'green');
      } else {
        toast(`Verification failed! ${res.problems?.length ?? 1} integrity problems detected.`, 'red');
      }
    } catch (e: any) {
      toast(e?.message || 'Verification request failed', 'red');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Page>
      <PageHeader
        icon={<FileText color="#2563ff" />}
        title="Audit & Evidence Ledger"
        subtitle="Cryptographically tamper-evident audit trail with keyed HMAC-SHA256, external anchor, and fail-closed lockdown."
        aside={
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            {isDemo ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 11px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(245, 158, 11, 0.16)',
                  color: '#d97706',
                  border: '1px solid rgba(245, 158, 11, 0.45)',
                  letterSpacing: '0.02em',
                }}
                title={`Isolated Demo Ledger: ${dbPathDisplay}`}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#d97706', boxShadow: '0 0 6px #d97706' }} />
                <span>DEMO MODE · sandbox ledger</span>
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 11px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(16, 185, 129, 0.14)',
                  color: '#059669',
                  border: '1px solid rgba(16, 185, 129, 0.45)',
                  letterSpacing: '0.02em',
                }}
                title={`Live Production Ledger: ${dbPathDisplay}`}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#059669', boxShadow: '0 0 6px #059669' }} />
                <span>LIVE LEDGER</span>
              </span>
            )}

            <button
              type="button"
              className="cx-btn cx-btn--ghost cx-btn--sm"
              onClick={handleToggleDemoMode}
              disabled={togglingDemo}
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '6px',
                border: isDemo ? '1px solid #d97706' : '1px solid #cbd5e1',
                color: isDemo ? '#b45309' : '#1e293b',
                backgroundColor: isDemo ? 'rgba(254, 243, 199, 0.9)' : '#ffffff',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
              title={isDemo ? 'Exit Demo Mode and return to live production ledger' : 'Enter Demo Mode to test attacks in safe sandbox'}
            >
              {togglingDemo ? 'Switching…' : isDemo ? 'Exit Demo Mode' : 'Enter Demo Mode'}
            </button>
          </div>
        }
      />

      {/* Verification Result Banner (if run) */}
      {verifyResult && (
        <Card tone={verifyResult.ok ? 'green' : 'red'}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {verifyResult.ok ? <CheckCircle2 color="#059669" width={18} height={18} /> : <ShieldAlert color="#dc2626" width={18} height={18} />}
              <div>
                <b style={{ color: verifyResult.ok ? '#059669' : '#dc2626', fontSize: '0.86rem' }}>
                  {verifyResult.ok ? 'Cryptographic Chain Integrity: VALID (All Hashes & Signatures Verified)' : 'Integrity Check Failed: Tamper Detected'}
                </b>
                <div style={{ fontSize: '0.74rem', color: '#4b5563', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  Target: {verifyResult.dbPath || dbPathDisplay} · Checked: {verifyResult.count} events · Latency: {verifyResult.ms}ms · Head: {verifyResult.head?.slice(0, 16)}…
                </div>
              </div>
            </div>
            <button type="button" className="cx-btn cx-btn--ghost cx-btn--sm" onClick={() => setVerifyResult(null)}>
              <X width={14} height={14} /> Dismiss
            </button>
          </div>
        </Card>
      )}

      {/* Out-of-band Tamper Guide (Interactive Sandbox Panel) */}
      <Card tone="red">
        <div style={{ padding: '8px 6px', background: 'linear-gradient(180deg, #1f0707 0%, #110303 100%)', borderRadius: '8px', margin: '-1rem', paddingBottom: '1.2rem', paddingTop: '0.9rem', paddingLeft: '1.2rem', paddingRight: '1.2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert color="#ef4444" width={22} height={22} />
              <div>
                <h3 style={{ margin: 0, font: '700 0.96rem var(--font-sans)', color: '#fca5a5' }}>
                  Tamper Lockdown Demo & Attack Guide (POL-006)
                </h3>
                <p style={{ margin: '2px 0 0 0', font: '400 0.76rem var(--font-sans)', color: '#cbd5e1' }}>
                  Simulates direct database attacks bypassing APIs. All attacks target the isolated demo sandbox ({dbPathDisplay}).
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="cx-btn"
                style={{
                  backgroundColor: '#1d4ed8',
                  borderColor: '#60a5fa',
                  color: '#ffffff',
                  fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(29, 78, 216, 0.4)',
                }}
                onClick={() => setShowCommands(!showCommands)}
              >
                <Terminal width={14} height={14} />
                {showCommands ? 'Hide Attack Terminal' : 'Show me how to attack it'}
                {showCommands ? <ChevronUp width={13} height={13} /> : <ChevronDown width={13} height={13} />}
              </button>

              <button
                type="button"
                className="cx-btn"
                style={{
                  backgroundColor: '#7f1d1d',
                  borderColor: '#ef4444',
                  color: '#fef2f2',
                  fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                }}
                disabled={resetting}
                onClick={handleResetDemo}
                title="Rebuild demo ledger with 40 fixed seed events and fresh anchor"
              >
                <RotateCcw width={14} height={14} />
                {resetting ? 'Resetting…' : 'Reset Demo Ledger (40 Events)'}
              </button>
            </div>
          </div>

          {/* Quick Terminal Command Box */}
          {showCommands && (
            <div
              style={{
                backgroundColor: '#0a0a0c',
                border: '1px solid #3f3f46',
                borderRadius: '6px',
                padding: '12px 14px',
                marginBottom: '14px',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.8rem',
                color: '#e4e4e7',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #27272a', paddingBottom: '6px' }}>
                <span style={{ color: '#a1a1aa', fontWeight: 600 }}>External Terminal Commands (Run in PowerShell / Bash)</span>
                <span style={{ color: '#ef4444', fontSize: '0.74rem' }}>Target: data/demo/clarix_demo.db (Production DB strictly protected)</span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.74rem', marginBottom: '8px' }}>
                Working directory: <code style={{ color: '#38bdf8' }}>cd c:\Users\suhas\Desktop\clarix-ai</code>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>
                  <span style={{ color: '#71717a' }}># 1. View audit events in demo database:</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#18181b', padding: '5px 8px', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    <code>python tools/attack_demo.py --list</code>
                    <CopyButton text="python tools/attack_demo.py --list" label="Copy command" />
                  </div>
                </div>
                <div>
                  <span style={{ color: '#71717a' }}># 2. Smart attack: tamper event #14 (BLOCK -&gt; ALLOW) and rehash chain with plain SHA-256:</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#18181b', padding: '5px 8px', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    <code style={{ color: '#f87171' }}>python tools/attack_demo.py --edit-row 14 --rehash</code>
                    <CopyButton text="python tools/attack_demo.py --edit-row 14 --rehash" label="Copy command" />
                  </div>
                </div>
                <div>
                  <span style={{ color: '#71717a' }}># 3. Check legacy verifier (unkeyed hash chain passes completely undetected):</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#18181b', padding: '5px 8px', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    <code style={{ color: '#38bdf8' }}>python tools/attack_demo.py --legacy-verify</code>
                    <CopyButton text="python tools/attack_demo.py --legacy-verify" label="Copy command" />
                  </div>
                </div>
                <div>
                  <span style={{ color: '#71717a' }}># 4. Truncate latest 3 records from SQLite file:</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#18181b', padding: '5px 8px', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    <code>python tools/attack_demo.py --truncate 3</code>
                    <CopyButton text="python tools/attack_demo.py --truncate 3" label="Copy command" />
                  </div>
                </div>
                <div>
                  <span style={{ color: '#71717a' }}># 5. Elevate tool permission directly in DB:</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#18181b', padding: '5px 8px', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    <code>python tools/attack_demo.py --permission shell NORMAL</code>
                    <CopyButton text="python tools/attack_demo.py --permission shell NORMAL" label="Copy command" />
                  </div>
                </div>
                <div>
                  <span style={{ color: '#71717a' }}># 6. Disable security policy directly in DB:</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#18181b', padding: '5px 8px', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    <code>python tools/attack_demo.py --disable-policy POL-001</code>
                    <CopyButton text="python tools/attack_demo.py --disable-policy POL-001" label="Copy command" />
                  </div>
                </div>
                <div>
                  <span style={{ color: '#71717a' }}># 7. Drop SQLite append-only trigger and modify event:</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#18181b', padding: '5px 8px', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    <code>python tools/attack_demo.py --drop-trigger</code>
                    <CopyButton text="python tools/attack_demo.py --drop-trigger" label="Copy command" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 7 Attack Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '10px' }}>
            {ATTACK_EXPLANATIONS.map((atk) => (
              <div
                key={atk.id}
                style={{
                  backgroundColor: '#160a0a',
                  border: '1px solid #450a0a',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#fca5a5' }}>{atk.title}</span>
                    <CopyButton text={atk.cmd} label={`Copy ${atk.title} command`} />
                  </div>
                  <p style={{ fontSize: '0.72rem', color: '#d1d5db', lineHeight: 1.35, margin: '0 0 6px' }}>{atk.desc}</p>
                </div>

                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.64rem', marginBottom: '2px', fontFamily: 'var(--font-mono)' }}>
                    cd c:\Users\suhas\Desktop\clarix-ai
                  </div>
                  <div style={{ backgroundColor: '#090404', border: '1px solid #27272a', borderRadius: '4px', padding: '5px 7px', marginBottom: '5px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.35 }}>
                    <code style={{ fontSize: '0.68rem', color: '#93c5fd', fontFamily: 'var(--font-mono)' }}>{atk.cmd}</code>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#f87171', fontStyle: 'italic', lineHeight: 1.25 }}>
                    <b>Expected:</b> {atk.expected}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Toolbar */}
      <div className="cx-toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search events, actions, tools, HMAC/SHA-256 hashes…" label="Search audit events" />
        <select className="cx-select" aria-label="Risk level" value={risk} onChange={(e) => setRisk(e.target.value)}>
          {RISKS.map((r) => <option key={r}>{r}</option>)}
        </select>
        <select className="cx-select" aria-label="Component" value={comp} onChange={(e) => setComp(e.target.value)}>
          {comps.map((c) => <option key={c}>{c}</option>)}
        </select>

        <button
          type="button"
          className="cx-btn"
          style={{ backgroundColor: '#047857', borderColor: '#10b981', color: '#ffffff', fontWeight: 700, boxShadow: '0 2px 6px rgba(4, 120, 87, 0.25)' }}
          disabled={verifying}
          onClick={handleVerifyChainNow}
          title="Verify full cryptographic HMAC-SHA256 chain and external anchor"
        >
          <ShieldCheck width={14} height={14} />
          {verifying ? 'Verifying…' : 'Verify chain now'}
        </button>

        <button
          type="button"
          className="cx-btn"
          style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a', fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          onClick={() => setTimeMode(timeMode === 'local' ? 'utc' : 'local')}
          title="Toggle timestamp between Local workstation time and UTC"
        >
          <Clock width={14} height={14} />
          {timeMode === 'local' ? 'Local Time' : 'UTC Time'}
        </button>

        <button
          type="button"
          className="cx-btn"
          style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a', fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          onClick={exportAnchor}
          title="Export signed anchor file"
        >
          <Key color="#d97706" width={14} height={14} /> Anchor
        </button>
        <button
          type="button"
          className="cx-btn"
          style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a', fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          disabled={!filteredRows.length}
          onClick={exportJson}
        >
          <Download color="#2563ff" width={14} height={14} /> JSON
        </button>
        <button
          type="button"
          className="cx-btn"
          style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a', fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          disabled={!filteredRows.length}
          onClick={exportCsv}
        >
          <Download color="#059669" width={14} height={14} /> CSV
        </button>
      </div>

      {/* Audit Table Card */}
      <Card>
        {loading && <Loading rows={5} height={44} />}
        {error && <ErrorState message={error} onRetry={reload} />}
        {data && filteredRows.length === 0 && <EmptyState title="No events match your filters" />}
        {data && filteredRows.length > 0 && (
          <>
            <div className="cx-tbl-wrap" style={{ overflowX: 'auto', maxWidth: '100%', position: 'relative', borderRadius: '8px' }}>
              <table className="cx-tbl" style={{ minWidth: '980px', width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', left: 0, zIndex: 3, background: '#ffffff', width: 110, whiteSpace: 'nowrap', boxShadow: '2px 0 5px rgba(0,0,0,0.06)' }}>
                      Event ID
                    </th>
                    <th style={{ width: 135, whiteSpace: 'nowrap' }}>Time ({timeMode.toUpperCase()})</th>
                    <th style={{ width: 95, whiteSpace: 'nowrap' }}>User</th>
                    <th style={{ minWidth: 220 }}>Action</th>
                    <th style={{ width: 120, whiteSpace: 'nowrap' }}>Component</th>
                    <th style={{ width: 85, whiteSpace: 'nowrap' }}>Risk</th>
                    <th style={{ width: 95, whiteSpace: 'nowrap' }}>Decision</th>
                    <th style={{ width: 120, whiteSpace: 'nowrap' }}>Classification</th>
                    <th style={{ width: 135, whiteSpace: 'nowrap' }}>Hash (HMAC)</th>
                    <th style={{ width: 60, textAlign: 'center', whiteSpace: 'nowrap' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((e) => (
                    <tr
                      key={e.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedEvent(e)}
                    >
                      <td className="cx-id" style={{ position: 'sticky', left: 0, zIndex: 2, background: '#ffffff', whiteSpace: 'nowrap', fontWeight: 700, boxShadow: '2px 0 5px rgba(0,0,0,0.06)' }}>
                        {e.id}
                      </td>
                      <td className="cx-mono" style={{ fontSize: '.74rem', whiteSpace: 'nowrap' }}>
                        {formatTime(e.timestamp)}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{e.user}</td>
                      <td style={{ fontWeight: 600, wordBreak: 'break-word' }}>{e.action}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className="cx-pill cx-pill--gray" style={{ whiteSpace: 'nowrap' }}>
                          {e.component}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}><RiskPill risk={e.risk} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}><DecisionPill decision={e.decision} /></td>
                      <td style={{ whiteSpace: 'nowrap' }} title={`Classification: ${e.classification}`}>
                        <ClassPill value={e.classification} />
                      </td>
                      <td className="cx-mono" style={{ fontSize: '.72rem', whiteSpace: 'nowrap' }}>
                        {e.hash ? (
                          <>
                            {e.hash.slice(0, 10)}…
                            <CopyButton text={e.hash} label={`Copy hash of ${e.id}`} />
                          </>
                        ) : (
                          <span className="cx-muted">n/a</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="cx-btn cx-btn--ghost cx-btn--sm"
                          style={{ padding: '3px 7px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1' }}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setSelectedEvent(e);
                          }}
                          title="View raw canonical payload & cryptographic hashes"
                        >
                          <Eye width={12} height={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                marginTop: '12px',
                paddingTop: '8px',
                borderTop: '1px solid var(--border, #e5e7eb)',
                fontSize: '0.78rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Page size:</span>
                {[10, 25, 50, 100, 'all' as const].map((ps) => (
                  <button
                    key={ps}
                    type="button"
                    className={`cx-btn cx-btn--sm ${pageSize === ps ? 'cx-btn--primary' : 'cx-btn--ghost'}`}
                    style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                    onClick={() => {
                      setPageSize(ps);
                      setCurrentPage(1);
                    }}
                  >
                    {ps === 'all' ? 'All' : ps}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: 'var(--muted, #64748b)' }}>
                  Showing{' '}
                  {pageSize === 'all'
                    ? `all ${filteredRows.length}`
                    : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredRows.length)} of ${filteredRows.length}`}{' '}
                  events
                </span>

                {pageSize !== 'all' && totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      type="button"
                      className="cx-btn cx-btn--ghost cx-btn--sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft width={14} height={14} />
                    </button>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      className="cx-btn cx-btn--ghost cx-btn--sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                      <ChevronRight width={14} height={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Row Details Modal / Drawer */}
      {selectedEvent && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={() => setSelectedEvent(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              maxWidth: '720px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
              border: '1px solid #cbd5e1',
              padding: '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCode width={18} height={18} color="#2563eb" />
                  Audit Record: {selectedEvent.id}
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                  Sequence: {(selectedEvent as any).seq ?? 'N/A'} · Timestamp: {formatTime(selectedEvent.timestamp)} ({selectedEvent.timestamp})
                </span>
              </div>
              <button
                type="button"
                className="cx-btn cx-btn--ghost cx-btn--sm"
                onClick={() => setSelectedEvent(null)}
              >
                <X width={16} height={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' }}>
              <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Actor / User</span>
                <b style={{ fontSize: '0.86rem' }}>{selectedEvent.user}</b>
              </div>
              <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Decision</span>
                <DecisionPill decision={selectedEvent.decision} />
              </div>
              <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Risk</span>
                <RiskPill risk={selectedEvent.risk} />
              </div>
              <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Classification</span>
                <ClassPill value={selectedEvent.classification} />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                Action
              </span>
              <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.84rem', fontWeight: 600 }}>
                {selectedEvent.action}
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>Payload</span>
                <CopyButton text={selectedEvent.payload || ''} label="Copy Payload" />
              </div>
              <div style={{ background: '#0f172a', color: '#f8fafc', padding: '8px 12px', borderRadius: '6px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', overflowX: 'auto', wordBreak: 'break-all' }}>
                {selectedEvent.payload || '<empty>'}
              </div>
            </div>

            {selectedEvent.canonical && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>Canonical String (Signed)</span>
                  <CopyButton text={selectedEvent.canonical} label="Copy Canonical" />
                </div>
                <div style={{ background: '#f1f5f9', color: '#334155', padding: '8px 12px', borderRadius: '6px', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', overflowX: 'auto', wordBreak: 'break-all' }}>
                  {selectedEvent.canonical}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>Current Block Hash (HMAC-SHA256)</span>
                  <CopyButton text={selectedEvent.hash || ''} label="Copy Hash" />
                </div>
                <code style={{ fontSize: '0.72rem', color: '#0f172a', background: '#f8fafc', padding: '4px 8px', borderRadius: '4px', display: 'block', wordBreak: 'break-all' }}>
                  {selectedEvent.hash || 'GENESIS'}
                </code>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>Parent Hash (prev_hash link)</span>
                  <CopyButton text={selectedEvent.prevHash || ''} label="Copy Parent Hash" />
                </div>
                <code style={{ fontSize: '0.72rem', color: '#0f172a', background: '#f8fafc', padding: '4px 8px', borderRadius: '4px', display: 'block', wordBreak: 'break-all' }}>
                  {selectedEvent.prevHash || '0'.repeat(64)}
                </code>
              </div>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
