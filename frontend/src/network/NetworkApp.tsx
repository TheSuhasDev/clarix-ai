import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Page } from '../components/common';
import { DashboardPage } from './pages/DashboardPage';
import { TopologyPage } from './pages/TopologyPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { DevicesPage } from './pages/DevicesPage';
import { AIInvestigationPage } from './pages/AIInvestigationPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { networkService } from './services/networkService';
import type {
  NavigationPage,
  NetworkStatus,
  TopologyData,
  Device,
  Incident,
  DemoMode,
} from './types/network';

// Import Network styles (scoped to .nx-root at build-time via postcss-prefix-selector)
import './styles/global.css';
import './styles/dashboard.css';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard · Network · Clarix AI',
  topology: 'Network Topology · Network · Clarix AI',
  devices: 'Devices · Network · Clarix AI',
  incidents: 'Incidents · Network · Clarix AI',
  investigation: 'AI Investigation · Network · Clarix AI',
  diagnostics: 'Diagnostics · Network · Clarix AI',
  settings: 'Network Settings · Network · Clarix AI',
};

export const NetworkApp: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Route subsegment parsing: e.g. /network/topology -> 'topology'
  const subSegment = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    // parts[0] is 'network', parts[1] is the sub-page
    return parts[1] || '';
  }, [location.pathname]);

  const currentPage = (subSegment || 'dashboard') as NavigationPage;

  // TWO NETWORK DEMONSTRATION MODES STATE
  const [demoMode, setDemoMode] = useState<DemoMode>('healthy');
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [topology, setTopology] = useState<TopologyData | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [aiInitialQuery, setAiInitialQuery] = useState<string>('Analyze Network');

  const loadData = useCallback(async (mode: DemoMode = demoMode) => {
    setIsRefreshing(true);
    try {
      const [statusRes, topoRes, devRes, incRes] = await Promise.all([
        networkService.getStatus(mode),
        networkService.getTopology(mode),
        networkService.getDevices(undefined, undefined, mode),
        networkService.getIncidents(undefined, undefined, undefined, mode),
      ]);

      setStatus(statusRes.data);
      setTopology(topoRes.data);
      setDevices(devRes.data);
      setIncidents(incRes.data);
    } catch (err) {
      console.warn('NetworkOps service fetch fallback applied:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [demoMode]);

  // Handle switching between Demo 1 and Demo 2
  const handleSelectDemoMode = (mode: DemoMode) => {
    setDemoMode(mode);
    loadData(mode);
  };

  useEffect(() => {
    loadData(demoMode);
  }, [demoMode, loadData]);

  // Set document.title per Network sub-page
  useEffect(() => {
    document.title = PAGE_TITLES[currentPage] || 'Network · Clarix AI';
  }, [currentPage]);

  const handleNavigate = (page: NavigationPage) => {
    navigate('/network/' + page);
  };

  const handleNavigateToAI = (query: string) => {
    setAiInitialQuery(query);
    navigate('/network/investigation');
  };

  // If path is exactly /network or /network/, redirect to /network/dashboard
  if (!subSegment) {
    return <Navigate to="/network/dashboard" replace />;
  }

  return (
    <Page>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <span
          style={{
            fontSize: '0.70rem',
            fontWeight: 800,
            padding: '3px 12px',
            borderRadius: '9999px',
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#d97706',
            border: '1px solid rgba(245, 158, 11, 0.45)',
            letterSpacing: '0.04em',
            fontFamily: 'var(--font-mono)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />
          SIMULATED NETWORK LAB
        </span>
      </div>
      <div className="nx-root">
        {status && topology ? (
          <>
            {currentPage === 'dashboard' && (
              <DashboardPage
                status={status}
                topology={topology}
                incidents={incidents}
                demoMode={demoMode}
                onSelectDemoMode={handleSelectDemoMode}
                onRefresh={() => loadData(demoMode)}
                isRefreshing={isRefreshing}
                onNavigate={handleNavigate}
                onNavigateToAI={handleNavigateToAI}
              />
            )}

            {currentPage === 'topology' && (
              <TopologyPage
                topology={topology}
                devices={devices}
                status={status}
                demoMode={demoMode}
                onSelectDemoMode={handleSelectDemoMode}
                onNavigateToAI={handleNavigateToAI}
              />
            )}

            {currentPage === 'incidents' && (
              <IncidentsPage
                incidents={incidents}
                onNavigateToAI={handleNavigateToAI}
              />
            )}

            {currentPage === 'devices' && (
              <DevicesPage
                devices={devices}
                onNavigateToAI={handleNavigateToAI}
              />
            )}

            {currentPage === 'investigation' && (
              <AIInvestigationPage
                initialQuery={aiInitialQuery}
                demoMode={demoMode}
                onSelectDemoMode={handleSelectDemoMode}
              />
            )}

            {currentPage === 'diagnostics' && <DiagnosticsPage />}

            {currentPage === 'settings' && <SettingsPage />}
          </>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '400px',
              color: '#00f2fe',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: '3px solid rgba(0, 242, 254, 0.2)',
                borderTopColor: '#00f2fe',
                animation: 'nx-spin 1s linear infinite',
              }}
            />
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '14px' }}>
              Loading Clarix NetworkOps Demo Scenarios...
            </span>
          </div>
        )}
      </div>
    </Page>
  );
};

export default NetworkApp;
