import React from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { NetworkStatus } from '../../types/network';

interface IncidentSummaryCardsProps {
  status: NetworkStatus;
  onFilterClick?: (filter: string) => void;
}

export const IncidentSummaryCards: React.FC<IncidentSummaryCardsProps> = ({
  status,
  onFilterClick,
}) => {
  const cards = [
    {
      id: 'open',
      title: 'Open Incidents',
      number: status.active_incidents,
      sub: 'Currently Active Cases',
      icon: <AlertOctagon size={15} color="#176BFF" />,
      color: '#176BFF',
    },
    {
      id: 'critical',
      title: 'Critical Incidents',
      number: status.critical_incidents,
      sub: 'Immediate Action Required',
      icon: <AlertTriangle size={15} color="#F04455" />,
      color: '#F04455',
    },
    {
      id: 'resolved',
      title: 'Resolved Today',
      number: status.resolved_today,
      sub: 'Successfully Closed',
      icon: <CheckCircle2 size={15} color="#16C784" />,
      color: '#16C784',
    },
    {
      id: 'time',
      title: 'Avg Response',
      number: `${status.avg_resolution_time_min}m`,
      sub: 'Mean Time To Respond',
      icon: <Clock size={15} color="#F4A62A" />,
      color: '#F4A62A',
    },
  ];

  return (
    <div className="stat-pills-row">
      {cards.map((card) => (
        <div
          key={card.id}
          className="stat-pill-card specular-rim"
          onClick={() => onFilterClick?.(card.id)}
          style={{ cursor: onFilterClick ? 'pointer' : 'default' }}
        >
          <div className="stat-pill-header">
            {card.icon}
            <span style={{ color: card.color, fontWeight: 700 }}>{card.title}</span>
          </div>
          <div className="stat-pill-number">{card.number}</div>
          <div className="stat-pill-sub">{card.sub}</div>
        </div>
      ))}
    </div>
  );
};
