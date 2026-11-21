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
  // Map any other console sub-routes (/policies, /agent, etc.) to the Console item
  const isConsoleSubroute =
    activeIndex === -1 &&
    location.pathname !== '/' &&
    !location.pathname.startsWith('/architecture') &&
    !location.pathname.startsWith('/settings');
  const active = isConsoleSubroute ? 1 : activeIndex;

  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [highlightStyle, setHighlightStyle] = useState<{ left: number; width: number } | null>(null);

  const updateHighlight = useCallback((index: number) => {
    if (index < 0) {
      setHighlightStyle(null);
      return;
    }
    const el = itemRefs.current[index];
    if (el) {
      setHighlightStyle({
        left: el.offsetLeft,
        width: el.offsetWidth,
      });
    }
  }, []);

  useEffect(() => {
    updateHighlight(active);
  }, [active, updateHighlight, closed]);

  useEffect(() => {
    const onResize = () => {
      updateHighlight(active);
    };
    window.addEventListener('resize', onResize);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => updateHighlight(active));
    }
    return () => window.removeEventListener('resize', onResize);
  }, [active, updateHighlight]);

  const toggleNav = () => {
    setClosed((prev) => {
      const next = !prev;
      if (!next) {
        setTimeout(() => updateHighlight(active), 300);
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
        aria-label="Toggle navigation menu"
        title={closed ? 'Expand navigation' : 'Collapse navigation'}
        onClick={toggleNav}
        onKeyDown={handleKeyDown}
      >
        <ClarixMark size={18} />
      </div>

      <div className={styles.items} id="items">
        {highlightStyle && !closed && (
          <span
            className={styles.highlight}
            style={{
              transform: `translateX(${highlightStyle.left}px)`,
              width: `${highlightStyle.width}px`,
            }}
            aria-hidden="true"
          />
        )}
        {NAV_LINKS.map((link, idx) => {
          const isActive = idx === active;
          return (
            <Link
              key={link.path}
              to={link.path}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              className={`${styles.item} ${isActive ? styles.active : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={styles.label}>{link.label}</span>
              {isActive && <span className={styles.activeDot} aria-hidden="true" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
