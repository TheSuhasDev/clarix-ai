import { useMemo, useState } from 'react';
import { Calculator, CheckCircle2, Database, FileText, Info, Play, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, Page, PageHeader, Pill, Spinner } from '../components/common';
import { useAsync } from '../hooks/useAsync';
import { toolService, type ToolRun } from '../services/toolService';
import { useConsole } from '../state/ConsoleContext';
import { cx } from '../utils/format';

const ICON: Record<string, ReactNode> = { calc: <Calculator />, fs: <FileText />, db: <Database />, sysinfo: <Info /> };

const BASE_CARDS = [
  { id: 'calc', name: 'Calculator', verb: 'EXECUTE', desc: 'Abstract syntax tree parser evaluating arithmetic without eval() or shell access.', sample: '(450 * 1.15) / 12' },
  { id: 'fs', name: 'File Reader', verb: 'READ', desc: 'Sandboxed file reader restricted strictly to workspace directory.', sample: 'network_topology.csv' },
  { id: 'db', name: 'Local Database Query', verb: 'READ', desc: 'Local SQLite read-only SELECT querying vector indices and metadata.', sample: 'SELECT count(*) FROM chunks' },
  { id: 'sysinfo', name: 'System Information', verb: 'READ', desc: 'Static host sandbox telemetry (OS, architecture, hardware memory bounds).', sample: 'info' },
];

export default function LocalTools() {
  const { toast } = useConsole();
  const { data: toolsList, reload } = useAsync(() => toolService.list());
  const [sel, setSel] = useState('calc');
  const [input, setInput] = useState(BASE_CARDS[0].sample);
  const [out, setOut] = useState<ToolRun | null>(null);
  const [busy, setBusy] = useState(false);

  const cards = useMemo(() => {
    const list = toolsList || [];
    return BASE_CARDS.map((b) => {
      const match = list.find((t) => t.id === b.id);
      return {
        ...b,
        runs: match ? match.executions : 0,
      };
    });
  }, [toolsList]);

  const card = cards.find((c) => c.id === sel) ?? cards[0];

  function choose(id: string) {
    const c = cards.find((x) => x.id === id);
    if (!c) return;
    setSel(id); setInput(c.sample); setOut(null);
  }
  async function run() {
    if (!input.trim()) { setOut({ ok: false, ms: 0, output: 'Enter an argument first.' }); return; }
    setBusy(true);
    try {
      const res = await toolService.execute(sel, input);
      setOut(res);
      reload();
    }
    catch (e) { setOut(null); toast(e instanceof Error ? e.message : 'Execution failed', 'red'); }
    finally { setBusy(false); }
  }

  return (
    <Page>
      <PageHeader icon={<Wrench color="#8b5cf6" />} title="Local Tools Runtime & Execution Gateway" subtitle="Whitelisted, deterministic computation executed safely on localhost. No shell expansion or remote code allowed."
        aside={<Pill tone="green" dot large>Zero-Trust Isolation Active</Pill>} />
      <div className="cx-grid cx-grid--4">
        {cards.map((c) => (
          <button key={c.id} type="button" aria-pressed={sel === c.id} className={cx('cx-card lt-card', sel === c.id && 'cx-card--selected')} onClick={() => choose(c.id)}>
            <div className="cx-row"><span className="cx-icon-box cx-icon-box--violet">{ICON[c.id]}</span><span className="cx-push"><Pill tone="green" dot>ALLOWED</Pill></span></div>
            <h2>{c.name.toUpperCase()}</h2><p>{c.desc}</p>
            <div className="lt-card__foot"><span>Runs: <b>{c.runs}</b></span><Pill tone={c.verb === 'EXECUTE' ? 'violet' : 'blue'}>{c.verb}</Pill></div>
          </button>
        ))}
      </div>
      <Card title="Interactive sandboxed tool execution console" icon={<Play color="#2563ff" />} aside={<span className="cx-pill cx-pill--gray">Selected: {card.name}</span>} className="lt-console">
        <label className="cx-label" htmlFor="targ">Tool Input / Command Argument:</label>
        <form className="cx-row" style={{ flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); void run(); }}>
          <input id="targ" className="cx-input" style={{ fontWeight: 700, padding: '.9rem 1rem' }} value={input} onChange={(e) => setInput(e.target.value)} />
          <button type="submit" className="cx-btn cx-btn--violet" style={{ padding: '.9rem 1.6rem' }} disabled={busy}>{busy ? <Spinner label="Running" /> : <><Play />Execute</>}</button>
        </form>
        <div className={cx('lt-out', out && !out.ok && 'bad')} role="status" aria-live="polite">
          <b>SANDBOXED EXECUTION OUTPUT:</b>
          <p>{out ? `${out.output}${out.ok ? ` · ${out.ms}ms` : ''}` : 'Press Execute to run the selected tool. The calculator evaluates locally with a safe parser; other tools return sample output.'}</p>
        </div>
        <div className="cx-banner cx-banner--blue" style={{ margin: '.9rem 0 0' }}><CheckCircle2 color="#0a9f73" /><span><b>Security Notice:</b> In production, commands execute inside isolated memory boundaries without shell subprocesses, enforced by the backend.</span></div>
      </Card>
    </Page>
  );
}
