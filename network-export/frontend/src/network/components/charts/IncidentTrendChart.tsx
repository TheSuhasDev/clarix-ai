import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { TimeRangeFilter } from '../../types/network';

interface IncidentTrendChartProps {
  timeRange?: TimeRangeFilter;
}

export const IncidentTrendChart: React.FC<IncidentTrendChartProps> = ({
  timeRange: _timeRange = '24h',
}) => {
  const [selectedRange, setSelectedRange] = useState<string>('24 Hours');

  const data24h = [
    { time: '00:00', newInc: 12, resolved: 8, escalated: 2 },
    { time: '04:00', newInc: 18, resolved: 14, escalated: 3 },
    { time: '08:00', newInc: 34, resolved: 28, escalated: 6 },
    { time: '12:00', newInc: 65, resolved: 42, escalated: 9 }, // Peak
    { time: '16:00', newInc: 48, resolved: 50, escalated: 5 },
    { time: '20:00', newInc: 26, resolved: 31, escalated: 2 },
    { time: '23:59', newInc: 15, resolved: 20, escalated: 1 },
  ];

  const data7d = [
    { time: 'Mon', newInc: 35, resolved: 30, escalated: 4 },
    { time: 'Tue', newInc: 42, resolved: 38, escalated: 7 },
    { time: 'Wed', newInc: 65, resolved: 52, escalated: 11 },
    { time: 'Thu', newInc: 48, resolved: 45, escalated: 6 },
    { time: 'Fri', newInc: 58, resolved: 54, escalated: 8 },
    { time: 'Sat', newInc: 22, resolved: 25, escalated: 2 },
    { time: 'Sun', newInc: 19, resolved: 21, escalated: 1 },
  ];

  const chartData = selectedRange === '24 Hours' ? data24h : data7d;

  return (
    <div className="dashboard-card specular-rim" style={{ padding: '18px' }}>
      <div className="card-title-row" style={{ marginBottom: '8px' }}>
        <h3 className="card-title-text" style={{ fontSize: '0.94rem' }}>Incident Volume Trend</h3>
        <select
          value={selectedRange}
          onChange={(e) => setSelectedRange(e.target.value)}
          style={{
            background: 'rgba(255, 255, 255, 0.7)',
            border: '1px solid rgba(23, 107, 255, 0.15)',
            borderRadius: '9999px',
            color: '#14243B',
            fontSize: '0.72rem',
            fontWeight: 600,
            padding: '3px 10px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="24 Hours">24 Hours</option>
          <option value="7 Days">7 Days</option>
          <option value="30 Days">30 Days</option>
        </select>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          fontSize: '0.72rem',
          color: '#5A7189',
          marginBottom: '12px',
          fontWeight: 600,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#176BFF' }} />
          <span>New</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16C784' }} />
          <span>Resolved</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F04455' }} />
          <span>Escalated</span>
        </div>
      </div>

      {/* Recharts Area Chart */}
      <div style={{ width: '100%', height: 160, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="areaLiquidBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#176BFF" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#00D9F5" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="areaLiquidGreen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#16C784" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#16C784" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(23, 107, 255, 0.08)" />
            <XAxis
              dataKey="time"
              stroke="#5A7189"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: 'rgba(23, 107, 255, 0.1)' }}
            />
            <YAxis
              stroke="#5A7189"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: 'rgba(23, 107, 255, 0.1)' }}
            />
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
            <Area
              type="monotone"
              dataKey="newInc"
              stroke="#176BFF"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#areaLiquidBlue)"
            />
            <Area
              type="monotone"
              dataKey="resolved"
              stroke="#16C784"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#areaLiquidGreen)"
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Peak Badge Overlay */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '52%',
            transform: 'translate(-50%, -50%)',
            background: 'linear-gradient(135deg, #176BFF 0%, #00D9F5 100%)',
            color: '#FFFFFF',
            fontSize: '0.68rem',
            fontWeight: 800,
            padding: '3px 10px',
            borderRadius: '9999px',
            boxShadow: '0 4px 14px rgba(23, 107, 255, 0.35)',
            pointerEvents: 'none',
          }}
        >
          Peak 65
        </div>
      </div>
    </div>
  );
};
