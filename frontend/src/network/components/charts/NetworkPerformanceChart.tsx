import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

export const NetworkPerformanceChart: React.FC = () => {
  const [metric, setMetric] = useState<'latency' | 'packetLoss' | 'throughput'>('latency');

  const telemetryData = [
    { time: '14:00', latency: 1.2, packetLoss: 0.0, throughput: 850 },
    { time: '14:15', latency: 1.5, packetLoss: 0.0, throughput: 920 },
    { time: '14:30', latency: 24.8, packetLoss: 12.5, throughput: 420 },
    { time: '14:45', latency: 48.0, packetLoss: 42.0, throughput: 180 },
    { time: '15:00', latency: 18.2, packetLoss: 8.5, throughput: 590 },
    { time: '15:15', latency: 2.1, packetLoss: 0.2, throughput: 840 },
    { time: '15:30', latency: 1.4, packetLoss: 0.0, throughput: 890 },
  ];

  const getMetricConfig = () => {
    switch (metric) {
      case 'latency':
        return { key: 'latency', color: '#176BFF', unit: 'ms', label: 'Latency (RTT)' };
      case 'packetLoss':
        return { key: 'packetLoss', color: '#F04455', unit: '%', label: 'Packet Loss' };
      case 'throughput':
        return { key: 'throughput', color: '#16C784', unit: 'Mbps', label: 'Throughput' };
    }
  };

  const config = getMetricConfig();

  return (
    <div className="dashboard-card specular-rim" style={{ padding: '18px' }}>
      <div className="card-title-row" style={{ marginBottom: '8px' }}>
        <h3 className="card-title-text" style={{ fontSize: '0.94rem' }}>Network Telemetry</h3>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['latency', 'packetLoss', 'throughput'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '9999px',
                background: metric === m ? 'linear-gradient(135deg, #176BFF, #00D9F5)' : 'rgba(255, 255, 255, 0.7)',
                color: metric === m ? '#FFFFFF' : '#5A7189',
                border: metric === m ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgba(23, 107, 255, 0.1)',
                cursor: 'pointer',
                transition: 'all 180ms ease',
              }}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', height: 180, marginTop: '8px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={telemetryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(23, 107, 255, 0.08)" />
            <XAxis dataKey="time" stroke="#5A7189" fontSize={11} tickLine={false} />
            <YAxis stroke="#5A7189" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(23, 107, 255, 0.2)',
                borderRadius: '12px',
                fontSize: '0.78rem',
                color: '#14243B',
                boxShadow: '0 8px 24px rgba(23, 107, 255, 0.15)',
              }}
              formatter={(value: any) => [`${value} ${config.unit}`, config.label]}
            />
            <Line
              type="monotone"
              dataKey={config.key}
              stroke={config.color}
              strokeWidth={2.8}
              dot={{ fill: config.color, r: 4 }}
              activeDot={{ r: 6, stroke: '#FFFFFF', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
