import { useMemo, useState } from 'react';
import { Download, FileText, CheckCircle2, ShieldAlert, Key } from 'lucide-react';
import { Card, ClassPill, DecisionPill, EmptyState, ErrorState, Loading, Page, PageHeader, Pill, RiskPill, SearchInput, CopyButton } from '../components/common';
import { useAsync } from '../hooks/useAsync';
import { auditService } from '../services';
import { useConsole } from '../state/ConsoleContext';
import type { Risk } from '../types';
import { csvEscape, download } from '../utils/format';

const RISKS: ('All Risk Levels' | Risk)[] = ['All Risk Levels', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const DEMO_ATTACKS = [
  { id: 'edit_row_and_rehash', label: '1. Edit Row & Rehash', desc: 'Bypass HMAC with legacy SHA-256' },
  { id: 'truncate_tail', label: '2. Truncate Tail', desc: 'Delete latest events from SQLite' },
  { id: 'forge_row', label: '3. Forge Row', desc: 'Insert un-anchored valid event' },
  { id: 'rollback_db', label: '4. Rollback DB', desc: 'Revert DB to an older copy' },
  { id: 'change_permission', label: '5. Elevate Tool', desc: 'Direct SQLite permission update' },
  { id: 'disable_policy', label: '6. Disable Policy', desc: 'Direct SQLite policy disable' },
  { id: 'drop_trigger', label: '7. Drop Trigger', desc: 'Drop audit_no_update trigger' },
];

export default function Audit() {
  const { toast } = useConsole();
  const { data, loading, error, reload } = useAsync(() => auditService.list());
  const [q, setQ] = useState('');
  const [risk, setRisk] = useState<string>('All Risk Levels');
  const [comp, setComp] = useState('All Components');
  const [tampering, setTampering] = useState<string | null>(null);

  const comps = useMemo(() => ['All Components', ...Array.from(new Set((data ?? []).map((e) => e.component)))], [data]);
  const rows = useMemo(() => (data ?? []).filter((e) =>
    (risk === 'All Risk Levels' || e.risk === risk) && (comp === 'All Components' || e.component === comp) &&
    `${e.id} ${e.user} ${e.action} ${e.component} ${e.hash ?? ''} ${e.payload}`.toLowerCase().includes(q.toLowerCase())), [data, q, risk, comp]);

  function exportJson() {
    download('clarix-audit.json', JSON.stringify(rows, null, 2), 'application/json');
    toast(`Exported ${rows.length} events (JSON).`, 'green');
  }

  function exportCsv() {
    const head = ['timestamp', 'event_id', 'user', 'action', 'component', 'risk', 'decision', 'classification', 'sha256', 'prev_hash'];
    const lines = rows.map((e) => [e.timestamp, e.id, e.user, e.action, e.component, e.risk, e.decision, e.classification, e.hash ?? '', e.prevHash ?? ''].map(csvEscape).join(','));
    download('clarix-audit.csv', [head.join(','), ...lines].join('\n'), 'text/csv');
    toast(`Exported ${rows.length} events (CSV).`, 'green');
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

  async function runTamperAttack(attackId: string, label: string) {
    setTampering(attackId);
    try {
      const res = await auditService.demoTamper(attackId);
      toast(`Executed tamper demo "${label}". System entering fail-closed lockdown.`, 'red');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('clarix:system_locked', {
          detail: {
            status: 423,
            code: 'system_locked',
            reason: res.reason || `Demo attack simulation: ${attackId}`,
            evidence: res.evidence || `Out-of-band tampering injected on ${attackId}`,
          },
        }));
      }
    } catch (e: any) {
      toast(e.message || `Tamper injection failed: ${attackId}`, 'red');
    } finally {
      setTampering(null);
    }
  }

  return (
    <Page>
      <PageHeader
        icon={<FileText color="#0a9f73" />}
        title="Tamper-Evident Audit & Security Ledger"
        subtitle="Complete cryptographic audit trail with keyed HMAC-SHA256, external anchor, signed state, and fail-closed lockdown (POL-006)."
        aside={<Pill tone="green" large><CheckCircle2 />{data?.length ?? 0} Cryptographic Blocks Committed</Pill>}
      />

      {/* Tamper Attack Demonstration Panel */}
      <Card>
        <div style={{ border: '1px solid rgba(239, 68, 68, 0.35)', backgroundColor: 'rgba(239, 68, 68, 0.04)', padding: '16px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert width={18} height={18} color="#ef4444" />
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#f87171' }}>
                Tamper Attack Demonstration (POL-006 Lockdown Sandbox)
              </h3>
            </div>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600 }}>
              Simulates out-of-band DB tampering bypassing audited APIs
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
            {DEMO_ATTACKS.map((atk) => (
              <button
                key={atk.id}
                type="button"
                disabled={tampering !== null}
                onClick={() => runTamperAttack(atk.id, atk.label)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  backgroundColor: tampering === atk.id ? '#450a0a' : '#1e1414',
                  border: '1px solid #7f1d1d',
                  color: '#fecaca',
                  cursor: tampering !== null ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#fca5a5' }}>{atk.label}</div>
                <div style={{ fontSize: '0.72rem', color: '#a1a1aa', marginTop: '2px' }}>{atk.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="cx-toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search events, actions, tools, HMAC/SHA-256 hashes…" label="Search audit events" />
        <select className="cx-select" aria-label="Risk level" value={risk} onChange={(e) => setRisk(e.target.value)}>{RISKS.map((r) => <option key={r}>{r}</option>)}</select>
        <select className="cx-select" aria-label="Component" value={comp} onChange={(e) => setComp(e.target.value)}>{comps.map((c) => <option key={c}>{c}</option>)}</select>
        <button type="button" className="cx-btn cx-btn--ghost" onClick={exportAnchor} title="Export signed anchor file with cryptographic head signature">
          <Key color="#f59e0b" width={14} height={14} />Export Anchor
        </button>
        <button type="button" className="cx-btn cx-btn--ghost" disabled={!rows.length} onClick={exportJson}><Download color="#2563ff" />JSON</button>
        <button type="button" className="cx-btn cx-btn--ghost" disabled={!rows.length} onClick={exportCsv}><Download color="#0a9f73" />CSV</button>
      </div>

      <Card>
        {loading && <Loading rows={5} height={44} />}
        {error && <ErrorState message={error} onRetry={reload} />}
        {data && rows.length === 0 && <EmptyState title="No events match your filters" />}
        {data && rows.length > 0 && (
          <div className="cx-tbl-wrap">
            <table className="cx-tbl">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event ID</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Component</th>
                  <th>Risk</th>
                  <th>Decision</th>
                  <th>Class</th>
                  <th>Hash (HMAC)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="cx-mono" style={{ fontSize: '.76rem', whiteSpace: 'nowrap' }}>{e.timestamp}</td>
                    <td className="cx-id">{e.id}</td>
                    <td>{e.user}</td>
                    <td style={{ fontWeight: 600 }}>{e.action}</td>
                    <td><span className="cx-pill cx-pill--gray">{e.component}</span></td>
                    <td><RiskPill risk={e.risk} /></td>
                    <td><DecisionPill decision={e.decision} /></td>
                    <td><ClassPill value={e.classification} /></td>
                    <td className="cx-mono" style={{ fontSize: '.72rem', whiteSpace: 'nowrap' }}>
                      {e.hash ? (
                        <>
                          {e.hash.slice(0, 12)}…
                          <CopyButton text={e.hash} label={`Copy hash of ${e.id}`} />
                        </>
                      ) : (
                        <span className="cx-muted">n/a</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  );
}
