import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { ClarixMark } from '../common/ClarixMark';
import styles from './Sidebar.module.css';

export interface SidebarBadge {
  text: string;
  tone: 'danger' | 'success' | 'info' | 'warning';
}

export interface SidebarItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: SidebarBadge;
  children?: SidebarItem[];
}

export interface SidebarSection {
  label: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  items?: SidebarItem[];
  sections?: SidebarSection[];
  settingsItem?: SidebarItem;
  activeKey?: string;
  onSelect?: (key: string) => void;
  defaultCollapsed?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

const STORAGE_KEY = 'clarix.sidebar.collapsed';

function getStoredCollapsed(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      return JSON.parse(saved);
    }
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined' && window.innerWidth < 520) {
    return true;
  }
  return false;
}

function persistCollapsed(val: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
  } catch {
    // ignore
  }
}

export function Sidebar({
  items,
  sections,
  settingsItem,
  activeKey,
  onSelect,
  defaultCollapsed,
  collapsed: controlledCollapsed,
  onCollapsedChange,
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isControlled = controlledCollapsed !== undefined;

  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    if (defaultCollapsed !== undefined) return defaultCollapsed;
    return getStoredCollapsed();
  });

  const isCollapsed = isControlled ? controlledCollapsed : internalCollapsed;

  const setCollapsed = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setInternalCollapsed(next);
      }
      persistCollapsed(next);
      onCollapsedChange?.(next);
    },
    [isControlled, onCollapsedChange]
  );

  // Normalize sections
  const normalizedSections: SidebarSection[] = useMemo(() => {
    if (sections && sections.length > 0) return sections;
    if (items && items.length > 0) return [{ label: '', items }];
    return [];
  }, [sections, items]);

  const allItems = useMemo(
    () => [
      ...normalizedSections.flatMap((s) =>
        s.items.flatMap((item) => [item, ...(item.children ?? [])])
      ),
      ...(settingsItem ? [settingsItem, ...(settingsItem.children ?? [])] : []),
    ],
    [normalizedSections, settingsItem]
  );

  // Group accordion expansion state
  const isNetworkRoute = location.pathname.startsWith('/network');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => ({
    network: isNetworkRoute,
  }));

  // Auto-expand when URL enters /network, collapse when navigating away
  const prevPathnameRef = useRef(location.pathname);
  useEffect(() => {
    const wasNetwork = prevPathnameRef.current.startsWith('/network');
    const isNetwork = location.pathname.startsWith('/network');
    prevPathnameRef.current = location.pathname;

    if (isNetwork && !wasNetwork) {
      setExpandedGroups((prev) => ({ ...prev, network: true }));
    } else if (!isNetwork && wasNetwork) {
      setExpandedGroups((prev) => ({ ...prev, network: false }));
    }
  }, [location.pathname]);

  // Active key resolution: longest-prefix match on pathname
  const resolvedActiveKey = useMemo(() => {
    if (activeKey !== undefined) return activeKey;
    const sorted = [...allItems].sort((a, b) => b.href.length - a.href.length);
    for (const item of sorted) {
      if (item.href === '/') {
        if (location.pathname === '/') return item.key;
      } else if (
        location.pathname === item.href ||
        location.pathname.startsWith(item.href + '/')
      ) {
        return item.key;
      }
    }
    return undefined;
  }, [activeKey, allItems, location.pathname]);

  const sidebarRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});

  // Slide highlight measurement
  const measureHighlight = useCallback(() => {
    if (!sidebarRef.current || !hlRef.current) return;
    const isNetwork = location.pathname.startsWith('/network');

    // When collapsed to icons only and on /network, highlight the parent Network row
    const targetKey = isCollapsed && isNetwork ? 'network' : resolvedActiveKey;

    if (!targetKey) {
      hlRef.current.style.opacity = '0';
      return;
    }
    const activeEl = itemRefs.current[targetKey];
    if (!activeEl) {
      hlRef.current.style.opacity = '0';
      return;
    }
    const sidebarRect = sidebarRef.current.getBoundingClientRect();
    const itemRect = activeEl.getBoundingClientRect();

    if (itemRect.height === 0) {
      hlRef.current.style.opacity = '0';
      return;
    }

    // Check if the item is scrolled out of the visible sidebar area
    if (
      itemRect.bottom < sidebarRect.top + 44 ||
      itemRect.top > sidebarRect.bottom - 44
    ) {
      hlRef.current.style.opacity = '0';
      return;
    }

    const x = itemRect.left - sidebarRect.left;
    const y = itemRect.top - sidebarRect.top;
    const w = itemRect.width;
    const h = itemRect.height;

    hlRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    hlRef.current.style.width = `${w}px`;
    hlRef.current.style.height = `${h}px`;
    hlRef.current.style.borderRadius = activeEl.dataset.subItem ? '12px' : '16px';
    hlRef.current.style.opacity = '1';
  }, [isCollapsed, location.pathname, resolvedActiveKey]);

  useEffect(() => {
    measureHighlight();
  }, [measureHighlight, isCollapsed, expandedGroups]);

  // Re-measure on window resize, list scroll, font loading, and layout changes
  useEffect(() => {
    const onResize = () => measureHighlight();
    window.addEventListener('resize', onResize);

    const listEl = listRef.current;
    if (listEl) {
      listEl.addEventListener('scroll', measureHighlight, { passive: true });
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measureHighlight);
    }

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && sidebarRef.current) {
      ro = new ResizeObserver(() => measureHighlight());
      ro.observe(sidebarRef.current);
    }

    return () => {
      window.removeEventListener('resize', onResize);
      if (listEl) {
        listEl.removeEventListener('scroll', measureHighlight);
      }
      if (ro) {
        ro.disconnect();
      }
    };
  }, [measureHighlight]);

  // Re-measure after collapse transition completes
  const handleTransitionEnd = (e: React.TransitionEvent<HTMLElement>) => {
    if (e.propertyName === 'width') {
      measureHighlight();
    }
  };

  const handleTopClick = () => {
    if (isCollapsed) {
      setCollapsed(false);
    }
  };

  const handleTopKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (isCollapsed && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setCollapsed(false);
    }
  };

  const handleChevClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setCollapsed(true);
  };

  const handleItemClick = (e: MouseEvent<HTMLAnchorElement>, item: SidebarItem) => {
    const hasChildren = Boolean(item.children && item.children.length > 0);

    if (isCollapsed) {
      if (hasChildren) {
        e.preventDefault();
        setCollapsed(false);
        setExpandedGroups((prev) => ({ ...prev, [item.key]: true }));
        if (!location.pathname.startsWith('/network')) {
          navigate('/network/dashboard');
        }
        return;
      }
    } else if (hasChildren) {
      const isCurrentGroup = location.pathname.startsWith('/network');
      if (isCurrentGroup) {
        // Toggle closed/open when clicked while already on a network page
        e.preventDefault();
        setExpandedGroups((prev) => ({ ...prev, [item.key]: !prev[item.key] }));
      } else {
        // Expand group and navigate to /network/dashboard
        setExpandedGroups((prev) => ({ ...prev, [item.key]: true }));
      }
    }

    onSelect?.(item.key);
  };

  const handleItemKeyDown = (e: KeyboardEvent<HTMLAnchorElement>, item: SidebarItem) => {
    if (e.key === ' ' && item.children && item.children.length > 0) {
      e.preventDefault();
      if (isCollapsed) {
        setCollapsed(false);
        setExpandedGroups((prev) => ({ ...prev, [item.key]: true }));
        if (!location.pathname.startsWith('/network')) {
          navigate('/network/dashboard');
        }
      } else {
        const isCurrentGroup = location.pathname.startsWith('/network');
        if (isCurrentGroup) {
          setExpandedGroups((prev) => ({ ...prev, [item.key]: !prev[item.key] }));
        } else {
          setExpandedGroups((prev) => ({ ...prev, [item.key]: true }));
          navigate('/network/dashboard');
        }
      }
    }
  };

  // Mount via portal to document.body so no parent opacity/filter/transform breaks backdrop-filter
  const asideContent = (
    <aside
      ref={sidebarRef}
      className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}
      aria-label="Console navigation"
      onTransitionEnd={handleTransitionEnd}
    >
      {/* Single sliding active highlight pill */}
      <div ref={hlRef} className={styles.hl} aria-hidden="true" />

      {/* Top Header: Logo button (expands when collapsed) + Collapse button */}
      <div className={styles.top}>
        <button
          type="button"
          className={styles.logoBtn}
          onClick={handleTopClick}
          onKeyDown={handleTopKeyDown}
          tabIndex={isCollapsed ? 0 : -1}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Clarix navigation'}
          aria-expanded={!isCollapsed}
        >
          <div className={styles.mark} aria-hidden="true">
            <ClarixMark size={22} />
          </div>
          <span className={styles.brand}>Clarix</span>
        </button>
        <button
          type="button"
          className={styles.chev}
          onClick={handleChevClick}
          aria-label="Collapse sidebar"
          tabIndex={isCollapsed ? -1 : 0}
        >
          <ChevronLeft width={14} height={14} strokeWidth={2.8} />
        </button>
      </div>

      {/* Grouped navigation list (scrollable on overflow, hidden scrollbar) */}
      <div ref={listRef} className={styles.list}>
        {normalizedSections.map((sec, secIdx) => (
          <div key={sec.label || secIdx} className={styles.section}>
            {secIdx > 0 && <div className={styles.divider} aria-hidden="true" />}
            {sec.label && <div className={styles.sectionLabel}>{sec.label}</div>}
            {sec.items.map((item) => {
              const hasChildren = Boolean(item.children && item.children.length > 0);
              const isGroupExpanded = Boolean(expandedGroups[item.key]);
              const isGroupActive = hasChildren && location.pathname.startsWith('/network');

              // In expanded mode, active highlight is on the active sub-item.
              // In collapsed mode, active highlight is on the parent Network row.
              const isActive = isCollapsed
                ? isGroupActive || item.key === resolvedActiveKey
                : item.key === resolvedActiveKey;

              const isParentActive = hasChildren && !isCollapsed && isGroupActive;
              const Icon = item.icon;

              return (
                <div key={item.key} style={{ display: 'contents' }}>
                  <Link
                    to={item.href === '/network' ? '/network/dashboard' : item.href}
                    ref={(el) => {
                      itemRefs.current[item.key] = el;
                    }}
                    className={`${styles.row} ${isParentActive ? styles.rowParentActive : ''}`}
                    title={isCollapsed ? item.label : undefined}
                    aria-current={isActive && !isParentActive ? 'page' : undefined}
                    aria-expanded={hasChildren ? isGroupExpanded : undefined}
                    aria-controls={hasChildren ? `subgroup-${item.key}` : undefined}
                    onClick={(e) => handleItemClick(e, item)}
                    onKeyDown={(e) => handleItemKeyDown(e, item)}
                  >
                    <div className={styles.iconWrap}>
                      <Icon aria-hidden="true" />
                      {item.badge && (
                        <span
                          className={`${styles.statusDot} ${styles[item.badge.tone]}`}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className={`${styles.badge} ${styles[item.badge.tone]}`}>
                        {item.badge.text}
                      </span>
                    )}
                    {hasChildren && (
                      <ChevronDown
                        className={`${styles.parentChevron} ${
                          isGroupExpanded ? styles.parentChevronExpanded : ''
                        }`}
                        aria-hidden="true"
                      />
                    )}
                  </Link>

                  {/* Sub-items accordion */}
                  {hasChildren && (
                    <div
                      id={`subgroup-${item.key}`}
                      className={`${styles.subGroupWrapper} ${
                        isGroupExpanded ? styles.subGroupWrapperOpen : ''
                      }`}
                      onTransitionEnd={(e) => {
                        if (e.target === e.currentTarget) {
                          measureHighlight();
                        }
                      }}
                      role="region"
                      aria-label={`${item.label} sub-navigation`}
                    >
                      <div className={styles.subGroupInner}>
                        {item.children!.map((child) => {
                          const isChildActive = child.key === resolvedActiveKey;
                          const ChildIcon = child.icon;
                          return (
                            <Link
                              key={child.key}
                              to={child.href}
                              ref={(el) => {
                                itemRefs.current[child.key] = el;
                              }}
                              data-sub-item="true"
                              className={styles.subRow}
                              aria-current={isChildActive ? 'page' : undefined}
                              onClick={() => onSelect?.(child.key)}
                            >
                              <ChildIcon aria-hidden="true" />
                              <span>{child.label}</span>
                              {child.badge && (
                                <span
                                  className={`${styles.badge} ${styles[child.badge.tone]}`}
                                >
                                  {child.badge.text}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Pinned Settings item separated by top border */}
      {settingsItem && (
        <div className={styles.foot}>
          {(() => {
            const isActive = settingsItem.key === resolvedActiveKey;
            const Icon = settingsItem.icon;
            return (
              <Link
                key={settingsItem.key}
                to={settingsItem.href}
                ref={(el) => {
                  itemRefs.current[settingsItem.key] = el;
                }}
                className={styles.row}
                title={isCollapsed ? settingsItem.label : undefined}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelect?.(settingsItem.key)}
              >
                <div className={styles.iconWrap}>
                  <Icon aria-hidden="true" />
                  {settingsItem.badge && (
                    <span
                      className={`${styles.statusDot} ${styles[settingsItem.badge.tone]}`}
                      aria-hidden="true"
                    />
                  )}
                </div>
                <span>{settingsItem.label}</span>
                {settingsItem.badge && (
                  <span className={`${styles.badge} ${styles[settingsItem.badge.tone]}`}>
                    {settingsItem.badge.text}
                  </span>
                )}
              </Link>
            );
          })()}
        </div>
      )}
    </aside>
  );

  if (typeof document !== 'undefined') {
    return createPortal(asideContent, document.body);
  }

  return asideContent;
}
