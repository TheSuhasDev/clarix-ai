import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { ClarixMark } from '../common/ClarixMark';
import { useConsole } from '../../state/ConsoleContext';
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
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.has('collapsed')) {
        return sp.get('collapsed') === 'true';
      }
    }
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
  const { drawerOpen, setDrawerOpen } = useConsole();
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

  // Group accordion expansion state (for sections)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Auto-expand group containing current route
  useEffect(() => {
    for (const sec of normalizedSections) {
      if (!sec.label) continue;
      const hasActive = sec.items.some(
        (it) => it.href === location.pathname || (it.href !== '/' && location.pathname.startsWith(it.href))
      );
      if (hasActive) {
        setCollapsedGroups((prev) => {
          if (prev[sec.label]) {
            const next = { ...prev };
            delete next[sec.label];
            return next;
          }
          return prev;
        });
      }
    }
  }, [location.pathname, normalizedSections]);

  const toggleGroup = (groupLabel: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupLabel]: !prev[groupLabel],
    }));
  };

  // Sub-item expansion state
  const isNetworkSubRoute = location.pathname.startsWith('/network/');
  const [expandedSubGroups, setExpandedSubGroups] = useState<Record<string, boolean>>(() => ({
    network: isNetworkSubRoute,
  }));

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

    const targetKey = resolvedActiveKey;

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

    if (
      itemRect.bottom < sidebarRect.top + 40 ||
      itemRect.top > sidebarRect.bottom - 40
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
    hlRef.current.style.borderRadius = activeEl.dataset.subItem ? '10px' : '12px';
    hlRef.current.style.opacity = '1';
  }, [resolvedActiveKey]);

  useEffect(() => {
    measureHighlight();
  }, [measureHighlight, isCollapsed, collapsedGroups, expandedSubGroups]);

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

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLElement>) => {
    if (e.propertyName === 'width' || e.propertyName === 'transform') {
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
        setExpandedSubGroups((prev) => ({ ...prev, [item.key]: true }));
        navigate(item.href);
        setDrawerOpen(false);
        return;
      }
    } else if (hasChildren) {
      const isCurrentGroup = location.pathname.startsWith(item.href);
      if (isCurrentGroup) {
        e.preventDefault();
        setExpandedSubGroups((prev) => ({ ...prev, [item.key]: !prev[item.key] }));
      } else {
        setExpandedSubGroups((prev) => ({ ...prev, [item.key]: true }));
      }
    }

    setDrawerOpen(false);
    onSelect?.(item.key);
  };

  return (
    <>
      {drawerOpen && (
        <div
          className={styles.drawerBackdrop}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        ref={sidebarRef}
        className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''} ${
          drawerOpen ? styles.drawerOpen : ''
        }`}
        aria-label="Navigation"
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
            data-tooltip={isCollapsed ? 'Clarix (Expand)' : undefined}
            title={isCollapsed ? 'Clarix (Expand)' : undefined}
          >
            <div className={styles.mark} aria-hidden="true">
              <ClarixMark size={20} />
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
            <ChevronLeft width={13} height={13} strokeWidth={2.8} />
          </button>
        </div>

        {/* Grouped navigation list */}
        <div ref={listRef} className={styles.list}>
          {normalizedSections.map((sec, secIdx) => {
            const isGroupCollapsed = Boolean(collapsedGroups[sec.label]);
            return (
              <div key={sec.label || secIdx} className={styles.section}>
                {secIdx > 0 && <div className={styles.divider} aria-hidden="true" />}
                {sec.label && (
                  <button
                    type="button"
                    className={styles.sectionHeader}
                    onClick={() => toggleGroup(sec.label)}
                    aria-expanded={!isGroupCollapsed}
                    aria-label={`${sec.label} section`}
                  >
                    <span className={styles.sectionLabel}>{sec.label}</span>
                    <ChevronDown
                      className={`${styles.sectionChevron} ${
                        isGroupCollapsed ? styles.sectionChevronClosed : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                )}

                <div
                  className={`${styles.sectionBody} ${
                    isGroupCollapsed && !isCollapsed ? styles.sectionBodyClosed : ''
                  }`}
                >
                  {sec.items.map((item) => {
                    const hasChildren = Boolean(item.children && item.children.length > 0);
                    const isSubExpanded = Boolean(expandedSubGroups[item.key]);
                    const isSubActive = hasChildren && location.pathname.startsWith(item.href);

                    const isActive = isCollapsed
                      ? isSubActive || item.key === resolvedActiveKey
                      : item.key === resolvedActiveKey;

                    const isParentActive = hasChildren && !isCollapsed && isSubActive;
                    const Icon = item.icon;

                    return (
                      <div key={item.key} style={{ display: 'contents' }}>
                        <Link
                          to={item.href}
                          ref={(el) => {
                            itemRefs.current[item.key] = el;
                          }}
                          className={`${styles.row} ${isParentActive ? styles.rowParentActive : ''}`}
                          title={item.badge ? `${item.label} (${item.badge.text})` : item.label}
                          data-tooltip={item.badge ? `${item.label} (${item.badge.text})` : item.label}
                          aria-current={isActive && !isParentActive ? 'page' : undefined}
                          aria-expanded={hasChildren ? isSubExpanded : undefined}
                          aria-controls={hasChildren ? `subgroup-${item.key}` : undefined}
                          onClick={(e) => handleItemClick(e, item)}
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
                                isSubExpanded ? styles.parentChevronExpanded : ''
                              }`}
                              aria-hidden="true"
                            />
                          )}
                        </Link>

                        {/* Sub-items accordion if any */}
                        {hasChildren && (
                          <div
                            id={`subgroup-${item.key}`}
                            className={`${styles.subGroupWrapper} ${
                              isSubExpanded ? styles.subGroupWrapperOpen : ''
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
                                    title={child.badge ? `${child.label} (${child.badge.text})` : child.label}
                                    data-tooltip={child.badge ? `${child.label} (${child.badge.text})` : child.label}
                                    aria-current={isChildActive ? 'page' : undefined}
                                    onClick={() => {
                                      setDrawerOpen(false);
                                      onSelect?.(child.key);
                                    }}
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
              </div>
            );
          })}
        </div>

        {/* Pinned Settings item */}
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
                  title={settingsItem.label}
                  data-tooltip={settingsItem.label}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => {
                    setDrawerOpen(false);
                    onSelect?.(settingsItem.key);
                  }}
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
    </>
  );
}
