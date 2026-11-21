import React from 'react';
import { ChevronDown } from 'lucide-react';

interface GlowingPillProps {
  label: string;
  value: string;
  options?: string[];
  onChange?: (val: string) => void;
}

export const GlowingPill: React.FC<GlowingPillProps> = ({
  label,
  value,
  options = [],
  onChange,
}) => {
  return (
    <div className="nav-pill-select" style={{ position: 'relative' }}>
      <span>{label}:</span>
      <strong>{value}</strong>
      {options.length > 0 ? (
        <>
          <ChevronDown size={14} style={{ opacity: 0.7 }} />
          <select
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0,
              cursor: 'pointer',
              width: '100%',
              height: '100%',
            }}
          >
            {options.map((opt) => (
              <option key={opt} value={opt} style={{ background: '#0a1a22', color: '#fff' }}>
                {opt}
              </option>
            ))}
          </select>
        </>
      ) : (
        <ChevronDown size={14} style={{ opacity: 0.7 }} />
      )}
    </div>
  );
};
