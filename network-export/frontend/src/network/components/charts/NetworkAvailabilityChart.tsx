import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface NetworkAvailabilityChartProps {
  timeRange?: string;
}

export const NetworkAvailabilityChart: React.FC<NetworkAvailabilityChartProps> = ({
  timeRange: _timeRange = '24h',
}) => {
  const data = [
    { day: 'Mon', uptime: 99.8, downtime: 0.2 },
    { day: 'Tue', uptime: 99.4, downtime: 0.6 },
    { day: 'Wed', uptime: 96.8, downtime: 3.2 },
    { day: 'Thu', uptime: 99.1, downtime: 0.9 },
    { day: 'Fri', uptime: 98.4, downtime: 1.6 },
    { day: 'Sat', uptime: 99.9, downtime: 0.1 },
    { day: 'Sun', uptime: 99.7, downtime: 0.3 },
  ];

  return (
    <div className="dashboard-card specular-rim" style={{ padding: '18px' }}>
      <div className="card-title-row">
        <div>
          <h3 className="card-title-text" style={{ fontSize: '0.94rem' }}>Network Availability & SLA</h3>
          <span style={{ fontSize: '0.74rem', color: '#5A7189' }}>
            Historical Uptime vs Downtime %
          </span>
        </div>
        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: 800,
            color: '#0E8053',
            background: 'rgba(22, 199, 132, 0.12)',
            padding: '3px 10px',
            borderRadius: '9999px',
            border: '1px solid rgba(22, 199, 132, 0.25)',
          }}
        >
          97.4% Target met
        </span>
      </div>

      <div style={{ width: '100%', height: 180, marginTop: '8px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(23, 107, 255, 0.08)" />
            <XAxis dataKey="day" stroke="#5A7189" fontSize={11} tickLine={false} />
            <YAxis stroke="#5A7189" fontSize={11} domain={[90, 100]} tickLine={false} />
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
            />
            <Bar dataKey="uptime" fill="#16C784" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
