import React, { useState, useEffect } from 'react';
import { Server, Shield, Wifi, RefreshCw, CheckCircle2 } from 'lucide-react';
import { networkService } from '../services/networkService';

export const SettingsPage: React.FC = () => {
  const [apiUrl, setApiUrl] = useState<string>('http://127.0.0.1:8080');
  const [isLive, setIsLive] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(false);
  const [ptPort, setPtPort] = useState<string>('39000');
  const [refreshInterval, setRefreshInterval] = useState<string>('10');
  const [saved, setSaved] = useState<boolean>(false);

  const checkConnection = async () => {
    setChecking(true);
    const live = await networkService.checkBackendHealth();
    setIsLive(live);
    setChecking(false);
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px' }}>
      <div className="workspace-header">
        <div className="workspace-title-box">
          <h1>NetworkOps Configuration & Settings</h1>
          <p>
            Configure standalone FastAPI backend connectivity, Cisco Packet Tracer integration parameters, and safety controls.
          </p>
        </div>
      </div>

      {/* Backend API Configuration */}
      <div className="dashboard-card specular-rim" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="card-title-text" style={{ fontSize: '0.96rem' }}>
          <Server size={18} color="#176BFF" />
          <span>Standalone FastAPI Backend Endpoint</span>
        </div>

        <p style={{ fontSize: '0.82rem', color: '#5A7189', margin: 0 }}>
          Clarix NetworkOps connects to a dedicated standalone FastAPI service running in <code>backend/networkops/</code>.
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.85)',
              border: '1px solid rgba(23, 107, 255, 0.18)',
              borderRadius: '12px',
              color: '#14243B',
              padding: '10px 14px',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
            }}
          />
          <button
            onClick={checkConnection}
            disabled={checking}
            style={{
              padding: '0 18px',
              borderRadius: '9999px',
              background: 'rgba(23, 107, 255, 0.08)',
              border: '1px solid rgba(23, 107, 255, 0.25)',
              color: '#176BFF',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} style={{ animation: checking ? 'nx-spin 1s linear infinite' : 'none' }} />
            <span>Test Connection</span>
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.82rem',
            padding: '10px 16px',
            borderRadius: '12px',
            background: isLive ? 'rgba(22, 199, 132, 0.1)' : 'rgba(23, 107, 255, 0.08)',
            border: isLive ? '1px solid rgba(22, 199, 132, 0.25)' : '1px solid rgba(23, 107, 255, 0.18)',
            color: isLive ? '#0E8053' : '#176BFF',
            fontWeight: 600,
          }}
        >
          {isLive ? <CheckCircle2 size={16} color="#16C784" /> : <Wifi size={16} />}
          <span>
            {isLive
              ? 'FastAPI Backend Online: Real endpoints active at http://127.0.0.1:8080'
              : 'Standalone Demo Mode Active: Offline resilience fallback responding with complete simulated Cisco network topology.'}
          </span>
        </div>
      </div>

      {/* Cisco Packet Tracer Integration */}
      <div className="dashboard-card specular-rim" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="card-title-text" style={{ fontSize: '0.96rem' }}>
          <Wifi size={18} color="#176BFF" />
          <span>Cisco Packet Tracer IPC Connector</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.74rem', color: '#7E92A6', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
              Packet Tracer IPC Port
            </label>
            <input
              type="text"
              value={ptPort}
              onChange={(e) => setPtPort(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.85)',
                border: '1px solid rgba(23, 107, 255, 0.18)',
                borderRadius: '12px',
                color: '#14243B',
                fontWeight: 600,
                padding: '10px 14px',
                fontSize: '0.85rem',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.74rem', color: '#7E92A6', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
              Telemetry Polling Interval
            </label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.85)',
                border: '1px solid rgba(23, 107, 255, 0.18)',
                borderRadius: '12px',
                color: '#14243B',
                fontWeight: 600,
                padding: '10px 14px',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            >
              <option value="5">Every 5 Seconds (High frequency)</option>
              <option value="10">Every 10 Seconds (Recommended)</option>
              <option value="30">Every 30 Seconds (Low bandwidth)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Safety Policy */}
      <div className="dashboard-card specular-rim" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="card-title-text" style={{ fontSize: '0.96rem' }}>
          <Shield size={18} color="#176BFF" />
          <span>NOC Execution & Safety Guardrails</span>
        </div>

        <div
          style={{
            background: 'rgba(244, 166, 42, 0.1)',
            border: '1px solid rgba(244, 166, 42, 0.25)',
            borderRadius: '12px',
            padding: '14px 16px',
            fontSize: '0.82rem',
            color: '#B27008',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: '#B27008' }}>Zero Arbitrary Execution Policy:</strong> Frontend is architected so that destructive network configuration actions generate review proposals submitted to the backend change management queue. Direct unreviewed execution is blocked by default.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button
          onClick={handleSave}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 24px',
            borderRadius: '9999px',
            background: 'linear-gradient(135deg, #176BFF 0%, #00D9F5 100%)',
            color: '#FFFFFF',
            fontSize: '0.84rem',
            fontWeight: 700,
            border: '1px solid rgba(255, 255, 255, 0.4)',
            boxShadow: '0 4px 14px rgba(23, 107, 255, 0.28)',
            cursor: 'pointer',
          }}
        >
          {saved ? 'Settings Saved!' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
};
