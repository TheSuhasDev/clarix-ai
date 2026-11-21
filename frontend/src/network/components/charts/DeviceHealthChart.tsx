import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

export const DeviceHealthChart: React.FC = () => {
  const data = [
    { name: 'Online (Healthy)', value: 8, color: '#16C784' },
    { name: 'Degraded / Warning', value: 1, color: '#F4A62A' },
    { name: 'Offline / Critical', value: 1, color: '#F04455' },
  ];

  return (
    <div className="dashboard-card specular-rim" style={{ padding: '18px' }}>
      <div className="card-title-row">
        <h3 className="card-title-text" style={{ fontSize: '0.94rem' }}>Device Health Distribution</h3>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 800,
            padding: '3px 8px',
            borderRadius: '9999px',
            background: 'rgba(23, 107, 255, 0.1)',
            color: '#176BFF',
          }}
        >
          10 NODES
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 180 }}>
        <div style={{ width: '50%', height: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
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
              <Pie
                data={data}
                innerRadius={46}
                outerRadius={68}
                paddingAngle={4}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{ width: '50%', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.76rem' }}>
          {data.map((item) => (
            <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#5A7189' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                <span>{item.name}</span>
              </div>
              <span style={{ color: '#14243B', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
