import React from 'react';
import { CheckCircle2, AlertTriangle, Sparkles, Activity } from 'lucide-react';
import { DemoMode } from '../../types/network';

interface DemoSelectorProps {
  currentMode: DemoMode;
  onSelectMode: (mode: DemoMode) => void;
  onAnalyzeWithAI: () => void;
  isAnalyzing?: boolean;
}

export const DemoSelector: React.FC<DemoSelectorProps> = ({
  currentMode,
  onSelectMode,
  onAnalyzeWithAI,
  isAnalyzing = false,
}) => {
  return (
    <div
      className="glass-primary specular-rim"
      style={{
        padding: '12px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        marginBottom: '16px',
        background: 'rgba(255, 255, 255, 0.72)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        border: '1px solid rgba(255, 255, 255, 0.95)',
        borderRadius: '20px',
        boxShadow: '0 8px 30px rgba(23, 107, 255, 0.08)',
      }}
    >
      {/* Left: Mode Title & Two Scenario Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '4px' }}>
          <Activity size={16} color="#176BFF" />
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#14243B', letterSpacing: '0.4px' }}>
            SCENARIO MODE:
          </span>
        </div>

        {/* Button 1: Demo 1 — Healthy Network */}
        <button
          onClick={() => onSelectMode('healthy')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '9999px',
            background:
              currentMode === 'healthy'
                ? 'rgba(22, 199, 132, 0.15)'
                : 'rgba(255, 255, 255, 0.65)',
            border:
              currentMode === 'healthy'
                ? '1.5px solid #16C784'
                : '1px solid rgba(23, 107, 255, 0.12)',
            boxShadow:
              currentMode === 'healthy'
                ? '0 4px 16px rgba(22, 199, 132, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.8)'
                : '0 2px 8px rgba(0, 0, 0, 0.03)',
            color: currentMode === 'healthy' ? '#0D6843' : '#5A7189',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#16C784',
              boxShadow: currentMode === 'healthy' ? '0 0 10px #16C784' : 'none',
            }}
          />
          <span>Demo 1 – Healthy Network</span>
          {currentMode === 'healthy' && (
            <span
              style={{
                fontSize: '0.65rem',
                padding: '2px 7px',
                borderRadius: '9999px',
                background: '#16C784',
                color: '#FFFFFF',
                fontWeight: 800,
                marginLeft: '4px',
              }}
            >
              ACTIVE
            </span>
          )}
        </button>

        {/* Button 2: Demo 2 — Faulty Network */}
        <button
          onClick={() => onSelectMode('faulty')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '9999px',
            background:
              currentMode === 'faulty'
                ? 'rgba(240, 68, 85, 0.15)'
                : 'rgba(255, 255, 255, 0.65)',
            border:
              currentMode === 'faulty'
                ? '1.5px solid #F04455'
                : '1px solid rgba(23, 107, 255, 0.12)',
            boxShadow:
              currentMode === 'faulty'
                ? '0 4px 16px rgba(240, 68, 85, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.8)'
                : '0 2px 8px rgba(0, 0, 0, 0.03)',
            color: currentMode === 'faulty' ? '#A31828' : '#5A7189',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#F04455',
              boxShadow: currentMode === 'faulty' ? '0 0 10px #F04455' : 'none',
            }}
          />
          <span>Demo 2 – Faulty Network</span>
          <span
            style={{
              fontSize: '0.65rem',
              padding: '2px 7px',
              borderRadius: '9999px',
              background: currentMode === 'faulty' ? '#F04455' : 'rgba(240, 68, 85, 0.12)',
              color: currentMode === 'faulty' ? '#FFFFFF' : '#F04455',
              fontWeight: 800,
              marginLeft: '4px',
            }}
          >
            4 FAULTS
          </span>
        </button>
      </div>

      {/* Right: Status Pill & Prominent ANALYZE NETWORK WITH CLARIX AI Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '9999px',
            fontSize: '0.76rem',
            fontWeight: 700,
            background:
              currentMode === 'healthy'
                ? 'rgba(22, 199, 132, 0.12)'
                : 'rgba(240, 68, 85, 0.12)',
            border:
              currentMode === 'healthy'
                ? '1px solid rgba(22, 199, 132, 0.3)'
                : '1px solid rgba(240, 68, 85, 0.3)',
            color: currentMode === 'healthy' ? '#0E8053' : '#C22A3A',
          }}
        >
          {currentMode === 'healthy' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          <span>
            {currentMode === 'healthy' ? 'ALL SYSTEMS OPERATIONAL' : '4 ACTIVE INJECTED FAULTS'}
          </span>
        </div>

        {/* PROMINENT CLARIX AI BUTTON */}
        <button
          onClick={onAnalyzeWithAI}
          disabled={isAnalyzing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 20px',
            borderRadius: '9999px',
            background: isAnalyzing
              ? 'rgba(23, 107, 255, 0.5)'
              : 'linear-gradient(135deg, #176BFF 0%, #00D9F5 100%)',
            color: '#FFFFFF',
            fontSize: '0.82rem',
            fontWeight: 700,
            letterSpacing: '0.3px',
            border: '1px solid rgba(255, 255, 255, 0.45)',
            boxShadow: isAnalyzing ? 'none' : '0 6px 20px rgba(23, 107, 255, 0.32), inset 0 1px 1px rgba(255, 255, 255, 0.6)',
            cursor: isAnalyzing ? 'wait' : 'pointer',
            transition: 'all 200ms ease',
            opacity: isAnalyzing ? 0.75 : 1,
            pointerEvents: isAnalyzing ? 'none' : 'auto',
          }}
        >
          <Sparkles size={16} />
          <span>{isAnalyzing ? 'Analyzing Network Telemetry...' : 'ANALYZE NETWORK WITH CLARIX AI'}</span>
        </button>
      </div>
    </div>
  );
};
