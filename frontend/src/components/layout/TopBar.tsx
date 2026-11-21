import { useEffect, useState } from 'react';
import { Bell, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useConsole } from '../../state/ConsoleContext';
import { auditService, type IntegrityStatus } from '../../services';
import styles from './Layout.module.css';

export function TopBar() {
  const { settings, counts } = useConsole();
  const alerts = counts.pendingApprovals;
  const [integrity, setIntegrity] = useState<IntegrityStatus | null>(null);

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
    const interval = setInterval(check, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className={styles.top}>
      {settings.notifications && alerts > 0 && <NavLink to="/approvals" className={styles.bell} aria-label={`${alerts} approval${alerts > 1 ? 's' : ''} waiting`}><Bell width={14} height={14} />{alerts} approval{alerts > 1 ? 's' : ''} waiting</NavLink>}

      {integrity && (
        <NavLink
          to="/audit"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.74rem',
            fontWeight: 700,
            padding: '3px 9px',
            borderRadius: '4px',
            textDecoration: 'none',
            letterSpacing: '0.03em',
            ...(integrity.locked
              ? { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444' }
              : integrity.status === 'WARN'
              ? { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid #f59e0b' }
              : { backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }),
          }}
          title={
            integrity.locked
              ? `System locked: ${integrity.reason || 'Cryptographic tamper detected'}`
              : `Cryptographic hash chain & state verified (${integrity.last_checked_seconds_ago ?? 0}s ago)`
          }
        >
          {integrity.locked ? (
            <>
              <ShieldAlert width={13} height={13} />
              <span>SYSTEM LOCKED</span>
            </>
          ) : integrity.status === 'WARN' ? (
            <>
              <AlertTriangle width={13} height={13} />
              <span>INTEGRITY WARN</span>
            </>
          ) : (
            <>
              <ShieldCheck width={13} height={13} />
              <span>INTEGRITY VERIFIED</span>
            </>
          )}
        </NavLink>
      )}

      <span className={styles.demo} title="All figures in this console are mock data until the backend is connected."><i />SIMULATED DATA</span>
      <nav className={styles.links} aria-label="Quick links">
        <NavLink to="/overview">Overview ↗</NavLink>
        <NavLink to="/policies">Policies ↗</NavLink>
        <NavLink to="/prompt-injection">Threats ↗</NavLink>
        <NavLink to="/settings">System ↗</NavLink>
      </nav>
    </header>
  );
}
