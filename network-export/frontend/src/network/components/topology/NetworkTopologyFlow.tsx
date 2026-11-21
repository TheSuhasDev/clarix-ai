import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  MarkerType,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { DeviceNode } from './DeviceNode';
import { DeviceDetailsDrawer } from './DeviceDetailsDrawer';
import { TopologyData, Device } from '../../types/network';
import { ShieldCheck, Lock } from 'lucide-react';

interface NetworkTopologyFlowProps {
  topology: TopologyData;
  devices: Device[];
  onDiagnoseDevice: (device: Device) => void;
  onTestPingDevice: (device: Device) => void;
}

const nodeTypes = {
  deviceNode: DeviceNode,
};

export const NetworkTopologyFlow: React.FC<NetworkTopologyFlowProps> = ({
  topology,
  devices,
  onDiagnoseDevice,
  onTestPingDevice,
}) => {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Convert TopologyData into ReactFlow Nodes
  const formattedNodes: Node[] = useMemo(() => {
    return topology.nodes.map((node) => {
      const dev = devices.find(
        (d) => d.id.toLowerCase() === node.id.toLowerCase() || d.hostname.toLowerCase() === node.id.toLowerCase()
      );

      return {
        id: node.id,
        type: 'deviceNode',
        position: node.position,
        data: {
          label: node.label,
          type: node.type,
          ip: node.ip,
          status: dev ? dev.status : node.status,
          model: dev?.model,
          alerts: dev?.active_alerts,
        },
      };
    });
  }, [topology, devices]);

  // Convert TopologyData into ReactFlow Edges
  const formattedEdges: Edge[] = useMemo(() => {
    return topology.edges.map((edge) => {
      const isFailed = edge.status === 'failed';
      const isDegraded = edge.status === 'degraded';
      const strokeColor = isFailed ? '#F04455' : isDegraded ? '#F4A62A' : '#176BFF';

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        animated: !isFailed, // Animated data flow on active links
        style: {
          stroke: strokeColor,
          strokeWidth: isFailed ? 2.8 : 2.2,
          strokeDasharray: isFailed ? '6 6' : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: 14,
          height: 14,
        },
        label: isFailed ? 'LINK DOWN' : isDegraded ? 'VLAN MISMATCH' : undefined,
        labelStyle: {
          fill: isFailed ? '#C22A3A' : '#B27008',
          fontWeight: 800,
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
        },
        labelBgStyle: {
          fill: '#FFFFFF',
          fillOpacity: 0.95,
          rx: 4,
          ry: 4,
        },
      };
    });
  }, [topology]);

  const [nodes, setNodes, onNodesChange] = useNodesState(formattedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(formattedEdges);

  // Synchronize internal ReactFlow state when parent switches demo modes
  useEffect(() => {
    setNodes(formattedNodes);
    setEdges(formattedEdges);
  }, [formattedNodes, formattedEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const dev = devices.find(
        (d) => d.id.toLowerCase() === node.id.toLowerCase() || d.hostname.toLowerCase() === node.id.toLowerCase()
      );
      if (dev) {
        setSelectedDevice(dev);
      } else {
        setSelectedDevice({
          id: node.id,
          hostname: node.data.label,
          type: node.data.type,
          ip_address: node.data.ip,
          status: node.data.status,
          model: 'Cisco Emulated Appliance',
          location: 'Network Segment Core',
          uptime: '30d 12h',
          os_version: 'Cisco IOS XE',
          active_alerts: node.data.status === 'critical' ? 1 : 0,
          cpu_usage: 45,
          memory_usage: 40,
          interfaces: [],
        });
      }
    },
    [devices]
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '620px', display: 'flex' }}>
      <div className="react-flow-container specular-rim" style={{ flex: 1, height: '100%' }}>
        {/* Top-Right Air-Gapped Security Perimeter Banner */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(23, 107, 255, 0.15)',
            boxShadow: '0 4px 16px rgba(23, 107, 255, 0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.74rem',
              fontWeight: 800,
              color: '#14243B',
              letterSpacing: '0.3px',
            }}
          >
            <ShieldCheck size={16} color="#16C784" />
            <span>AIR-GAPPED ENCLAVE</span>
            <span style={{ color: '#5A7189', margin: '0 4px' }}>|</span>
            <Lock size={13} color="#F04455" />
            <span style={{ color: '#C22A3A' }}>INTERNET BLOCKED</span>
          </div>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.4}
          maxZoom={1.8}
        >
          <Background
            color="rgba(23, 107, 255, 0.12)"
            gap={24}
            size={1.5}
            variant={BackgroundVariant.Dots}
          />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              if (n.data?.status === 'critical') return '#F04455';
              if (n.data?.status === 'warning') return '#F4A62A';
              return '#16C784';
            }}
            maskColor="rgba(234, 245, 252, 0.65)"
            style={{
              background: 'rgba(255, 255, 255, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.95)',
              borderRadius: '12px',
              boxShadow: '0 4px 16px rgba(23, 107, 255, 0.1)',
            }}
          />
        </ReactFlow>

        {/* Legend Overlay Bottom-Left */}
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.95)',
            borderRadius: '9999px',
            padding: '7px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '0.74rem',
            fontWeight: 700,
            zIndex: 10,
            boxShadow: '0 4px 16px rgba(23, 107, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16C784', boxShadow: '0 0 6px #16C784' }} />
            <span style={{ color: '#0E8053' }}>Healthy (1 Gbps / 10 Gbps)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F04455', boxShadow: '0 0 6px #F04455' }} />
            <span style={{ color: '#C22A3A' }}>Link Down / Failed</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F4A62A', boxShadow: '0 0 6px #F4A62A' }} />
            <span style={{ color: '#B27008' }}>VLAN Degraded / Misconfig</span>
          </div>
        </div>
      </div>

      {/* Slide-out Device Details Drawer */}
      {selectedDevice && (
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 20 }}>
          <DeviceDetailsDrawer
            device={selectedDevice}
            onClose={() => setSelectedDevice(null)}
            onDiagnose={onDiagnoseDevice}
            onTestPing={onTestPingDevice}
          />
        </div>
      )}
    </div>
  );
};
