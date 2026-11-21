import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ClarixMark } from '../common/ClarixMark';
import styles from './PillNav.module.css';

interface NavItem {
  label: string;
  path: string;
}

const NAV_LINKS: NavItem[] = [
  { label: 'Home', path: '/' },
  { label: 'Console', path: '/overview' },
  { label: 'Architecture', path: '/architecture' },
  { label: 'Settings', path: '/settings' },
];

export function PillNav() {
  const [closed, setClosed] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 900 : false));
  const location = useLocation();

  const activeIndex = NAV_LINKS.findIndex((l) => {
    if (l.path === '/') return location.pathname === '/';
    return location.pathname.startsWith(l.path);
  });
  // Map any other console sub-routes (/policies, /incidents, etc.) to the Console item
  const isConsoleSubroute =
    activeIndex === -1 &&
    location.pathname !== '/' &&
    !location.pathname.startsWith('/architecture') &&
    !location.pathname.startsWith('/settings');
  const active = isConsoleSubroute ? 1 : activeIndex;

  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [dotLeft, setDotLeft] = useState<number | null>(null);

  const updateDot = useCallback(
    (index: number) => {
      if (index < 0) {
        setDotLeft(null);
        return;
      }
      const el = itemRefs.current[index];
      if (el) {
        setDotLeft(el.offsetLeft + el.offsetWidth / 2);
      }
    },
    []
  );

  useEffect(() => {
    updateDot(active);
  }, [active, updateDot]);

  useEffect(() => {
    const onResize = () => {
      updateDot(active);
    };
    window.addEventListener('resize', onResize);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => updateDot(active));
    }
    return () => window.removeEventListener('resize', onResize);
  }, [active, updateDot]);

  const toggleNav = () => {
    setClosed((prev) => {
      const next = !prev;
      if (!next) {
        setTimeout(() => updateDot(active), 520);
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
        onClick={toggleNav}
        onKeyDown={handleKeyDown}
      >
        <ClarixMark size={20} />
      </div>

      <div className={styles.items} id="items">
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
              onClick={() => updateDot(i)}
            >
              <span className={styles.circle} />
              <span className={styles.labelWrap}>
                <span className={styles.label}>{link.label}</span>
                <span className={styles.labelHover}>{link.label}</span>
              </span>
            </Link>
          );
        })}

        {dotLeft !== null && active >= 0 && (
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
