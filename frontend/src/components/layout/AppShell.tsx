import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ClarixNavigation } from '../navigation/ClarixNavigation';
import { ToastHost, AuthModal, SystemLockedOverlay } from '../common';
import { ConsoleBackdrop } from './ConsoleBackdrop';
import { TopBar } from './TopBar';
import { ALL_NAV } from '../navigation/navItems';
import styles from './Layout.module.css';

export function AppShell() {
  const { pathname } = useLocation();
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    const item = ALL_NAV.find((n) => n.path === pathname);
    document.title = `${item ? item.label : 'Console'} · Clarix AI`;
    window.scrollTo(0, 0);

    const onAuthRequired = () => setAuthOpen(true);
    window.addEventListener('clarix:auth_required', onAuthRequired);
    return () => window.removeEventListener('clarix:auth_required', onAuthRequired);
  }, [pathname]);

  return (
    <>
      <ConsoleBackdrop />
      <ClarixNavigation />
      <TopBar />
      <main className={styles.main}><Outlet /></main>
      <ToastHost />
      <SystemLockedOverlay />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onSuccess={() => window.location.reload()} />
    </>
  );
}
