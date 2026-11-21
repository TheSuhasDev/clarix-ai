import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../navigation/Sidebar';
import { ToastHost, AuthModal, SystemLockedOverlay } from '../common';
import { ConsoleBackdrop } from './ConsoleBackdrop';
import { TopBar } from './TopBar';
import { ALL_NAV, SIDEBAR_SETTINGS_ITEM, useSidebarSections } from '../navigation/navItems';
import { useConsole } from '../../state/ConsoleContext';
import styles from './Layout.module.css';

export function AppShell() {
  const { pathname } = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const { sidebarCollapsed, setSidebarCollapsed } = useConsole();
  const sections = useSidebarSections();

  useEffect(() => {
    if (!pathname.startsWith('/network')) {
      const item = ALL_NAV.find((n) => n.path === pathname);
      document.title = `${item ? item.label : 'Console'} · Clarix AI`;
    }
    window.scrollTo(0, 0);

    const onAuthRequired = () => setAuthOpen(true);
    window.addEventListener('clarix:auth_required', onAuthRequired);
    return () => window.removeEventListener('clarix:auth_required', onAuthRequired);
  }, [pathname]);

  return (
    <div className={`${styles.shell} ${sidebarCollapsed ? styles.shellCollapsed : ''}`}>
      <ConsoleBackdrop />
      <Sidebar
        sections={sections}
        settingsItem={SIDEBAR_SETTINGS_ITEM}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <TopBar />
      <main className={styles.main}>
        <Outlet />
      </main>
      <ToastHost />
      <SystemLockedOverlay />
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => window.location.reload()}
      />
    </div>
  );
}
