import React from 'react';
import { Maximize2 } from 'lucide-react';
import { TopologyData, DemoMode } from '../../types/network';
import { DemoSelector } from './DemoSelector';

interface NetworkTopologyMiniCardProps {
  topology: TopologyData;
  demoMode: DemoMode;
  onSelectDemoMode: (mode: DemoMode) => void;
  onAnalyzeWithAI: () => void;
  onExpand: () => void;
  onSelectNode: (nodeId: string) => void;
}

export const NetworkTopologyMiniCard: React.FC<NetworkTopologyMiniCardProps> = ({
  topology,
  demoMode,
  onSelectDemoMode,
  onAnalyzeWithAI,
  onExpand,
  onSelectNode,
}) => {
  return (
    <div className="dashboard-card specular-rim network-topology-card" style={{ padding: '20px' }}>
      {/* Demo Selector Header directly above visualization */}
      <DemoSelector
        currentMode={demoMode}
        onSelectMode={onSelectDemoMode}
        onAnalyzeWithAI={onAnalyzeWithAI}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <h3 className="card-title-text" style={{ fontSize: '0.96rem', marginBottom: 2 }}>
            Network Topology Architecture
          </h3>
          <p style={{ fontSize: '0.76rem', color: '#5A7189', margin: 0 }}>
            {demoMode === 'healthy'
              ? 'Air-Gapped Secure Enclave: All 12 internal devices operational'
              : '4 Injected Anomaly Vectors Detected across Core Routers, Switches, and AI Nodes'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.74rem', fontWeight: 600 }}>
            {demoMode === 'faulty' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F04455' }} />
                  <span style={{ color: '#C22A3A' }}>Link Down</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F4A62A' }} />
                  <span style={{ color: '#B27008' }}>Degraded / VLAN</span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16C784' }} />
                <span style={{ color: '#0E8053' }}>Healthy (100%)</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#176BFF' }} />
              <span style={{ color: '#176BFF' }}>Nominal</span>
            </div>
          </div>

          <button
            onClick={onExpand}
            className="icon-btn-circle"
            title="Expand Full Interactive Topology Canvas"
            style={{ width: 32, height: 32 }}
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Mini Topology Canvas rendering 12 nodes & connections */}
      <div
        onClick={onExpand}
        style={{
          height: '240px',
          width: '100%',
          position: 'relative',
          borderRadius: '16px',
          background: '#F4F9FD',
          border: '1px solid rgba(23, 107, 255, 0.1)',
          boxShadow: 'inset 0 1px 3px rgba(23, 107, 255, 0.04)',
          overflow: 'hidden',
          cursor: 'pointer',
        }}
      >
        <svg
          viewBox="0 0 760 540"
          style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
        >
          <defs>
            <filter id="miniNodeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#176BFF" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Render Connections */}
          {topology.edges.map((edge) => {
            const srcNode = topology.nodes.find((n) => n.id === edge.source);
            const tgtNode = topology.nodes.find((n) => n.id === edge.target);
            if (!srcNode || !tgtNode) return null;

            const isFailed = edge.status === 'failed';
            const isDegraded = edge.status === 'degraded';
            const strokeColor = isFailed ? '#F04455' : isDegraded ? '#F4A62A' : '#176BFF';

            const dx = tgtNode.position.x - srcNode.position.x;
            const cx1 = srcNode.position.x + dx * 0.5;
            const cy1 = srcNode.position.y;
            const cx2 = srcNode.position.x + dx * 0.5;
            const cy2 = tgtNode.position.y;

            return (
              <g key={edge.id}>
                <path
                  d={`M ${srcNode.position.x} ${srcNode.position.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tgtNode.position.x} ${tgtNode.position.y}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isFailed ? 2.5 : 1.8}
                  strokeDasharray={isFailed ? '5 4' : isDegraded ? '4 3' : 'none'}
                  opacity={isFailed ? 0.95 : 0.65}
                />
              </g>
            );
          })}

          {/* Render 12 Nodes */}
          {topology.nodes.map((node) => {
            const isCritical = node.status === 'critical';
            const isWarning = node.status === 'warning';
            const nodeFill = isCritical ? '#F04455' : isWarning ? '#F4A62A' : '#16C784';

            return (
              <g
                key={node.id}
                transform={`translate(${node.position.x}, ${node.position.y})`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode(node.id);
                }}
                style={{ cursor: 'pointer' }}
              >
                {/* Outer ring */}
                {isCritical && (
                  <circle
                    r="15"
                    fill="none"
                    stroke="#F04455"
                    strokeWidth="1.5"
                    opacity="0.8"
                  />
                )}

                {/* Node center bubble */}
                <circle
                  r="10"
                  fill="#FFFFFF"
                  stroke={nodeFill}
                  strokeWidth="2.5"
                  filter="url(#miniNodeGlow)"
                />

                {/* Inner dot */}
                <circle r="3.5" fill={nodeFill} />

                {/* Node label */}
                <text
                  y="22"
                  textAnchor="middle"
                  fill="#14243B"
                  fontSize="10"
                  fontWeight="700"
                  fontFamily="var(--font-sans)"
                >
                  {node.label}
                </text>

                {/* IP address subtitle */}
                <text
                  y="33"
                  textAnchor="middle"
                  fill="#5A7189"
                  fontSize="8.5"
                  fontWeight="600"
                  fontFamily="var(--font-mono)"
                >
                  {node.ip}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating badge */}
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            right: 12,
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(23, 107, 255, 0.15)',
            borderRadius: '9999px',
            padding: '4px 12px',
            fontSize: '0.72rem',
            fontWeight: 700,
            color: '#176BFF',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 2px 8px rgba(23, 107, 255, 0.08)',
          }}
        >
          <span>Click to open full React Flow canvas</span>
        </div>
      </div>
    </div>
  );
};
