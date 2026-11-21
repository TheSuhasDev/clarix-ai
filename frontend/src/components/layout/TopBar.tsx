import { useEffect, useState } from 'react';
import { Bell, Menu } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useConsole } from '../../state/ConsoleContext';
import { auditService, config, type IntegrityStatus } from '../../services';
import { PillNav } from '../navigation/PillNav';
import styles from './Layout.module.css';

export function TopBar() {
  const { settings, counts, toast, drawerOpen, setDrawerOpen } = useConsole();
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
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={styles.mobileMenuBtn}
          onClick={() => setDrawerOpen(!drawerOpen)}
          aria-label={drawerOpen ? 'Close navigation drawer' : 'Open navigation drawer'}
        >
          <Menu width={18} height={18} />
        </button>

        {settings.notifications && alerts > 0 && (
          <NavLink to="/approvals" className={styles.bell} aria-label={`${alerts} approval${alerts > 1 ? 's' : ''} waiting`}>
            <Bell width={14} height={14} />{alerts} approval{alerts > 1 ? 's' : ''} waiting
          </NavLink>
        )}

        {config.useMocks && (
          <span className={styles.demo} title="All figures in this console are mock data until the backend is connected.">
            <i />SIMULATED DATA
          </span>
        )}
      </div>

      <PillNav
        integrity={integrity}
        isDemo={isDemo}
        toggling={toggling}
        onToggleDemo={handleToggleDemo}
      />
    </header>
  );
}
