import { config, mock, request } from './client';

export interface PlanStep {
  step: number;
  description: string;
  tool: string;
  input: string;
  risk: string;
  predictedDecision: string;
  needsApproval: boolean;
}

export interface RunStep {
  index: number;
  phase: 'think' | 'act' | 'observe' | 'reflect';
  thought?: string;
  tool?: string;
  input?: string;
  output?: string;
  decision: string;
  risk: string;
  durationMs: number;
  timestamp: string;
  error?: string;
}

export interface RunBudget {
  maxSteps: number;
  maxSeconds: number;
  maxToolCalls: number;
}

export interface AgentRun {
  id: string;
  createdAt: number;
  updatedAt: number;
  actor: string;
  role: 'researcher' | 'analyst' | 'operator';
  goal: string;
  status: 'INITIALIZING' | 'PLANNING' | 'AWAITING_PLAN_APPROVAL' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'COMPLETED' | 'FAILED' | 'BUDGET_EXCEEDED' | 'REJECTED';
  planMode: 'auto' | 'plan_then_act' | 'dry_run';
  plan: PlanStep[];
  steps: RunStep[];
  resultText: string;
  budget: RunBudget;
  token?: string;
  meta: Record<string, any>;
  stopReason?: string;
  dryRunDiff?: string;
  verification?: any;
}

export interface WorkflowDef {
  id: string;
  name: string;
  description: string;
  defaultRole: string;
  defaultGoal: string;
  icon: string;
  estimatedSteps: number;
  category: string;
}

export interface MemoryItem {
  id: string;
  sessionId: string;
  key: string;
  classification: string;
  encryptedBytes: number;
  createdAt: number;
  updatedAt: number;
}

export interface SchedulerStatus {
  enabled: boolean;
  intervalSeconds: number;
  lastRun: number | null;
  nextRun: number | null;
  running: boolean;
  lastRunId: string | null;
}

const MOCK_WORKFLOWS: WorkflowDef[] = [
  {
    id: 'workflow-summarize-risks',
    name: 'Summarize Documents & Flag Risks',
    description: 'Scans indexed workspace documents via RAG, extracts architectural controls, and highlights high-risk or confidential compliance gaps.',
    defaultRole: 'analyst',
    defaultGoal: 'Retrieve and summarize key architectural controls from indexed workspace documents. Highlight any security risks or compliance gaps.',
    icon: 'FileText',
    estimatedSteps: 3,
    category: 'Analysis',
  },
  {
    id: 'workflow-cross-check',
    name: 'Cross-Check Documents for Contradictions',
    description: 'Cross-references claims across multiple indexed specifications to detect contradictions, conflicting policies, or divergent requirements.',
    defaultRole: 'analyst',
    defaultGoal: 'Cross-reference architecture documents and specifications to identify any contradictory statements, mismatched numbers, or policy conflicts.',
    icon: 'CheckSquare',
    estimatedSteps: 4,
    category: 'Verification',
  },
  {
    id: 'workflow-security-audit',
    name: 'Security Audit of Ingested Documents',
    description: 'Audits all document chunks, flags quarantined chunks from injection scans, inspects data classification boundaries, and verifies integrity.',
    defaultRole: 'researcher',
    defaultGoal: 'Perform a read-only security audit of ingested documents, checking chunk classifications, quarantine statuses, and untrusted ingress sources.',
    icon: 'ShieldAlert',
    estimatedSteps: 3,
    category: 'Audit',
  },
  {
    id: 'workflow-daily-integrity',
    name: 'Daily Integrity Report',
    description: 'Verifies the cryptographic HMAC hash chain, validates the external signed anchor, audits database triggers, and checks security state signatures.',
    defaultRole: 'analyst',
    defaultGoal: 'Verify the HMAC-SHA256 audit log integrity, inspect the external signed anchor, check SQLite append-only triggers, and generate a daily integrity verification summary.',
    icon: 'Lock',
    estimatedSteps: 2,
    category: 'Integrity',
  },
];

let mockRuns: AgentRun[] = [];
let mockScheduler: SchedulerStatus = {
  enabled: false,
  intervalSeconds: 3600,
  lastRun: null,
  nextRun: null,
  running: false,
  lastRunId: null,
};

export const agenticService = {
  async createRun(params: {
    goal: string;
    role?: 'researcher' | 'analyst' | 'operator';
    planMode?: 'auto' | 'plan_then_act' | 'dry_run';
    budget?: Partial<RunBudget>;
    workflowId?: string;
  }): Promise<AgentRun> {
    if (!config.useMocks) {
      return request<AgentRun>('/api/agent/runs', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    }

    const runId = `run_${Date.now().toString(36)}`;
    const role = params.role || 'analyst';
    const planMode = params.planMode || 'plan_then_act';
    const plan: PlanStep[] = [
      { step: 1, description: 'Retrieve architecture specifications via RAG', tool: 'rag_search', input: params.goal, risk: 'LOW', predictedDecision: 'ALLOW', needsApproval: false },
      { step: 2, description: 'Analyze retrieved documents against security controls', tool: 'file_reader', input: 'project_documentation.pdf', risk: 'LOW', predictedDecision: 'ALLOW', needsApproval: false },
      { step: 3, description: 'Verify conclusions and synthesize final response', tool: 'system_info', input: '', risk: 'LOW', predictedDecision: 'ALLOW', needsApproval: false },
    ];
    const newRun: AgentRun = {
      id: runId,
      createdAt: Date.now() / 1000,
      updatedAt: Date.now() / 1000,
      actor: 'operator',
      role,
      goal: params.goal,
      status: planMode === 'dry_run' ? 'COMPLETED' : planMode === 'plan_then_act' ? 'AWAITING_PLAN_APPROVAL' : 'COMPLETED',
      planMode,
      plan,
      steps: [
        { index: 1, phase: 'think', thought: 'Analyzing objective and checking capability tokens', timestamp: '12:00:01', decision: 'ALLOW', risk: 'LOW', durationMs: 4 },
        { index: 2, phase: 'act', thought: 'Executing rag_search', tool: 'rag_search', input: params.goal, output: 'Retrieved 3 chunks from zero-trust architecture document.', decision: 'ALLOW', risk: 'LOW', durationMs: 42, timestamp: '12:00:02' },
        { index: 3, phase: 'observe', thought: 'Scanning tool observation for injection patterns', output: 'Observation validated clean (no injection signatures).', decision: 'ALLOW', risk: 'LOW', durationMs: 2, timestamp: '12:00:03' },
        { index: 4, phase: 'reflect', thought: 'Synthesizing verified answer with attribution citations', decision: 'ALLOW', risk: 'LOW', durationMs: 12, timestamp: '12:00:04' },
      ],
      resultText: `Completed goal under role ${role.toUpperCase()}.\n• Executed planned steps within bounds.\n• Evidence verified against sources [1].`,
      budget: { maxSteps: 8, maxSeconds: 120, maxToolCalls: 10, ...(params.budget || {}) },
      meta: { workflowId: params.workflowId },
      dryRunDiff: planMode === 'dry_run' ? `=== CLARIX AGENT DRY-RUN PREVIEW ===\nRun ID: ${runId}\nRole: ${role.toUpperCase()}\nPlanned Steps: 3\nNo tools executed.` : undefined,
    };
    mockRuns.unshift(newRun);
    return mock(() => newRun, 300);
  },

  async listRuns(): Promise<AgentRun[]> {
    if (!config.useMocks) {
      return request<AgentRun[]>('/api/agent/runs');
    }
    return mock(() => [...mockRuns], 200);
  },

  async getRun(id: string): Promise<AgentRun> {
    if (!config.useMocks) {
      return request<AgentRun>(`/api/agent/runs/${id}`);
    }
    const r = mockRuns.find((x) => x.id === id);
    if (!r) throw new Error(`Run ${id} not found`);
    return mock(() => ({ ...r }), 150);
  },

  async approvePlan(id: string, approved: boolean, steps?: PlanStep[]): Promise<AgentRun> {
    if (!config.useMocks) {
      return request<AgentRun>(`/api/agent/runs/${id}/approve-plan`, {
        method: 'POST',
        body: JSON.stringify({ approved, steps }),
      });
    }
    const r = mockRuns.find((x) => x.id === id);
    if (!r) throw new Error(`Run ${id} not found`);
    r.status = approved ? 'COMPLETED' : 'REJECTED';
    if (!approved) r.stopReason = 'Plan rejected by operator';
    if (steps) r.plan = steps;
    return mock(() => ({ ...r }), 250);
  },

  async pauseRun(id: string): Promise<AgentRun> {
    if (!config.useMocks) {
      return request<AgentRun>(`/api/agent/runs/${id}/pause`, {
        method: 'POST',
      });
    }
    const r = mockRuns.find((x) => x.id === id);
    if (!r) throw new Error(`Run ${id} not found`);
    r.status = 'PAUSED';
    return mock(() => ({ ...r }), 150);
  },

  async resumeRun(id: string): Promise<AgentRun> {
    if (!config.useMocks) {
      return request<AgentRun>(`/api/agent/runs/${id}/resume`, {
        method: 'POST',
      });
    }
    const r = mockRuns.find((x) => x.id === id);
    if (!r) throw new Error(`Run ${id} not found`);
    r.status = 'COMPLETED';
    return mock(() => ({ ...r }), 150);
  },

  async stopRun(id: string): Promise<AgentRun> {
    if (!config.useMocks) {
      return request<AgentRun>(`/api/agent/runs/${id}/stop`, {
        method: 'POST',
      });
    }
    const r = mockRuns.find((x) => x.id === id);
    if (!r) throw new Error(`Run ${id} not found`);
    r.status = 'STOPPED';
    r.stopReason = 'Operator invoked kill-switch';
    return mock(() => ({ ...r }), 150);
  },

  async listWorkflows(): Promise<WorkflowDef[]> {
    if (!config.useMocks) {
      return request<WorkflowDef[]>('/api/agent/workflows');
    }
    return mock(() => [...MOCK_WORKFLOWS], 150);
  },

  async runWorkflow(id: string, overrides?: { role?: string; planMode?: string }): Promise<AgentRun> {
    if (!config.useMocks) {
      return request<AgentRun>(`/api/agent/workflows/${id}/run`, {
        method: 'POST',
        body: JSON.stringify(overrides || {}),
      });
    }
    const wf = MOCK_WORKFLOWS.find((w) => w.id === id);
    if (!wf) throw new Error(`Workflow ${id} not found`);
    return this.createRun({
      goal: wf.defaultGoal,
      role: (overrides?.role as any) || (wf.defaultRole as any),
      planMode: (overrides?.planMode as any) || 'plan_then_act',
      workflowId: wf.id,
    });
  },

  async listMemory(sessionId?: string): Promise<MemoryItem[]> {
    if (!config.useMocks) {
      const q = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
      return request<MemoryItem[]>('/api/agent/memory' + q);
    }
    return mock(() => [
      { id: 'mem_1', sessionId: sessionId || 'default', key: 'arch_summary', classification: 'INTERNAL', encryptedBytes: 256, createdAt: Date.now() / 1000 - 3600, updatedAt: Date.now() / 1000 - 1200 },
      { id: 'mem_2', sessionId: sessionId || 'default', key: 'policy_controls', classification: 'CONFIDENTIAL', encryptedBytes: 384, createdAt: Date.now() / 1000 - 1800, updatedAt: Date.now() / 1000 - 600 },
    ], 150);
  },

  async clearMemory(sessionId?: string, key?: string): Promise<{ cleared: boolean; count: number }> {
    if (!config.useMocks) {
      return request<{ cleared: boolean; count: number }>('/api/agent/memory/clear', {
        method: 'POST',
        body: JSON.stringify({ sessionId, key }),
      });
    }
    return mock(() => ({ cleared: true, count: 2 }), 200);
  },

  async getScheduler(): Promise<SchedulerStatus> {
    if (!config.useMocks) {
      return request<SchedulerStatus>('/api/agent/scheduler');
    }
    return mock(() => ({ ...mockScheduler }), 150);
  },

  async toggleScheduler(enabled: boolean): Promise<SchedulerStatus> {
    if (!config.useMocks) {
      return request<SchedulerStatus>('/api/agent/scheduler/toggle', {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      });
    }
    mockScheduler.enabled = enabled;
    return mock(() => ({ ...mockScheduler }), 150);
  },
};
