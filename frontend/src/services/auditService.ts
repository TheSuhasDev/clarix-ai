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
