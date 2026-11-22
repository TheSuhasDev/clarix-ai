import type { Risk } from '../../types';

export interface GateInfo { id: string; n: number; label: string; risk: Risk; icon: string; detail: string; metrics: [string, string][] }

export const GATES: GateInfo[] = [
  { id: 'pi', n: 1, label: 'Prompt Injection', risk: 'HIGH', icon: 'flame', detail: 'Pre-inference scanner parses every ingress prompt into an AST and scores it against jailbreak, override and exfiltration patterns.', metrics: [['Scanner state', 'Active'], ['Interception mode', 'Fail-Closed'], ['Mode', 'Pre-inference']] },
  { id: 'policy', n: 2, label: 'Policy Engine', risk: 'CRITICAL', icon: 'shield', detail: 'Deterministic rules POL-001 to POL-008 evaluated for every proposed tool call. First matching deny wins.', metrics: [['Rules enforced', '8 of 8'], ['Enforcement mode', 'FAIL-CLOSED'], ['Policy tier', 'Deterministic']] },
  { id: 'taint', n: 3, label: 'Data / Taint Checker', risk: 'HIGH', icon: 'activity', detail: 'Propagates classification tags from sources into agent memory and stops tainted data reaching outbound sinks.', metrics: [['Lineage tracking', 'Active'], ['Sinks guarded', 'Network & Shell'], ['Tiers', '4 (PUBLIC to RESTRICTED)']] },
  { id: 'tool', n: 4, label: 'Tool Permission', risk: 'HIGH', icon: 'wrench', detail: 'Least-privilege capability map for local tools. Network, e-mail and socket tools are denied by the air-gap policy.', metrics: [['Tools registered', '8'], ['Air-gap policy', 'Enforced'], ['Default permission', 'Least-privilege']] },
  { id: 'approval', n: 5, label: 'Human Approval', risk: 'CRITICAL', icon: 'eye', detail: 'Suspends execution of HIGH and CRITICAL actions until an authorised operator signs off.', metrics: [['Gate mode', 'Human-in-the-loop'], ['Timeout', '300 s'], ['Signed by', 'Operator ID']] },
  { id: 'audit', n: 6, label: 'Audit Logger', risk: 'LOW', icon: 'file', detail: 'Appends every decision to a backward-linked HMAC-SHA256 ledger guarded by SQLite triggers so tampering is detectable.', metrics: [['Ledger algorithm', 'HMAC-SHA256'], ['Chain defense', 'Backward-linked'], ['Database triggers', 'Append-Only']] },
];

export interface EnvInfo { id: string; label: string; sub: string; icon: string; detail: string; metrics: [string, string][] }
export const ENV: EnvInfo[] = [
  { id: 'rag', label: 'LOCAL RAG', sub: 'Vector Chunks', icon: 'db', detail: 'Local dense-embedding vector store with source-level taint tags.', metrics: [['Embeddings', 'nomic-embed-text (local)'], ['Storage', 'Encrypted local DB'], ['Egress', 'None (Air-Gapped)']] },
  { id: 'tools', label: 'LOCAL TOOLS', sub: 'AST Compute', icon: 'wrench', detail: 'Whitelisted deterministic tools executed inside isolated memory boundaries.', metrics: [['Shell expansion', 'Disabled'], ['Execution', 'Isolated memory'], ['eval()', 'Not used']] },
  { id: 'ollama', label: 'OLLAMA', sub: 'qwen3:4b (offline)', icon: 'cpu', detail: 'Local open-weights inference bound to 127.0.0.1:11434 with zero network telemetry.', metrics: [['Active Model', 'qwen3:4b'], ['Bind Address', '127.0.0.1:11434'], ['Telemetry', 'Off (Air-Gapped)']] },
  { id: 'fs', label: 'FILE SYSTEM', sub: 'Chroot Jailed', icon: 'folder', detail: 'Read access limited to /sandbox/workspace; write paths guarded by POL-002.', metrics: [['Root', '/sandbox'], ['Mode', 'Read-only'], ['Escapes', '0']] },
  { id: 'sqlite', label: 'DATABASE', sub: 'Local SQLite', icon: 'server', detail: 'Embedded SQLite for vectors and audit metadata. Single read-only SELECT permitted for tools.', metrics: [['Engine', 'SQLite'], ['Access', 'Read-only'], ['Remote', 'No']] },
];

export const ALL_INSPECT = [
  ...GATES.map((g) => ({ id: g.id, title: `${g.n}. ${g.label}`, detail: g.detail, metrics: g.metrics })),
  ...ENV.map((e) => ({ id: e.id, title: e.label, detail: e.detail, metrics: e.metrics })),
  { id: 'user', title: 'User (ingress origin)', detail: 'Local terminal prompt submission via the web UI. Treated as untrusted until scanned.', metrics: [['Trust label', 'USER'], ['Channel', 'Local console'], ['Remote', 'No']] },
  { id: 'agent', title: 'AI Agent (reasoning core)', detail: 'Plans tasks, assembles context and proposes tool calls. It cannot execute anything without passing every gate.', metrics: [['State', 'Running'], ['Model', 'Local open-weights'], ['Autonomy', 'Gated']] },
  { id: 'internet', title: 'Internet (blocked)', detail: 'Complete socket-layer air-gap perimeter. Enforcement is performed by the OS firewall and backend, not this UI.', metrics: [['Outbound', '0 pkts/s'], ['Cloud LLMs', 'DISCONNECTED'], ['DNS', 'NULL_ROUTE']] },
];
