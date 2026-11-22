import { useState, type ReactNode } from 'react';
import { Bell, KeyRound, Link2, Plug, Server, Settings as Cog, ShieldCheck, SlidersHorizontal, Sparkles, WifiOff, RotateCcw } from 'lucide-react';
import { Card, Page, PageHeader, Pill, Spinner, Toggle } from '../components/common';
import { config, setEndpoints, setApiToken, settingsService } from '../services';
import { useConsole, type Settings as S } from '../state/ConsoleContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { BackendStatus } from '../types';

interface Row { key: keyof S; title: string; text: string; icon: ReactNode; color: string; tint: string }
const ROWS: Row[] = [
  { key: 'demoMode', title: 'Interactive Demo Mode', text: 'Enables switching to the isolated demo sandbox ledger (data/demo/) for testing attacks without touching live production data.', icon: <Sparkles />, color: '#ff9f1a', tint: 'amber' },
  { key: 'notifications', title: 'Security Notifications', text: 'Highlights pending high-risk human approval requests in the navigation and header.', icon: <Bell />, color: '#12b5ff', tint: 'blue' },
];

function validUrl(v: string): boolean {
  try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}

export default function Settings() {
  const { settings, setSetting, resetSettings, toast } = useConsole();
  const [saved, setSaved] = useLocalStorage('clarix.endpoints.v1', { api: config.apiUrl, ollama: config.ollamaUrl });
  const [api, setApi] = useState(saved.api);
  const [ollama, setOllama] = useState(saved.ollama);
  const [token, setToken] = useState(config.apiToken || '');
  const [apiRes, setApiRes] = useState<BackendStatus | null>(null);
  const [olRes, setOlRes] = useState<BackendStatus | null>(null);
  const [busy, setBusy] = useState<'api' | 'ollama' | null>(null);
  const apiOk = validUrl(api), olOk = validUrl(ollama);

  async function test(kind: 'api' | 'ollama') {
    setBusy(kind);
    const r = await (kind === 'api' ? settingsService.testBackend(api) : settingsService.testOllama(ollama));
    (kind === 'api' ? setApiRes : setOlRes)(r);
    setBusy(null);
  }
  function save() {
    if (!apiOk || !olOk) { toast('Enter valid http(s) URLs for both endpoints.', 'red'); return; }
    setSaved({ api, ollama }); setEndpoints(api, ollama); setApiToken(token); toast('Endpoints and operator token saved in this browser.', 'green');
  }
  function reset() {
    resetSettings();
    toast('Settings reset to defaults.', 'blue');
  }

  return (
    <Page>
      <PageHeader icon={<Cog color="#2563ff" />} title="System Settings & Integration Control" subtitle="Configure local sandbox parameters, demonstration triggers, and future backend connectors."
        aside={<Pill tone="green" large><ShieldCheck />Air-Gapped Node #01 (label)</Pill>} />
      <div className="cx-stack">
        <Card tone="red" className="st-air">
          <span className="cx-icon-box cx-icon-box--red" style={{ width: '3.2rem', height: '3.2rem' }}><WifiOff /></span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="cx-row"><b className="tone-red cx-mono">AIR-GAP MODE STATUS</b><Pill tone="red">LOCKED / DEMO</Pill></div>
            <p className="cx-sub" style={{ margin: '.3rem 0 0' }}>Actual network isolation is enforced outside the frontend via the OS kernel firewall and iptables. It cannot be changed from this UI.</p>
          </div>
          <Pill tone="red" dot large>BLOCKED</Pill>
        </Card>

        <Card title="Operational toggles & security preferences" icon={<SlidersHorizontal color="#6a5cff" />} aside={<button type="button" className="cx-btn cx-btn--ghost cx-btn--sm" onClick={reset}><RotateCcw />Reset</button>}>
          <ul className="st-list">
            {ROWS.map((r) => (
              <li key={r.key}>
                <span className={`cx-icon-box cx-icon-box--${r.tint}`}>{r.icon}</span>
                <div><b>{r.title}</b><p>{r.text}</p></div>
                <Toggle checked={settings[r.key]} onChange={(v) => setSetting(r.key, v)} label={r.title} color={r.color} />
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Future backend integration (FastAPI & Ollama)" icon={<Server color="#2563ff" />} aside={<Pill tone={config.useMocks ? 'blue' : 'green'} dot>{config.useMocks ? 'CURRENT: MOCK SERVICES ACTIVE' : 'CURRENT: LIVE BACKEND MODE'}</Pill>}>
          <p className="cx-sub">This frontend works without a backend. When FastAPI and Ollama are running, set <code>VITE_USE_MOCKS=false</code> in <code>.env.local</code> and point the endpoints below. The browser should talk only to the backend; the backend talks to Ollama on loopback.</p>
          <div className="cx-grid cx-grid--2">
            <div>
              <label className="cx-label" htmlFor="api">FastAPI Backend Endpoint:</label>
              <div className="st-url"><Link2 /><input id="api" className="cx-input" value={api} onChange={(e) => setApi(e.target.value)} aria-invalid={!apiOk} /></div>
              {!apiOk && <p className="cx-sub tone-red" role="alert" style={{ margin: '.3rem 0 0' }}>Enter a valid http(s) URL.</p>}
              {apiRes && <p className={`cx-sub ${apiRes.ok ? 'tone-green' : 'tone-red'}`} role="status" style={{ margin: '.4rem 0 0' }}>{apiRes.ok ? '✓' : '✕'} {apiRes.message}{apiRes.latencyMs !== undefined && ` (${apiRes.latencyMs}ms)`}</p>}
            </div>
            <div>
              <label className="cx-label" htmlFor="ol">Ollama Local LLM Endpoint:</label>
              <div className="st-url"><Link2 /><input id="ol" className="cx-input" value={ollama} onChange={(e) => setOllama(e.target.value)} aria-invalid={!olOk} /></div>
              {!olOk && <p className="cx-sub tone-red" role="alert" style={{ margin: '.3rem 0 0' }}>Enter a valid http(s) URL.</p>}
              {olRes && <p className={`cx-sub ${olRes.ok ? 'tone-green' : 'tone-red'}`} role="status" style={{ margin: '.4rem 0 0' }}>{olRes.ok ? '✓' : '✕'} {olRes.message}{olRes.latencyMs !== undefined && ` (${olRes.latencyMs}ms)`}</p>}
            </div>
          </div>
          <div style={{ marginTop: '0.9rem' }}>
            <label className="cx-label" htmlFor="api-token">Operator API Bearer Token (SEC-01):</label>
            <div className="st-url"><KeyRound /><input id="api-token" className="cx-input cx-mono" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Enter 32-byte ephemeral operator token or CLARIX_API_TOKEN..." /></div>
            <p className="cx-sub" style={{ margin: '.3rem 0 0', fontSize: '.68rem' }}>When CLARIX_API_TOKEN is unset and demo mode is off, an ephemeral 32-byte token is printed at backend startup. Saved in local browser storage.</p>
          </div>
          <div className="cx-row" style={{ marginTop: '1rem' }}>
            <button type="button" className="cx-btn cx-btn--success" disabled={!apiOk || busy !== null} onClick={() => void test('api')}>{busy === 'api' ? <Spinner label="Testing" /> : <><Plug />Test Connection to FastAPI</>}</button>
            <button type="button" className="cx-btn cx-btn--ghost" disabled={!olOk || busy !== null} onClick={() => void test('ollama')}>{busy === 'ollama' ? <Spinner label="Testing" /> : <><Plug />Test Ollama</>}</button>
            <button type="button" className="cx-btn cx-btn--primary" onClick={save}>Save endpoints</button>
          </div>
          <p className="cx-sub" style={{ margin: '.8rem 0 0', fontSize: '.68rem' }}>Connection tests are real browser requests to the URLs above. They fail until a backend exists (and, for Ollama, until it allows this origin via OLLAMA_ORIGINS).</p>
        </Card>
      </div>
    </Page>
  );
}
