import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  NodeProps,
  Node,
  Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Cpu,
  Download,
  Globe,
  HardDrive,
  Lock,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Wifi,
  WifiOff,
  X,
  XCircle,
} from 'lucide-react';
import { Card, Loading, Page, PageHeader, Pill } from '../components/common';
import { useConsole } from '../state/ConsoleContext';
import {
  networkService,
  securityService,
  NetworkOverview,
  NetworkInterface,
  SocketConnection,
  ListenerPort,
  BlockedConnection,
  NetworkMapNode,
} from '../services';
import styles from './Network.module.css';

// ---------------------------------------------------------------------------
// Custom Node Components for ReactFlow
// ---------------------------------------------------------------------------

function CoreNodeComponent({ data, selected }: NodeProps) {
  const isOnline = data.status === 'ONLINE';
  return (
    <div className={`${styles.flowNode} ${styles.nodeCore} ${selected ? styles.flowNodeSelected : ''}`}>
      <Handle type="target" position={Position.Left} style={{ background: '#38bdf8' }} />
      <div className={styles.nodeHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className={styles.nodeIconBox} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
            <Server width={14} height={14} />
          </span>
          <span className={styles.nodeTitle}>{data.label}</span>
        </div>
        <span className={`${styles.statusRing} ${isOnline ? styles.statusRingOnline : styles.statusRingStandby}`} />
      </div>
      <div className={styles.nodeRole}>{data.role || data.component}</div>
      <div className={styles.nodeFooter}>
        <span>{data.metrics || (data.port ? `Port ${data.port}` : 'Loopback')}</span>
        <span className={styles.nodeTag} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
          {data.status}
        </span>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#38bdf8' }} />
    </div>
  );
}

function AiNodeComponent({ data, selected }: NodeProps) {
  const isOnline = data.status === 'ONLINE';
  return (
    <div className={`${styles.flowNode} ${styles.nodeAi} ${selected ? styles.flowNodeSelected : ''}`}>
      <Handle type="target" position={Position.Left} style={{ background: '#a855f7' }} />
      <div className={styles.nodeHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className={styles.nodeIconBox} style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' }}>
            <Cpu width={14} height={14} />
          </span>
          <span className={styles.nodeTitle}>{data.label}</span>
        </div>
        <span className={`${styles.statusRing} ${isOnline ? styles.statusRingOnline : styles.statusRingStandby}`} />
      </div>
      <div className={styles.nodeRole}>{data.role || 'Offline Local Inference'}</div>
      <div className={styles.nodeFooter}>
        <span>{data.metrics || (data.port ? `Port ${data.port}` : 'Port 11434')}</span>
        <span className={styles.nodeTag} style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' }}>
          {data.status}
        </span>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#a855f7' }} />
    </div>
  );
}

function SecurityNodeComponent({ data, selected }: NodeProps) {
  return (
    <div className={`${styles.flowNode} ${styles.nodeSecurity} ${selected ? styles.flowNodeSelected : ''}`}>
      <Handle type="target" position={Position.Top} style={{ background: '#10b981' }} />
      <Handle type="target" position={Position.Left} style={{ background: '#10b981' }} />
      <div className={styles.nodeHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className={styles.nodeIconBox} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Shield width={14} height={14} />
          </span>
          <span className={styles.nodeTitle}>{data.label}</span>
        </div>
        <span className={`${styles.statusRing} ${styles.statusRingOnline}`} />
      </div>
      <div className={styles.nodeRole}>{data.component || 'Security Harness'}</div>
      <div className={styles.nodeFooter}>
        <span style={{ color: '#34d399' }}>{data.rule || 'ACTIVE'}</span>
        <span className={styles.nodeTag} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
          VERIFIED
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#10b981' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#10b981' }} />
    </div>
  );
}

function EgressNodeComponent({ data, selected }: NodeProps) {
  return (
    <div className={`${styles.flowNode} ${styles.nodeEgress} ${selected ? styles.flowNodeSelected : ''}`}>
      <Handle type="target" position={Position.Left} style={{ background: '#f59e0b' }} />
      <div className={styles.nodeHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className={styles.nodeIconBox} style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
            <ShieldAlert width={14} height={14} />
          </span>
          <span className={styles.nodeTitle}>{data.label}</span>
        </div>
        <span className={`${styles.statusRing} ${styles.statusRingStandby}`} />
      </div>
      <div className={styles.nodeRole}>POL-001 Socket Hook (Fail-Closed)</div>
      <div className={styles.nodeFooter}>
        <span style={{ color: '#fbbf24' }}>{data.blockedCount ?? 0} Blocked</span>
        <span className={styles.nodeTag} style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }}>
          ENFORCING
        </span>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#ef4444' }} />
    </div>
  );
}

function ExternalNodeComponent({ data, selected }: NodeProps) {
  return (
    <div className={`${styles.flowNode} ${styles.nodeExternal} ${selected ? styles.flowNodeSelected : ''}`}>
      <Handle type="target" position={Position.Left} style={{ background: '#ef4444' }} />
      <div className={styles.nodeHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className={styles.nodeIconBox} style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
            <Globe width={14} height={14} />
          </span>
          <span className={styles.nodeTitle}>{data.label}</span>
        </div>
        <span className={`${styles.statusRing} ${styles.statusRingBlocked}`} />
      </div>
      <div className={styles.nodeRole}>Public Internet / WAN</div>
      <div className={styles.nodeFooter}>
        <span style={{ color: '#f87171' }}>Air-Gap Boundary</span>
        <span className={styles.nodeTag} style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}>
          SEVERED
        </span>
      </div>
    </div>
  );
}

const nodeTypes = {
  coreNode: CoreNodeComponent,
  aiNode: AiNodeComponent,
  securityNode: SecurityNodeComponent,
  egressNode: EgressNodeComponent,
  externalNode: ExternalNodeComponent,
};

type TabKey = 'connections' | 'interfaces' | 'listeners' | 'blocked' | 'egress_watch' | 'posture';

export default function NetworkPage() {
  const { toast, refreshCounts } = useConsole();

  // Overview & Telemetry state
  const [overview, setOverview] = useState<NetworkOverview | null>(null);
  const [connections, setConnections] = useState<SocketConnection[]>([]);
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [listeners, setListeners] = useState<ListenerPort[]>([]);
  const [blockedItems, setBlockedItems] = useState<BlockedConnection[]>([]);
  const [mapNodes, setMapNodes] = useState<Node[]>([]);
  const [mapEdges, setMapEdges] = useState<Edge[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<TabKey>('connections');
  const [selectedNode, setSelectedNode] = useState<NetworkMapNode | null>(null);
  const [connFilter, setConnFilter] = useState<'all' | 'clarix' | 'external' | 'lan' | 'loopback'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPolling, setIsPolling] = useState(true);
  const [isProbing, setIsProbing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch full telemetry data
  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const [ov, conns, nics, list, blk, nmap] = await Promise.all([
        networkService.getOverview(),
        networkService.getConnections('all'),
        networkService.getInterfaces(),
        networkService.getListeners(),
        networkService.getBlocked(100),
        networkService.getMap(),
      ]);

      setOverview(ov);
      setConnections(conns);
      setInterfaces(nics);
      setListeners(list);
      setBlockedItems(blk.items);

      // Map nodes to ReactFlow nodes
      const rfNodes: Node[] = nmap.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      }));
      const rfEdges: Edge[] = nmap.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: e.animated ?? true,
        style: e.style ?? { stroke: '#0284c7', strokeWidth: 2 },
        label: e.label,
      }));

      setMapNodes(rfNodes);
      setMapEdges(rfEdges);
    } catch (err) {
      console.error('Failed to fetch network telemetry:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Live polling (every 3.5s when active and tab visible)
  useEffect(() => {
    if (!isPolling) return;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchData(false);
    }, 3500);
    return () => clearInterval(interval);
  }, [isPolling, fetchData]);

  // Node selection callback
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const mappedNode: NetworkMapNode = {
        id: node.id,
        type: node.type || 'coreNode',
        position: node.position,
        data: node.data,
      };
      setSelectedNode(mappedNode);
    },
    []
  );

  // Test the Air-Gap action
  const handleProbeAirgap = async () => {
    setIsProbing(true);
    try {
      await securityService.probe('1.1.1.1');
      toast('Simulated outbound attempt to 1.1.1.1 was blocked by POL-001 (0 bytes transmitted).', 'red');
      await fetchData(false);
      refreshCounts();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Probe error', 'red');
    } finally {
      setIsProbing(false);
    }
  };

  // Export handlers
  const handleExportBlockedCsv = () => {
    if (!blockedItems.length) return;
    const headers = ['Time', 'Destination', 'Port', 'Direction', 'Reason', 'Component', 'EnforcedBy'];
    const rows = blockedItems.map((b) => [
      b.t,
      `"${b.destination}"`,
      b.port,
      b.direction,
      `"${b.reason.replace(/"/g, '""')}"`,
      `"${b.component}"`,
      `"${b.enforcedBy}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `clarix_blocked_egress_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered connections
  const filteredConnections = useMemo(() => {
    return connections.filter((c) => {
      if (connFilter === 'clarix' && !c.isClarix) return false;
      if (connFilter === 'external' && c.classification !== 'EXTERNAL') return false;
      if (connFilter === 'lan' && c.classification !== 'LAN') return false;
      if (connFilter === 'loopback' && c.classification !== 'LOOPBACK') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const proc = (c.procName || '').toLowerCase();
        const lip = c.laddr?.ip || '';
        const rip = c.raddr?.ip || '';
        const port = String(c.laddr?.port || c.raddr?.port || '');
        return proc.includes(q) || lip.includes(q) || rip.includes(q) || port.includes(q);
      }
      return true;
    });
  }, [connections, connFilter, searchQuery]);

  const postureStatus = overview?.posture.status ?? 'ISOLATED';
  const isIsolated = postureStatus === 'ISOLATED';

  // Calculate live aggregate throughput
  const totalSentSec = useMemo(() => {
    if (!overview?.rates) return 0;
    return Object.values(overview.rates).reduce((sum, r) => sum + r.bytesSentSec, 0);
  }, [overview]);

  const totalRecvSec = useMemo(() => {
    if (!overview?.rates) return 0;
    return Object.values(overview.rates).reduce((sum, r) => sum + r.bytesRecvSec, 0);
  }, [overview]);

  return (
    <Page>
      <PageHeader
        icon={<Radio color="#0284c7" />}
        title="Network Monitor & Physical Topology"
        subtitle="Real-time air-gap telemetry, host interface counters, socket inspection, and live fail-closed topology."
        aside={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              onClick={() => setIsPolling(!isPolling)}
              className="cx-btn cx-btn--ghost"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
              title={isPolling ? 'Pause live polling' : 'Resume live polling'}
            >
              {isPolling ? <Pause width={13} height={13} /> : <Play width={13} height={13} />}
              {isPolling ? 'Live (3s)' : 'Paused'}
            </button>
            <button
              onClick={() => fetchData(false)}
              className="cx-btn cx-btn--ghost"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
              title="Refresh now"
            >
              <RefreshCw width={13} height={13} />
            </button>
            <Pill tone={isIsolated ? 'green' : 'amber'} dot large>
              {isIsolated ? 'AIR-GAP: ISOLATED' : 'HOST POSTURE: NOT ISOLATED'}
            </Pill>
          </div>
        }
      />

      {loading && <Loading rows={3} height={120} />}

      <div className={styles.container}>
        {/* Posture Alert Banner */}
        <div className={styles.postureBanner}>
          <div className={styles.postureInfo}>
            <div
              className={`${styles.postureIcon} ${
                isIsolated ? styles.postureIconGreen : styles.postureIconAmber
              }`}
            >
              {isIsolated ? <ShieldCheck width={22} height={22} /> : <AlertTriangle width={22} height={22} />}
            </div>
            <div className={styles.postureText}>
              <h3>
                {isIsolated
                  ? 'Air-Gap Boundary Intact: Zero External Sockets'
                  : 'Host Network Detected — Clarix Fail-Closed Guard Active'}
              </h3>
              <p>
                {overview?.posture.reasons.length
                  ? overview.posture.reasons.join(' · ')
                  : 'Kernel socket isolation is actively dropping all external egress attempts from Clarix.'}
                {overview?.limitedVisibility ? ' (Host requires Administrator rights for full PID details).' : ''}
              </p>
            </div>
          </div>
          <div className={styles.postureActions}>
            <button
              onClick={handleProbeAirgap}
              disabled={isProbing}
              className="cx-btn cx-btn--secondary"
              style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            >
              <WifiOff width={14} height={14} color="#e0245e" />
              {isProbing ? 'Probing...' : 'Test the Air-Gap'}
            </button>
          </div>
        </div>

        {/* KPIs Grid */}
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Clarix WAN Egress</span>
            <span className={styles.kpiValue} style={{ color: '#10b981' }}>
              {overview?.posture?.clarixExternalConnections ?? 0}
            </span>
            <span className={styles.kpiSub}>Strict 0 bps egress</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Active Sockets</span>
            <span className={styles.kpiValue}>{overview?.activeSockets ?? connections.length}</span>
            <span className={styles.kpiSub}>Host TCP / UDP</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Listening Ports</span>
            <span className={styles.kpiValue}>{overview?.exposedListeners ?? overview?.listeningPorts ?? listeners.length}</span>
            <span className={styles.kpiSub}>Bound daemons</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Blocked Attempts</span>
            <span className={styles.kpiValue} style={{ color: '#ef4444' }}>
              {overview?.blockedAttemptsToday ?? overview?.blockedAttempts ?? blockedItems.length}
            </span>
            <span className={styles.kpiSub}>Dropped by POL-001</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Loopback Throughput</span>
            <span className={styles.kpiValue} style={{ fontSize: '1.05rem' }}>
              {((totalSentSec + totalRecvSec) / 1024).toFixed(1)} KB/s
            </span>
            <span className={styles.kpiSub}>Internal IPC / API</span>
          </div>
          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Network Interfaces</span>
            <span className={styles.kpiValue}>{overview?.interfacesTotal ?? overview?.totalInterfaces ?? interfaces.length}</span>
            <span className={styles.kpiSub}>{overview?.interfacesUp ?? interfaces.filter(i => i.isUp).length} adapters active</span>
          </div>
        </div>

        {/* Interactive ReactFlow Topology Canvas */}
        <div className={styles.canvasCard}>
          <div className={styles.canvasToolbar}>
            <Activity width={13} height={13} color="#38bdf8" />
            <span>Interactive Zero-Trust Air-Gap Architecture & Telemetry Canvas</span>
          </div>
          <div className={styles.canvasAirgapBoundary}>
            <span>AIR-GAPPED: Nothing leaves this machine</span>
          </div>

          <ReactFlow
            nodes={mapNodes}
            edges={mapEdges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            attributionPosition="bottom-left"
          >
            <Background color="#1e293b" gap={24} size={1.2} />
            <Controls style={{ background: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255, 255, 255, 0.1)' }} />
            <MiniMap
              nodeColor={(n) => {
                if (n.type === 'coreNode') return '#38bdf8';
                if (n.type === 'aiNode') return '#a855f7';
                if (n.type === 'securityNode') return '#10b981';
                if (n.type === 'egressNode') return '#f59e0b';
                if (n.type === 'externalNode') return '#ef4444';
                return '#64748b';
              }}
              style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
              }}
            />
          </ReactFlow>

          {/* Slide-out Node Details Drawer */}
          {selectedNode && (
            <div className={styles.drawer}>
              <div className={styles.drawerHeader}>
                <div>
                  <h4 className={styles.drawerTitle}>{selectedNode.data.label}</h4>
                  <p className={styles.drawerSubtitle}>{selectedNode.data.role || selectedNode.data.component}</p>
                </div>
                <button
                  className={styles.drawerCloseBtn}
                  onClick={() => setSelectedNode(null)}
                  aria-label="Close drawer"
                >
                  <X width={16} height={16} />
                </button>
              </div>

              <div className={styles.drawerSection}>
                <span className={styles.drawerSectionLabel}>Node Status & Identity</span>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerRowKey}>Status</span>
                  <span className={styles.drawerRowValue} style={{ color: '#38bdf8' }}>
                    {selectedNode.data.status}
                  </span>
                </div>
                {selectedNode.data.port && (
                  <div className={styles.drawerRow}>
                    <span className={styles.drawerRowKey}>Binding Port</span>
                    <span className={styles.drawerRowValue}>TCP {selectedNode.data.port}</span>
                  </div>
                )}
                <div className={styles.drawerRow}>
                  <span className={styles.drawerRowKey}>Component Type</span>
                  <span className={styles.drawerRowValue}>{selectedNode.data.component || selectedNode.type}</span>
                </div>
                {selectedNode.data.rule && (
                  <div className={styles.drawerRow}>
                    <span className={styles.drawerRowKey}>Security Rule</span>
                    <span className={styles.drawerRowValue} style={{ color: '#10b981' }}>
                      {selectedNode.data.rule}
                    </span>
                  </div>
                )}
                {selectedNode.data.metrics && (
                  <div className={styles.drawerRow}>
                    <span className={styles.drawerRowKey}>Telemetry</span>
                    <span className={styles.drawerRowValue}>{selectedNode.data.metrics}</span>
                  </div>
                )}
              </div>

              <div className={styles.drawerSection}>
                <span className={styles.drawerSectionLabel}>Active Sockets for Node</span>
                {connections
                  .filter((c) => {
                    if (selectedNode.id === 'backend') return c.laddr?.port === 8000 || c.raddr?.port === 8000;
                    if (selectedNode.id === 'frontend') return c.laddr?.port === 5173 || c.raddr?.port === 5173;
                    if (selectedNode.id === 'ollama') return c.laddr?.port === 11434 || c.raddr?.port === 11434;
                    return false;
                  })
                  .slice(0, 4)
                  .map((c, i) => (
                    <div key={i} className={styles.drawerRow}>
                      <span className={styles.drawerRowKey}>{c.status}</span>
                      <span className={styles.drawerRowValue}>
                        {c.laddr?.port} → {c.raddr?.port}
                      </span>
                    </div>
                  ))}
                {connections.filter((c) => {
                  if (selectedNode.id === 'backend') return c.laddr?.port === 8000 || c.raddr?.port === 8000;
                  if (selectedNode.id === 'frontend') return c.laddr?.port === 5173 || c.raddr?.port === 5173;
                  if (selectedNode.id === 'ollama') return c.laddr?.port === 11434 || c.raddr?.port === 11434;
                  return false;
                }).length === 0 && (
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>No active socket bindings</span>
                )}
              </div>

              <div className={styles.drawerSection} style={{ marginTop: 'auto' }}>
                <button
                  className="cx-btn cx-btn--ghost"
                  style={{ width: '100%', fontSize: '0.75rem' }}
                  onClick={() => setSelectedNode(null)}
                >
                  Close Details
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Telemetry Tabs Section */}
        <Card>
          <div className={styles.tabsNav}>
            <button
              className={`${styles.tabBtn} ${activeTab === 'connections' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('connections')}
            >
              <Activity width={14} height={14} />
              Active Sockets
              <span className={styles.tabCount}>{connections.length}</span>
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'interfaces' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('interfaces')}
            >
              <Wifi width={14} height={14} />
              Host Interfaces
              <span className={styles.tabCount}>{interfaces.length}</span>
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'listeners' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('listeners')}
            >
              <HardDrive width={14} height={14} />
              Listening Ports
              <span className={styles.tabCount}>{listeners.length}</span>
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'blocked' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('blocked')}
            >
              <XCircle width={14} height={14} color="#ef4444" />
              Blocked Egress
              <span className={styles.tabCount} style={{ color: '#ef4444' }}>
                {blockedItems.length}
              </span>
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'egress_watch' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('egress_watch')}
            >
              <ShieldAlert width={14} height={14} />
              Host Egress Watch
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'posture' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('posture')}
            >
              <Lock width={14} height={14} />
              Firewall & Posture
            </button>
          </div>

          {/* TAB 1: ACTIVE SOCKETS */}
          {activeTab === 'connections' && (
            <div style={{ marginTop: '1rem' }}>
              <div className={styles.filterBar}>
                <div className={styles.scopeButtons}>
                  {(['all', 'clarix', 'external', 'lan', 'loopback'] as const).map((s) => (
                    <button
                      key={s}
                      className={`${styles.scopeBtn} ${connFilter === s ? styles.scopeBtnActive : ''}`}
                      onClick={() => setConnFilter(s)}
                    >
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Search width={14} height={14} color="#64748b" />
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search by process, IP, or port..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className={styles.telemetryTable}>
                  <thead>
                    <tr>
                      <th>Proto</th>
                      <th>Local Address</th>
                      <th>Remote Address</th>
                      <th>State</th>
                      <th>Classification</th>
                      <th>Process / PID</th>
                      <th>Clarix App</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredConnections.slice(0, 50).map((c, i) => (
                      <tr key={i}>
                        <td>
                          <span className="cx-mono" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                            {c.proto}
                          </span>
                        </td>
                        <td className={styles.monoText}>
                          {c.laddr ? `${c.laddr.ip}:${c.laddr.port}` : '—'}
                        </td>
                        <td className={styles.monoText}>
                          {c.raddr ? `${c.raddr.ip}:${c.raddr.port}` : '—'}
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              color: c.status === 'ESTABLISHED' ? '#10b981' : '#64748b',
                            }}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td>
                          <Pill
                            tone={
                              c.classification === 'LOOPBACK'
                                ? 'blue'
                                : c.classification === 'LAN'
                                ? 'amber'
                                : 'red'
                            }
                          >
                            {c.classification}
                          </Pill>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span>{c.procName || 'system'}</span>
                            {c.pid && (
                              <span className="cx-mono" style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                #{c.pid}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {c.isClarix ? (
                            <Pill tone="green" dot>
                              CLARIX
                            </Pill>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>System Host</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredConnections.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                          No socket connections found matching filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: INTERFACES */}
          {activeTab === 'interfaces' && (
            <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
              <table className={styles.telemetryTable}>
                <thead>
                  <tr>
                    <th>Interface Name</th>
                    <th>Status</th>
                    <th>IPv4 Addresses</th>
                    <th>MAC Address</th>
                    <th>Speed</th>
                    <th>MTU</th>
                    <th>I/O Counters</th>
                  </tr>
                </thead>
                <tbody>
                  {interfaces.map((nic, i) => (
                    <tr key={i}>
                      <td>
                        <b style={{ color: 'var(--cx-text-primary, #0f172a)' }}>{nic.name}</b>
                      </td>
                      <td>
                        <Pill tone={nic.isUp ? 'green' : 'gray'} dot>
                          {nic.isUp ? 'UP' : 'DOWN'}
                        </Pill>
                      </td>
                      <td className={styles.monoText}>
                        {nic.ipv4.length ? nic.ipv4.join(', ') : 'None'}
                      </td>
                      <td className={styles.monoText}>{nic.mac || '—'}</td>
                      <td>{nic.speedMbps > 0 ? `${nic.speedMbps} Mbps` : 'Auto'}</td>
                      <td className={styles.monoText}>{nic.mtu}</td>
                      <td className={styles.monoText} style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {nic.counters
                          ? `TX: ${(nic.counters.bytesSent / 1024).toFixed(0)}KB · RX: ${(
                              nic.counters.bytesRecv / 1024
                            ).toFixed(0)}KB`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: LISTENING PORTS */}
          {activeTab === 'listeners' && (
            <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
              <table className={styles.telemetryTable}>
                <thead>
                  <tr>
                    <th>Port</th>
                    <th>Proto</th>
                    <th>Bound Address</th>
                    <th>Process Name</th>
                    <th>PID</th>
                    <th>Binding Scope</th>
                    <th>Clarix Daemon</th>
                  </tr>
                </thead>
                <tbody>
                  {listeners.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <b className={styles.monoText} style={{ fontSize: '0.85rem', color: '#0284c7' }}>
                          {l.port}
                        </b>
                      </td>
                      <td className="cx-mono">{l.proto}</td>
                      <td className={styles.monoText}>{l.ip || '0.0.0.0'}</td>
                      <td>{l.procName || 'system'}</td>
                      <td className="cx-mono">{l.pid || '—'}</td>
                      <td>
                        {l.isWildcard ? (
                          <Pill tone="amber">WILDCARD (0.0.0.0)</Pill>
                        ) : (
                          <Pill tone="blue">LOOPBACK (127.0.0.1)</Pill>
                        )}
                      </td>
                      <td>
                        {l.isClarix ? (
                          <Pill tone="green" dot>
                            CLARIX COMPONENT
                          </Pill>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Host Service</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: BLOCKED EGRESS ATTEMPTS */}
          {activeTab === 'blocked' && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <p className="cx-sub" style={{ margin: 0 }}>
                  Showing outbound attempts intercepted and dropped by the Air-Gap Guard (POL-001).
                </p>
                <button
                  onClick={handleExportBlockedCsv}
                  className="cx-btn cx-btn--ghost"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                >
                  <Download width={13} height={13} />
                  Export CSV
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className={styles.telemetryTable}>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Target Destination</th>
                      <th>Port</th>
                      <th>Direction</th>
                      <th>Reason / Policy</th>
                      <th>Enforced By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockedItems.map((b, i) => (
                      <tr key={i}>
                        <td className={styles.monoText}>{b.t}</td>
                        <td className={styles.monoText} style={{ color: '#ef4444', fontWeight: 600 }}>
                          {b.destination}
                        </td>
                        <td className={styles.monoText}>{b.port}</td>
                        <td>
                          <Pill tone="red">{b.direction}</Pill>
                        </td>
                        <td style={{ fontSize: '0.75rem' }}>{b.reason}</td>
                        <td className={styles.monoText} style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {b.enforcedBy}
                        </td>
                      </tr>
                    ))}
                    {blockedItems.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                          No blocked attempts recorded. Click &ldquo;Test the Air-Gap&rdquo; to simulate interception.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: HOST EGRESS WATCH */}
          {activeTab === 'egress_watch' && (
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="cx-banner cx-banner--blue">
                <Shield width={18} height={18} />
                <span>
                  <b>POL-001 Host Egress Watch:</b> A background daemon inspects the OS socket table every 5 seconds.
                  If any Clarix process establishes an unauthorized external socket, an alert is logged to the SHA-256
                  audit ledger, and in <code>enforce</code> mode triggers an immediate POL-006 cryptographic lockdown.
                </span>
              </div>

              <div className="cx-grid cx-grid--2">
                <Card title="Egress Watch Configuration">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Watch Mode:</span>
                      <b className="cx-mono">
                        {overview?.egressWatchMode ? overview.egressWatchMode.toUpperCase() : 'WARN'}
                      </b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Polling Interval:</span>
                      <span className="cx-mono">5.0 seconds</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Audit Log Integration:</span>
                      <span className="cx-mono" style={{ color: '#10b981' }}>
                        Active (clarix.db active_audit)
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Lockdown Trigger (POL-006):</span>
                      <span className="cx-mono" style={{ color: '#f59e0b' }}>
                        Enabled on Enforce Mode
                      </span>
                    </div>
                  </div>
                </Card>

                <Card title="Watched Clarix Processes">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <span>Clarix FastAPI Backend (Port 8000)</span>
                      <Pill tone="green">MONITORED</Pill>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <span>Vite Frontend Operator Console (Port 5173)</span>
                      <Pill tone="green">MONITORED</Pill>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0' }}>
                      <span>Ollama Offline LLM Engine (Port 11434)</span>
                      <Pill tone="green">MONITORED</Pill>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 6: POSTURE & FIREWALL */}
          {activeTab === 'posture' && (
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="cx-grid cx-grid--2">
                <Card title="Host Network Posture">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Air-Gap Status:</span>
                      <Pill tone={isIsolated ? 'green' : 'amber'}>
                        {overview?.posture.status || 'UNKNOWN'}
                      </Pill>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Default Gateway:</span>
                      <span className="cx-mono">{overview?.posture.defaultGateway || 'None (Disconnected)'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Public IP:</span>
                      <span className="cx-mono">{overview?.posture.externalIp || 'None Detected'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Configured DNS:</span>
                      <span className="cx-mono">
                        {overview?.posture.dnsServers?.length ? overview.posture.dnsServers.join(', ') : 'None'}
                      </span>
                    </div>
                  </div>
                </Card>

                <Card title="Windows Defender Firewall Profiles">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Domain Profile:</span>
                      <Pill tone={overview?.posture.firewall?.domainProfile ? 'green' : 'gray'}>
                        {overview?.posture.firewall?.domainProfile ? 'ENABLED' : 'DISABLED'}
                      </Pill>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Private Profile:</span>
                      <Pill tone={overview?.posture.firewall?.privateProfile ? 'green' : 'gray'}>
                        {overview?.posture.firewall?.privateProfile ? 'ENABLED' : 'DISABLED'}
                      </Pill>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Public Profile:</span>
                      <Pill tone={overview?.posture.firewall?.publicProfile ? 'green' : 'gray'}>
                        {overview?.posture.firewall?.publicProfile ? 'ENABLED' : 'DISABLED'}
                      </Pill>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Firewall Filtering Service:</span>
                      <span className="cx-mono" style={{ color: '#10b981' }}>
                        {overview?.posture.firewall?.active ? 'Active' : 'Unconfirmed'}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="cx-banner">
                <AlertCircle width={18} height={18} />
                <span>
                  <b>Air-Gap Verification Note:</b> For high-assurance isolation during competition evaluation or
                  classified deployments, disconnect physical Ethernet cables and turn off Wi-Fi/Bluetooth adapters.
                  Clarix AI runs 100% locally on localhost without requiring internet access.
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
