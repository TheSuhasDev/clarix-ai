import { useEffect, useState } from 'react';
import { Bell, ShieldAlert, Sparkles, Database, ShieldCheck } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useConsole } from '../../state/ConsoleContext';
import { auditService, config, type IntegrityStatus } from '../../services';
import styles from './Layout.module.css';

export function TopBar() {
  const { settings, counts, toast } = useConsole();
  const alerts = counts.pendingApprovals;
  const [integrity, setIntegrity] = useState<IntegrityStatus | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const st = await auditService.getIntegrityStatus();
        if (mounted) setIntegrity(st);
      } catch {
        // ignore
      }
    };
    check();
    const interval = setInterval(check, 2500);

    const onDemoChanged = (ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      if (mounted && detail) {
        setIntegrity((prev) => prev ? { ...prev, ledger: detail.ledger, demoMode: detail.demoMode, dbPath: detail.dbPath, locked: detail.locked } : null);
      }
    };
    window.addEventListener('clarix:demo_mode_changed', onDemoChanged);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('clarix:demo_mode_changed', onDemoChanged);
    };
  }, []);

  const isDemo = Boolean(integrity?.ledger === 'demo' || integrity?.demoMode);

  const handleToggleDemo = async () => {
    setToggling(true);
    try {
      const nextMode = !isDemo;
      const res = await auditService.toggleDemoMode(nextMode);
      setIntegrity((prev) => prev ? { ...prev, ledger: res.ledger, demoMode: res.demoMode, dbPath: res.dbPath, locked: res.locked } : null);
      toast(res.demoMode ? 'Switched to Demo Mode (isolated sandbox ledger).' : 'Returned to Live Ledger (production files untouched).', 'green');
      window.dispatchEvent(new CustomEvent('clarix:demo_mode_changed', { detail: res }));
    } catch (e: any) {
      toast(e?.message || 'Failed to switch demo mode', 'red');
    } finally {
      setToggling(false);
    }
  };

  return (
    <header className={styles.top}>
      {settings.notifications && alerts > 0 && (
        <NavLink to="/approvals" className={styles.bell} aria-label={`${alerts} approval${alerts > 1 ? 's' : ''} waiting`}>
          <Bell width={14} height={14} />{alerts} approval{alerts > 1 ? 's' : ''} waiting
        </NavLink>
      )}

      {integrity && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          {integrity.locked ? (
            <NavLink
              to="/audit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.74rem',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '6px',
                textDecoration: 'none',
                backgroundColor: 'rgba(239, 68, 68, 0.22)',
                color: '#ef4444',
                border: '1.5px solid #ef4444',
                letterSpacing: '0.04em',
              }}
              title={`System locked: ${integrity.reason || 'Cryptographic tamper detected'}`}
            >
              <ShieldAlert width={14} height={14} />
              <span>SYSTEM LOCKED</span>
            </NavLink>
          ) : isDemo ? (
            <NavLink
              to="/audit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.74rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '6px',
                textDecoration: 'none',
                backgroundColor: 'rgba(245, 158, 11, 0.16)',
                color: '#d97706',
                border: '1px solid rgba(245, 158, 11, 0.45)',
                letterSpacing: '0.02em',
              }}
              title={`Isolated Demo Ledger active: ${integrity.dbPath || 'data/demo/clarix_demo.db'}`}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#d97706', boxShadow: '0 0 6px #d97706' }} />
              <span>DEMO MODE · sandbox ledger</span>
            </NavLink>
          ) : (
            <NavLink
              to="/audit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.74rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '6px',
                textDecoration: 'none',
                backgroundColor: 'rgba(16, 185, 129, 0.14)',
                color: '#059669',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                letterSpacing: '0.02em',
              }}
              title={`Live Production Ledger active: ${integrity.dbPath || 'data/clarix.db'}`}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#059669', boxShadow: '0 0 6px #059669' }} />
              <span>LIVE LEDGER</span>
            </NavLink>
          )}

          <button
            type="button"
            className="cx-btn cx-btn--ghost cx-btn--xs"
            onClick={handleToggleDemo}
            disabled={toggling}
            style={{
              fontSize: '0.70rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '5px',
              border: isDemo ? '1px solid #d97706' : '1px solid #cbd5e1',
              color: isDemo ? '#b45309' : '#1e293b',
              backgroundColor: isDemo ? 'rgba(254, 243, 199, 0.8)' : '#ffffff',
            }}
            title={isDemo ? 'Exit Demo Mode and return to untouched production ledger' : 'Enter Demo Mode to test attacks in safe sandbox'}
          >
            {toggling ? 'Switching…' : isDemo ? 'Exit Demo Mode' : 'Enter Demo Mode'}
          </button>
        </div>
      )}

      {config.useMocks && (
        <span className={styles.demo} title="All figures in this console are mock data until the backend is connected.">
          <i />SIMULATED DATA
        </span>
      )}
      <nav className={styles.links} aria-label="Quick links">
        <NavLink to="/overview">Overview ↗</NavLink>
        <NavLink to="/policies">Policies ↗</NavLink>
        <NavLink to="/prompt-injection">Threats ↗</NavLink>
        <NavLink to="/settings">System ↗</NavLink>
      </nav>
    </header>
  );
}
