import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { demoFlags, overviewService, setSimulatedErrors } from '../services';
import type { SecurityEvent } from '../types';
import { useInterval } from '../hooks/useInterval';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { clock, uid } from '../utils/format';

export interface Settings {
  demoMode: boolean;
  heartbeat: boolean;
  notifications: boolean;
  auditLogging: boolean;
  webCrypto: boolean;
  simulateErrors: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  demoMode: true, heartbeat: true, notifications: true, auditLogging: true, webCrypto: true, simulateErrors: false,
};

export type ToastTone = 'green' | 'red' | 'blue' | 'amber';
interface Toast { id: string; tone: ToastTone; text: string }

export interface AirGapPosture {
  status: 'ISOLATED' | 'NOT_ISOLATED' | 'UNKNOWN';
  reasons: string[];
  outbound: number | null;
}

interface Counts { pendingApprovals: number; threats: number }

const SIDEBAR_STORAGE_KEY = 'clarix.sidebar.collapsed';
const PERF_MODE_STORAGE_KEY = 'clarix.performance.mode';

function getInitialSidebarCollapsed(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.has('collapsed')) return sp.get('collapsed') === 'true';
    }
    const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved !== null) return JSON.parse(saved);
  } catch {
    // fallback
  }
  if (typeof window !== 'undefined' && window.innerWidth < 520) return true;
  return false;
}

function getInitialPerformanceMode(): boolean {
  try {
    const saved = localStorage.getItem(PERF_MODE_STORAGE_KEY);
    if (saved !== null) return JSON.parse(saved);
  } catch {
    // fallback
  }
  return false;
}

interface ConsoleValue {
  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetSettings: () => void;
  counts: Counts;
  refreshCounts: () => void;
  airGapStatus: AirGapPosture;
  liveEvents: SecurityEvent[];
  toasts: Toast[];
  toast: (text: string, tone?: ToastTone) => void;
  dismissToast: (id: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  performanceMode: boolean;
  setPerformanceMode: (enabled: boolean) => void;
}

const Ctx = createContext<ConsoleValue | null>(null);

const HEARTBEATS: Omit<SecurityEvent, 'id' | 'time'>[] = [
  { source: 'Ollama Core', message: 'Heartbeat response: llama3 standby (temp 0.2)', kind: 'SUCCESS' },
  { source: 'Air-Gap Monitor', message: 'NIC socket check: 0 outbound connections detected', kind: 'INFO' },
  { source: 'Policy Engine', message: 'Zero-trust perimeter verification: All rules active', kind: 'INFO' },
  { source: 'Integrity Daemon', message: 'SHA-256 chain integrity verified: 0 tampered blocks', kind: 'AUDIT' },
];

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useLocalStorage<Settings>('clarix.settings.v1', DEFAULT_SETTINGS);
  const [counts, setCounts] = useState<Counts>({ pendingApprovals: 0, threats: 0 });
  const [airGapStatus, setAirGapStatus] = useState<AirGapPosture>({
    status: 'ISOLATED',
    reasons: [],
    outbound: 0,
  });
  const [liveEvents, setLiveEvents] = useState<SecurityEvent[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(getInitialSidebarCollapsed);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [performanceMode, setPerformanceModeState] = useState<boolean>(getInitialPerformanceMode);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(collapsed));
    } catch {
      // ignore
    }
  }, []);

  const setPerformanceMode = useCallback((enabled: boolean) => {
    setPerformanceModeState(enabled);
    try {
      localStorage.setItem(PERF_MODE_STORAGE_KEY, JSON.stringify(enabled));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (performanceMode) {
        document.body.classList.add('performance-mode');
      } else {
        document.body.classList.remove('performance-mode');
      }
    }
  }, [performanceMode]);

  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((text: string, tone: ToastTone = 'blue') => {
    const id = uid('t');
    setToasts((t) => [...t.slice(-3), { id, tone, text }]);
    window.setTimeout(() => dismissToast(id), 4200);
  }, [dismissToast]);

  const refreshCounts = useCallback(() => {
    overviewService.get().then(
      (o) => {
        setCounts({ pendingApprovals: o.pendingApprovals, threats: o.threats });
        if (o.airGap) {
          setAirGapStatus({
            status: (o.airGap.status as any) || 'ISOLATED',
            reasons: o.airGap.reasons || [],
            outbound: o.outbound ?? null,
          });
        }
      },
      () => { /* keep previous counts; pages show their own error states */ },
    );
  }, []);

  useEffect(() => { refreshCounts(); }, [refreshCounts]);
  useEffect(() => { setSimulatedErrors(settings.simulateErrors); }, [settings.simulateErrors]);
  useEffect(() => { demoFlags.audit = settings.auditLogging; demoFlags.crypto = settings.webCrypto; }, [settings.auditLogging, settings.webCrypto]);

  // Simulated heartbeat: clearly mock events, not real telemetry.
  useInterval(() => {
    const h = HEARTBEATS[Math.floor(Date.now() / 18000) % HEARTBEATS.length];
    setLiveEvents((e) => [{ ...h, id: uid('hb'), time: clock() }, ...e].slice(0, 30));
  }, settings.heartbeat ? 18000 : null);

  const setSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings({ ...settings, [key]: value });
  }, [settings, setSettings]);

  const resetSettings = useCallback(() => setSettings(DEFAULT_SETTINGS), [setSettings]);

  const value = useMemo<ConsoleValue>(() => ({
    settings,
    setSetting,
    resetSettings,
    counts,
    refreshCounts,
    airGapStatus,
    liveEvents,
    toasts,
    toast,
    dismissToast,
    sidebarCollapsed,
    setSidebarCollapsed,
    drawerOpen,
    setDrawerOpen,
    performanceMode,
    setPerformanceMode,
  }), [
    settings,
    setSetting,
    resetSettings,
    counts,
    refreshCounts,
    airGapStatus,
    liveEvents,
    toasts,
    toast,
    dismissToast,
    sidebarCollapsed,
    setSidebarCollapsed,
    drawerOpen,
    setDrawerOpen,
    performanceMode,
    setPerformanceMode,
  ]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConsole(): ConsoleValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useConsole must be used inside <ConsoleProvider>');
  return v;
}
