import { useEffect, useState, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { ClarixMark } from '../common/ClarixMark';
import { auditService, type IntegrityStatus } from '../../services';
import { useConsole } from '../../state/ConsoleContext';
import styles from './PillNav.module.css';

export interface PillNavProps {
  integrity?: IntegrityStatus | null;
  isDemo?: boolean;
  toggling?: boolean;
  onToggleDemo?: () => void;
}

export function PillNav(props: PillNavProps) {
  const location = useLocation();
  const consoleCtx = useConsole();
  const [closed, setClosed] = useState(false);

  // Internal state fallback if props are not passed
  const [internalIntegrity, setInternalIntegrity] = useState<IntegrityStatus | null>(null);
  const [internalToggling, setInternalToggling] = useState(false);

  const hasProps = props.integrity !== undefined;

  useEffect(() => {
    if (hasProps) return;
    let mounted = true;
    const check = async () => {
      try {
        const st = await auditService.getIntegrityStatus();
        if (mounted) setInternalIntegrity(st);
      } catch {
        // ignore
      }
    };
    check();
    const interval = setInterval(check, 2500);

    const onDemoChanged = (ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      if (mounted && detail) {
        setInternalIntegrity((prev) =>
          prev
            ? {
                ...prev,
                ledger: detail.ledger,
                demoMode: detail.demoMode,
                dbPath: detail.dbPath,
                locked: detail.locked,
              }
            : null
        );
      }
    };
    window.addEventListener('clarix:demo_mode_changed', onDemoChanged);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('clarix:demo_mode_changed', onDemoChanged);
    };
  }, [hasProps]);

  const integrity = hasProps ? props.integrity : internalIntegrity;
  const isDemo = hasProps
    ? props.isDemo
    : Boolean(integrity?.ledger === 'demo' || integrity?.demoMode);
  const toggling = hasProps ? props.toggling : internalToggling;

  const handleInternalToggleDemo = async () => {
    setInternalToggling(true);
    try {
      const nextMode = !isDemo;
      const res = await auditService.toggleDemoMode(nextMode);
      setInternalIntegrity((prev) =>
        prev
          ? {
              ...prev,
              ledger: res.ledger,
              demoMode: res.demoMode,
              dbPath: res.dbPath,
              locked: res.locked,
            }
          : null
      );
      consoleCtx.toast(
        res.demoMode
          ? 'Switched to Demo Mode (isolated sandbox ledger).'
          : 'Returned to Live Ledger (production files untouched).',
        'green'
      );
      window.dispatchEvent(
        new CustomEvent('clarix:demo_mode_changed', { detail: res })
      );
    } catch (e: any) {
      consoleCtx.toast(e?.message || 'Failed to switch demo mode', 'red');
    } finally {
      setInternalToggling(false);
    }
  };

  const onToggleDemo = hasProps ? props.onToggleDemo : handleInternalToggleDemo;

  const toggleNav = () => setClosed((prev) => !prev);

  const handleKeyDown = (e: KeyboardEvent<HTMLAnchorElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleNav();
    }
  };

  const isHomeActive = location.pathname === '/';

  return (
    <nav
      id="nav"
      className={`${styles.nav} ${closed ? styles.closed : ''}`}
      aria-label="Pill navigation"
    >
      <Link
        to="/"
        className={styles.logo}
        id="logo"
        aria-label="Clarix Home"
        title={closed ? 'Expand navigation' : 'Clarix AI Home'}
        onKeyDown={handleKeyDown}
      >
        <ClarixMark size={18} />
      </Link>

      <div className={styles.items} id="items">
        <Link
          to="/"
          className={`${styles.item} ${isHomeActive ? styles.active : ''}`}
          aria-current={isHomeActive ? 'page' : undefined}
        >
          <span>Home</span>
          {isHomeActive && <span className={styles.activeDot} aria-hidden="true" />}
        </Link>

        <div className={styles.divider} aria-hidden="true" />

        {/* LIVE LEDGER / DEMO MODE / SYSTEM LOCKED BADGE */}
        {integrity?.locked ? (
          <Link
            to="/audit"
            className={`${styles.ledgerBadge} ${styles.lockedBadge}`}
            title={`System locked: ${integrity.reason || 'Cryptographic tamper detected'}`}
          >
            <ShieldAlert width={13} height={13} />
            <span>SYSTEM LOCKED</span>
          </Link>
        ) : isDemo ? (
          <Link
            to="/audit"
            className={`${styles.ledgerBadge} ${styles.demoBadge}`}
            title={`Isolated Demo Ledger active: ${integrity?.dbPath || 'data/demo/clarix_demo.db'}`}
          >
            <span className={styles.demoDot} />
            <span>DEMO MODE</span>
          </Link>
        ) : (
          <Link
            to="/audit"
            className={`${styles.ledgerBadge} ${styles.liveBadge}`}
            title={`Live Production Ledger active: ${integrity?.dbPath || 'data/clarix.db'}`}
          >
            <span className={styles.liveDot} />
            <span>LIVE LEDGER</span>
          </Link>
        )}

        {/* ENTER / EXIT DEMO MODE BUTTON */}
        <button
          type="button"
          className={`${styles.demoBtn} ${isDemo ? styles.demoBtnActive : styles.demoBtnLive}`}
          onClick={onToggleDemo}
          disabled={toggling}
          title={
            isDemo
              ? 'Exit Demo Mode and return to untouched production ledger'
              : 'Enter Demo Mode to test attacks in safe sandbox'
          }
        >
          {toggling ? 'Switching…' : isDemo ? 'Exit Demo Mode' : 'Enter Demo Mode'}
        </button>
      </div>
    </nav>
  );
}

export default PillNav;
