/**
 * API client + mock switch.
 *
 * BACKEND: when the FastAPI service is running, set VITE_USE_MOCKS=false and every
 * service below calls `request()` against VITE_API_URL instead of the mock database.
 * Security decisions (policy, taint, approval, air-gap) are enforced server-side; this
 * UI only displays and requests them.
 */
import type { BackendStatus } from '../types';

export const config = {
  useMocks: import.meta.env.VITE_USE_MOCKS !== 'false',
  apiUrl: (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, ''),
  // Operator bearer token: reads from localStorage, VITE_API_TOKEN, or VITE_CLARIX_API_TOKEN
  apiToken: (typeof localStorage !== 'undefined' ? localStorage.getItem('clarix_api_token') : null) || (import.meta.env.VITE_API_TOKEN ?? import.meta.env.VITE_CLARIX_API_TOKEN ?? ''),
  ollamaUrl: (import.meta.env.VITE_OLLAMA_URL ?? 'http://localhost:11434').replace(/\/$/, ''),
};

export function setApiToken(token: string): void {
  const t = token.trim();
  config.apiToken = t;
  if (typeof localStorage !== 'undefined') {
    if (t) localStorage.setItem('clarix_api_token', t);
    else localStorage.removeItem('clarix_api_token');
  }
}

export function setEndpoints(apiUrl: string, ollamaUrl: string): void {
  config.apiUrl = apiUrl.replace(/\/$/, '');
  config.ollamaUrl = ollamaUrl.replace(/\/$/, '');
}

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let simulateErrors = false;
export const setSimulatedErrors = (v: boolean): void => { simulateErrors = v; };
export const getSimulatedErrors = (): boolean => simulateErrors;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Resolves mock data after a short delay; honours the "simulate errors" demo control. */
export async function mock<T>(produce: () => T, ms = 260): Promise<T> {
  await sleep(ms);
  if (simulateErrors) throw new ApiError('Simulated service failure (demo control in Settings).', 503);
  return JSON.parse(JSON.stringify(produce())) as T;
}

export async function request<T>(path: string, init?: RequestInit, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const isForm = typeof FormData !== 'undefined' && init?.body instanceof FormData;
    const res = await fetch(`${config.apiUrl}${path}`, {
      ...init,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...(config.apiToken ? { Authorization: `Bearer ${config.apiToken}` } : {}),
        ...(init?.headers ?? {}),
      },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      if (res.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('clarix:auth_required', { detail: { path, status: 401 } }));
      }
      let msg = `Backend returned ${res.status} for ${path}`;
      let errBody: Record<string, any> | null = null;
      try {
        errBody = (await res.json()) as Record<string, any>;
        if (errBody?.error?.message) msg = errBody.error.message;
        else if (errBody?.message) msg = errBody.message;
      } catch { /* non-JSON error body */ }

      if (res.status === 423 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('clarix:system_locked', {
          detail: {
            path,
            status: 423,
            code: errBody?.error?.code || 'system_locked',
            reason: errBody?.error?.reason || errBody?.error?.message || 'Cryptographic integrity violation',
            evidence: errBody?.error?.evidence || '',
          }
        }));
      }

      const err = new ApiError(msg, res.status);
      (err as any).data = errBody;
      throw err;
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(`Cannot reach backend at ${config.apiUrl}. Is the FastAPI service running?`);
  } finally {
    clearTimeout(t);
  }
}

/** Real connectivity probe used by Settings. Only loopback/LAN targets make sense in an air-gap. */
export async function probe(url: string, path = ''): Promise<BackendStatus> {
  const started = performance.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(url.replace(/\/$/, '') + path, { signal: ctrl.signal });
    return { ok: res.ok, message: res.ok ? `Responded ${res.status}` : `Responded with HTTP ${res.status}`, latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { ok: false, message: 'No response. The service is not running, or the browser blocked the request (CORS).' };
  } finally {
    clearTimeout(t);
  }
}
