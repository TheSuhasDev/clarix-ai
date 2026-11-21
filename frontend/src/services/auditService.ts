import { config, mock, request } from './client';
import * as db from './mock/db';
import type { AuditEvent } from '../types';
import { buildChain, isCryptoAvailable, type ChainLink } from '../utils/sha256';

export interface IntegrityStatus {
  status: 'VERIFIED' | 'LOCKED' | 'WARN';
  mode: string;
  locked: boolean;
  reason?: string;
  evidence?: string;
  triggers_ok?: boolean;
  state_sig_ok?: boolean;
  anchor_ok?: boolean;
  last_checked?: string;
  last_checked_seconds_ago?: number;
  anchor?: {
    count: number;
    head_hash: string;
    timestamp: string;
    signature: string;
  } | null;
  pol006_active?: boolean;
  demoMode?: boolean;
  ledger?: 'demo' | 'live';
  dbPath?: string;
}

export interface VerifierComparison {
  status: 'CLEAN' | 'TAMPER_DETECTED';
  detection_time_ms?: number;
  legacy: {
    name: string;
    algorithm: string;
    status: 'VALID' | 'TAMPER_DETECTED';
    reason: string;
    vulnerable_to_rehash: boolean;
  };
  clarix: {
    name: string;
    algorithm: string;
    status: 'VALID' | 'TAMPER_DETECTED';
    reason: string;
    evidence?: string;
    layers: {
      hmac_chain: { ok: boolean; desc: string };
      external_anchor: { ok: boolean; desc: string };
      signed_security_state: { ok: boolean; desc: string };
      schema_triggers: { ok: boolean; desc: string };
    };
  };
}

export interface IntegrityIncident {
  seq: number;
  id: string;
  timestamp: string;
  type: string;
  reason: string;
  evidence: string;
  prev_hash: string;
  hash: string;
}

let mockLockedState = false;
let mockLockReason = '';
let mockLockEvidence = '';

export const auditService = {
  /** BACKEND: GET /api/audit  (server-side hash chain; the browser only displays/recomputes it) */
  async list(): Promise<AuditEvent[]> {
    if (!config.useMocks) return request('/api/audit');
    const events: AuditEvent[] = await mock(() => db.auditEvents);
    if (!db.flags.crypto || !isCryptoAvailable()) return events;
    const chain = await buildChain(events.map((e) => ({ id: e.id, payload: e.payload })));
    return events.map((e, i) => ({ ...e, hash: chain[i].hash, prevHash: chain[i].prevHash }));
  },
  /** BACKEND: GET /api/audit/chain */
  async chain(): Promise<{ event: AuditEvent; link: ChainLink }[]> {
    const events = await auditService.list();
    return events.map((e) => ({ event: e, link: { id: e.id, payload: e.canonical ?? e.payload, hash: e.hash ?? '', prevHash: e.prevHash ?? '' } }));
  },

  /** BACKEND: GET /api/integrity/status */
  async getIntegrityStatus(): Promise<IntegrityStatus> {
    if (!config.useMocks) return request('/api/integrity/status');
    return mock(() => ({
      status: mockLockedState ? 'LOCKED' : 'VERIFIED',
      mode: 'enforce',
      locked: mockLockedState,
      reason: mockLockReason,
      evidence: mockLockEvidence,
      triggers_ok: !mockLockedState,
      state_sig_ok: !mockLockedState,
      anchor_ok: !mockLockedState,
      last_checked: new Date().toISOString().slice(0, 19).replace('T', ' '),
      last_checked_seconds_ago: 2,
      anchor: {
        count: db.auditEvents.length,
        head_hash: '9f830a6c22c0d52ff7d3a01f56b547f3b584a7e93f3c4d5e6a7b8c9d0e1f2a3b',
        timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
        signature: 'c4ca4238a0b923820dcc509a6f75849b2ef3f5a7e6c1a8d4a9b2c3d4e5f6a7b8',
      },
      pol006_active: true,
      demoMode: true,
      ledger: 'demo',
      dbPath: 'data/demo/clarix_demo.db',
    }));
  },

  /** BACKEND: GET /api/audit/verify */
  async verifyServer(): Promise<{ ok: boolean; count: number; head: string; problems: any[]; ms: number; ledger?: 'demo' | 'live'; dbPath?: string }> {
    if (!config.useMocks) return request('/api/audit/verify');
    return mock(() => ({
      ok: !mockLockedState,
      count: db.auditEvents.length,
      head: db.auditEvents[db.auditEvents.length - 1]?.hash || '0'.repeat(64),
      problems: mockLockedState ? [{ id: 'EVT-000005', reason: mockLockReason || 'Cryptographic integrity mismatch' }] : [],
      ms: 6,
      ledger: 'demo',
      dbPath: 'data/demo/clarix_demo.db',
    }));
  },

  /** BACKEND: GET /api/integrity/incidents */
  async getIncidents(): Promise<IntegrityIncident[]> {
    if (!config.useMocks) return request('/api/integrity/incidents');
    return mock(() => mockLockedState ? [{
      seq: 1,
      id: 'INC-00000001',
      timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
      type: 'TAMPER_DETECTED',
      reason: mockLockReason || 'Simulated out-of-band tampering',
      evidence: mockLockEvidence || 'Direct SQLite update detected',
      prev_hash: '0'.repeat(64),
      hash: 'a1b2c3d4e5f6'.padEnd(64, '0'),
    }] : []);
  },

  /** BACKEND: POST /api/integrity/recover */
  async recoverIntegrity(mode: 'restore_snapshot' | 'rebaseline', reason: string, confirmation?: string): Promise<{ ok: boolean; message: string }> {
    if (!config.useMocks) {
      return request('/api/integrity/recover', {
        method: 'POST',
        body: JSON.stringify({ mode, reason, confirmation }),
      });
    }
    return mock(() => {
      mockLockedState = false;
      mockLockReason = '';
      mockLockEvidence = '';
      return { ok: true, message: 'System state successfully rebaselined and unlocked.' };
    });
  },

  /** BACKEND: GET /api/integrity/anchor/export */
  async exportAnchor(): Promise<any> {
    if (!config.useMocks) return request('/api/integrity/anchor/export');
    return mock(() => ({
      count: db.auditEvents.length,
      head_hash: '9f830a6c22c0d52ff7d3a01f56b547f3b584a7e93f3c4d5e6a7b8c9d0e1f2a3b',
      timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
      signature: 'c4ca4238a0b923820dcc509a6f75849b2ef3f5a7e6c1a8d4a9b2c3d4e5f6a7b8',
    }));
  },

  /** BACKEND: GET /api/integrity/compare-verifiers */
  async compareVerifiers(): Promise<VerifierComparison> {
    if (!config.useMocks) return request('/api/integrity/compare-verifiers');
    return mock(() => ({
      status: mockLockedState ? 'TAMPER_DETECTED' : 'CLEAN',
      detection_time_ms: 12,
      legacy: {
        name: 'Legacy Plain SHA-256 Verifier',
        algorithm: 'SHA-256 (Unkeyed hash continuity)',
        status: 'VALID',
        reason: 'Hash continuity unbroken: every block parent matches recomputed sha256(prev_hash + payload)',
        vulnerable_to_rehash: true,
      },
      clarix: {
        name: 'Clarix Keyed HMAC-SHA256 + Anchor + Signed State (POL-006)',
        algorithm: 'HMAC-SHA256 (audit.key) + External Anchor + Signed State + Triggers',
        status: mockLockedState ? 'TAMPER_DETECTED' : 'VALID',
        reason: mockLockedState ? (mockLockReason || 'Cryptographic integrity violation detected') : 'All 4 defense layers verified',
        evidence: mockLockedState ? mockLockEvidence : undefined,
        layers: {
          hmac_chain: { ok: !mockLockedState, desc: 'HMAC signature verification over all rows with isolated audit.key' },
          external_anchor: { ok: !mockLockedState, desc: 'External head anchor hash matches DB state' },
          signed_security_state: { ok: !mockLockedState, desc: 'Cryptographic signature over policies, tools, triggers' },
          schema_triggers: { ok: !mockLockedState, desc: 'SQLite triggers prevent direct row updates and deletions' },
        },
      },
    }));
  },

  /** BACKEND: POST /api/demo/reset */
  async resetDemo(): Promise<{ ok: boolean; count: number; message: string }> {
    if (!config.useMocks) return request('/api/demo/reset', { method: 'POST' });
    return mock(() => {
      mockLockedState = false;
      mockLockReason = '';
      mockLockEvidence = '';
      return { ok: true, count: 40, message: 'Demo ledger reset to 40 clean seed events with external anchor.' };
    });
  },

  /** BACKEND: GET /api/demo/mode */
  async getDemoMode(): Promise<{
    ok: boolean;
    demoMode: boolean;
    ledger: 'demo' | 'live';
    dbPath: string;
    count: number;
    head: string;
    locked: boolean;
    status: string;
  }> {
    if (!config.useMocks) return request('/api/demo/mode');
    return mock(() => ({
      ok: true,
      demoMode: false,
      ledger: 'live',
      dbPath: 'data/clarix.db',
      count: db.auditEvents.length,
      head: 'genesis_head',
      locked: mockLockedState,
      status: mockLockedState ? 'LOCKED' : 'VERIFIED',
    }));
  },

  /** BACKEND: POST /api/demo/mode */
  async toggleDemoMode(enabled: boolean): Promise<{
    ok: boolean;
    demoMode: boolean;
    ledger: 'demo' | 'live';
    dbPath: string;
    count: number;
    head: string;
    locked: boolean;
    status: string;
  }> {
    if (!config.useMocks) {
      return request('/api/demo/mode', {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      });
    }
    return mock(() => ({
      ok: true,
      demoMode: enabled,
      ledger: enabled ? 'demo' : 'live',
      dbPath: enabled ? 'data/demo/clarix_demo.db' : 'data/clarix.db',
      count: enabled ? 40 : db.auditEvents.length,
      head: 'mock_head',
      locked: false,
      status: 'VERIFIED',
    }));
  },

  /** BACKEND: POST /api/demo/tamper (CLARIX_DEMO_MODE=1) */
  async demoTamper(attack: string): Promise<any> {
    if (!config.useMocks) {
      return request('/api/demo/tamper', {
        method: 'POST',
        body: JSON.stringify({ attack }),
      });
    }
    return mock(() => {
      mockLockedState = true;
      mockLockReason = `Demo attack simulation: ${attack}`;
      mockLockEvidence = `Simulated out-of-band tamper on ${attack}`;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('clarix:system_locked', {
          detail: {
            status: 423,
            code: 'system_locked',
            reason: mockLockReason,
            evidence: mockLockEvidence,
          },
        }));
      }
      return { status: 'tampered', attack, detected: true };
    });
  },
};
