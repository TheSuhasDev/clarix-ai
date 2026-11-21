import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { ClarixMark } from '../common/ClarixMark';
import { auditService, type IntegrityStatus } from '../../services/auditService';
import { useConsole } from '../../state/ConsoleContext';
import styles from './PillNav.module.css';

export interface PillNavProps {
  integrity?: IntegrityStatus | null;
  isDemo?: boolean;
  toggling?: boolean;
  onToggleDemo?: () => void;
}

const NAV_LINKS = [{ label: 'Home', path: '/' }];

export function PillNav(props: PillNavProps) {
  const [closed, setClosed] = useState(false);
  const location = useLocation();
  const { toast } = useConsole();

  // Internal state fallback if props are not passed (e.g. on Landing page)
  const [internalIntegrity, setInternalIntegrity] = useState<IntegrityStatus | null>(null);
  const [internalIsDemo, setInternalIsDemo] = useState(false);
  const [internalToggling, setInternalToggling] = useState(false);

  useEffect(() => {
    if (props.integrity !== undefined) return;
    let mounted = true;
    const fetchIntegrity = async () => {
      try {
        const res = await auditService.getIntegrityStatus();
        if (mounted) {
          setInternalIntegrity(res);
          setInternalIsDemo(Boolean(res.demoMode));
        }
      } catch {
        /* ignore */
      }
    };
    fetchIntegrity();
    const interval = setInterval(fetchIntegrity, 8000);
    const onDemoChanged = (e: any) => {
      if (mounted && e.detail) {
        setInternalIsDemo(Boolean(e.detail.demoMode));
        setInternalIntegrity((prev) =>
          prev
            ? {
                ...prev,
                ledger: e.detail.ledger,
                demoMode: e.detail.demoMode,
                dbPath: e.detail.dbPath,
                locked: e.detail.locked,
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
  }, [props.integrity]);

  const integrity = props.integrity !== undefined ? props.integrity : internalIntegrity;
  const isDemo = props.isDemo !== undefined ? props.isDemo : internalIsDemo;
  const toggling = props.toggling !== undefined ? props.toggling : internalToggling;

  const handleToggleDemo = async () => {
    if (props.onToggleDemo) {
      props.onToggleDemo();
      return;
    }
    setInternalToggling(true);
    try {
      const res = await auditService.toggleDemoMode(!internalIsDemo);
      setInternalIsDemo(Boolean(res.demoMode));
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
      toast(
        res.demoMode
          ? 'Switched to Demo Mode (isolated sandbox ledger).'
          : 'Returned to Live Ledger (production files untouched).',
        'green'
      );
      window.dispatchEvent(new CustomEvent('clarix:demo_mode_changed', { detail: res }));
    } catch (e: any) {
      toast(e?.message || 'Failed to switch demo mode', 'red');
    } finally {
      setInternalToggling(false);
    }
  };

  const active = location.pathname === '/' ? 0 : -1;
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [dotLeft, setDotLeft] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const targetIndex = hoveredIndex !== null ? hoveredIndex : active;

  const updateDot = useCallback((index: number) => {
    if (index < 0) {
      setDotLeft(null);
      return;
    }
    const el = itemRefs.current[index];
    if (el) {
      setDotLeft(el.offsetLeft + el.offsetWidth / 2);
    }
  }, []);

  useEffect(() => {
    updateDot(targetIndex);
  }, [targetIndex, updateDot, integrity?.demoMode, isDemo]);

  useEffect(() => {
    const onResize = () => updateDot(targetIndex);
    window.addEventListener('resize', onResize);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => updateDot(targetIndex));
    }
    return () => window.removeEventListener('resize', onResize);
  }, [targetIndex, updateDot]);

  const toggleNav = () => {
    setClosed((prev) => {
      const next = !prev;
      if (!next) {
        setTimeout(() => updateDot(targetIndex), 400);
      }
      return next;
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleNav();
    }
  };

  return (
    <nav
      id="nav"
      className={`${styles.nav} ${closed ? styles.closed : ''}`}
      aria-label="Pill navigation"
    >
      <div
        className={styles.logo}
        id="logo"
        role="button"
        tabIndex={0}
        aria-expanded={!closed}
        aria-label="Toggle navigation"
        title={closed ? 'Expand navigation' : 'Collapse navigation'}
        onClick={toggleNav}
        onKeyDown={handleKeyDown}
      >
        <ClarixMark size={20} />
      </div>

      <div
        className={styles.items}
        id="items"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {NAV_LINKS.map((link, i) => {
          const isActive = i === active;
          return (
            <Link
              key={link.path}
              to={link.path}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              className={`${styles.item} ${isActive ? styles.active : ''}`}
              onMouseEnter={() => setHoveredIndex(i)}
              onClick={() => {
                setHoveredIndex(null);
                updateDot(i);
              }}
            >
              <span className={styles.circle} />
              <span className={styles.labelWrap}>
                <span className={styles.label}>{link.label}</span>
                <span className={styles.labelHover}>{link.label}</span>
              </span>
            </Link>
          );
        })}

        <div className={styles.divider} aria-hidden="true" />

        {/* Ledger Status Badge */}
        {integrity?.locked ? (
          <Link
            to="/audit"
            className={`${styles.ledgerBadge} ${styles.lockedBadge}`}
            title={`System locked: ${integrity.reason || 'Cryptographic tamper detected'}`}
          >
            <ShieldAlert width={14} height={14} />
            <span>SYSTEM LOCKED</span>
          </Link>
        ) : isDemo ? (
          <Link
            to="/audit"
            className={`${styles.ledgerBadge} ${styles.demoBadge}`}
            title={`Isolated Demo Ledger active: ${integrity?.dbPath || 'data/demo/clarix_demo.db'}`}
          >
            <span className={styles.demoDot} />
            <span className={styles.badgeText}>DEMO MODE · sandbox ledger</span>
            <span className={styles.badgeTextCompact}>DEMO</span>
          </Link>
        ) : (
          <Link
            to="/audit"
            className={`${styles.ledgerBadge} ${styles.liveBadge}`}
            title={`Live Production Ledger active: ${integrity?.dbPath || 'data/clarix.db'}`}
          >
            <span className={styles.liveDot} />
            <span className={styles.badgeText}>LIVE LEDGER</span>
            <span className={styles.badgeTextCompact}>LIVE</span>
          </Link>
        )}

        {/* Demo Mode Toggle Button */}
        <button
          type="button"
          className={`${styles.demoBtn} ${isDemo ? styles.demoBtnActive : styles.demoBtnLive}`}
          onClick={handleToggleDemo}
          disabled={toggling}
          title={
            isDemo
              ? 'Exit Demo Mode and return to untouched production ledger'
              : 'Enter Demo Mode to test attacks in safe sandbox'
          }
        >
          {toggling ? (
            'Switching…'
          ) : (
            <>
              <span className={styles.btnText}>
                {isDemo ? 'Exit Demo Mode' : 'Enter Demo Mode'}
              </span>
              <span className={styles.btnTextCompact}>
                {isDemo ? 'Exit Demo' : 'Enter Demo'}
              </span>
            </>
          )}
        </button>

        {dotLeft !== null && targetIndex >= 0 && (
          <span
            className={styles.dot}
            style={{ left: `${dotLeft}px` }}
            aria-hidden="true"
          />
        )}
      </div>
    </nav>
  );
}

export default PillNav;
