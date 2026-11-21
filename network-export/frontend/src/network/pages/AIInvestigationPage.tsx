import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Terminal,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Cpu,
  CheckCircle2,
  ListFilter,
  X,
} from 'lucide-react';
import { networkService } from '../services/networkService';
import { DiagnoseResponse, DemoMode, FaultDetail } from '../types/network';
import { DemoSelector } from '../components/topology/DemoSelector';
import { HumanApprovalModal } from '../components/common/HumanApprovalModal';

interface AIInvestigationPageProps {
  initialQuery?: string;
  demoMode: DemoMode;
  onSelectDemoMode: (mode: DemoMode) => void;
}

export const AIInvestigationPage: React.FC<AIInvestigationPageProps> = ({
  initialQuery = 'Analyze Network',
  demoMode,
  onSelectDemoMode,
}) => {
  const [query, setQuery] = useState<string>(initialQuery);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<DiagnoseResponse | null>(null);
  const [copiedIncidentId, setCopiedIncidentId] = useState<string | null>(null);
  const [showEvidenceModal, setShowEvidenceModal] = useState<boolean>(false);
  const [activeTabFault, setActiveTabFault] = useState<string>('all');

  // Human Approval Modal state
  const [approvalModalOpen, setApprovalModalOpen] = useState<boolean>(false);
  const [selectedFaultForApproval, setSelectedFaultForApproval] = useState<FaultDetail | null>(null);

  const sampleQuestions = [
    'Analyze Network',
    'Why is Router R1 offline?',
    'Why is Switch SW-001 dropping management packets?',
    'Why is Workstation 002 unable to communicate outside subnet?',
    'Why is Local RAG Server unavailable?',
    'Find the problem in my network.',
    'Explain the incorrect configuration.',
  ];

  const runAnalysis = async (q: string, mode: DemoMode) => {
    setLoading(true);
    try {
      const resp = await networkService.diagnose(q, mode);
      setResult(resp);
    } catch {
      // handled in service
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAnalysis(query, demoMode);
  }, [demoMode]);

  const handleCopyCommands = (inc: FaultDetail) => {
    navigator.clipboard.writeText(inc.commands.join('\n'));
    setCopiedIncidentId(inc.id);
    setTimeout(() => setCopiedIncidentId(null), 2000);
  };

  const handleOpenApproval = (fault: FaultDetail) => {
    setSelectedFaultForApproval(fault);
    setApprovalModalOpen(true);
  };

  const isHealthy = demoMode === 'healthy';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Title & Intro */}
      <div className="workspace-header">
        <div className="workspace-title-box">
          <h1>Clarix AI Network Troubleshooting Engine</h1>
          <p>
            VisionOS AI Agent Operating Environment with deterministic root-cause heuristics and Packet Tracer command generation.
          </p>
        </div>
      </div>

      {/* Demo Selector Header */}
      <DemoSelector
        currentMode={demoMode}
        onSelectMode={(mode) => onSelectDemoMode(mode)}
        onAnalyzeWithAI={() => runAnalysis('Analyze Network', demoMode)}
        isAnalyzing={loading}
      />

      {/* Hero Assistant Visual & Query Console */}
      <div
        className="dashboard-card specular-rim"
        style={{
          padding: '24px',
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(240, 248, 255, 0.75) 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          {/* 3D Liquid Glass Robot Identity */}
          <div
            style={{
              width: '130px',
              height: '130px',
              borderRadius: '24px',
              background: 'rgba(255, 255, 255, 0.92)',
              border: '1.5px solid rgba(255, 255, 255, 0.95)',
              boxShadow: '0 12px 36px rgba(90, 80, 200, 0.16), inset 0 1px 2px rgba(255, 255, 255, 1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <img
              src="/network-assets/robot-1.jpg"
              alt="Clarix AI Assistant"
              className="robot-image-contain animate-glass-float"
              style={{ objectPosition: '86% 25%' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/network-assets/robot-assistant.svg';
              }}
            />
            {/* Glowing online indicator */}
            <span
              style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#16C784',
                border: '2px solid #FFFFFF',
                boxShadow: '0 0 10px #16C784',
              }}
            />
          </div>

          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  background: 'rgba(23, 107, 255, 0.1)',
                  color: '#176BFF',
                  letterSpacing: '0.4px',
                }}
              >
                AUTONOMOUS NOC COPILOT
              </span>
              <span style={{ fontSize: '0.74rem', color: '#5A7189' }}>
                Active LLM Context: Air-Gapped Topology
              </span>
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#14243B', margin: '0 0 12px 0' }}>
              Ask Clarix AI to Diagnose Network Incidents
            </h2>

            {/* Query Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAnalysis(query, demoMode);
              }}
              style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}
            >
              <div
                style={{
                  flex: 1,
                  minWidth: '240px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'rgba(255, 255, 255, 0.85)',
                  border: '1px solid rgba(23, 107, 255, 0.2)',
                  borderRadius: '9999px',
                  padding: '10px 18px',
                  boxShadow: '0 4px 16px rgba(23, 107, 255, 0.06)',
                }}
              >
                <Cpu size={18} color="#176BFF" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask Clarix AI (e.g. Analyze Network, Why is Router R1 offline?)"
                  style={{
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    color: '#14243B',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    width: '100%',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 24px',
                  borderRadius: '9999px',
                  background: 'linear-gradient(135deg, #176BFF 0%, #00D9F5 100%)',
                  color: '#FFFFFF',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  border: '1px solid rgba(255, 255, 255, 0.45)',
                  boxShadow: '0 6px 20px rgba(23, 107, 255, 0.32)',
                  cursor: loading ? 'wait' : 'pointer',
                  transition: 'all 200ms ease',
                }}
              >
                <Send size={15} />
                <span>{loading ? 'Analyzing...' : 'Investigate'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Suggested Queries Pill Row */}
        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.74rem', color: '#5A7189', fontWeight: 700 }}>
            Suggested Prompts:
          </span>
          {sampleQuestions.map((sq, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setQuery(sq);
                runAnalysis(sq, demoMode);
              }}
              style={{
                fontSize: '0.74rem',
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: '9999px',
                background: query === sq ? 'rgba(23, 107, 255, 0.12)' : 'rgba(255, 255, 255, 0.7)',
                color: query === sq ? '#176BFF' : '#5A7189',
                border: query === sq ? '1px solid rgba(23, 107, 255, 0.35)' : '1px solid rgba(23, 107, 255, 0.1)',
                cursor: 'pointer',
                transition: 'all 180ms ease',
              }}
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* AI Loading State with Robot-4 / robot-loading */}
      {loading && (
        <div
          className="dashboard-card specular-rim"
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            background: 'rgba(255, 255, 255, 0.85)',
          }}
        >
          <div
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '22px',
              background: 'rgba(255, 255, 255, 0.95)',
              border: '1.5px solid rgba(255, 255, 255, 1)',
              boxShadow: '0 8px 30px rgba(90, 80, 200, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <img
              src="/network-assets/robot-4.jpg"
              alt="Analyzing Telemetry"
              className="robot-image-contain animate-glass-pulse"
              style={{ objectPosition: '68% 35%' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/network-assets/robot-loading.svg';
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#14243B' }}>
              Clarix AI Analyzing Network Telemetry & Diagnostic Logs...
            </div>
            <div style={{ fontSize: '0.82rem', color: '#5A7189', marginTop: '4px' }}>
              Correlating router interfaces, VLAN assignments, default gateways, and local LLM/RAG services...
            </div>
          </div>
        </div>
      )}

      {/* Analysis Output Section */}
      {!loading && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Executive Diagnostic Result Banner */}
          <div
            className="dashboard-card specular-rim"
            style={{
              padding: '20px',
              background: isHealthy
                ? 'linear-gradient(135deg, rgba(22, 199, 132, 0.08) 0%, rgba(240, 253, 248, 0.8) 100%)'
                : 'linear-gradient(135deg, rgba(240, 68, 85, 0.08) 0%, rgba(255, 245, 246, 0.8) 100%)',
              border: `1.5px solid ${isHealthy ? 'rgba(22, 199, 132, 0.3)' : 'rgba(240, 68, 85, 0.3)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '12px',
                    background: isHealthy ? 'rgba(22, 199, 132, 0.15)' : 'rgba(240, 68, 85, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isHealthy ? (
                    <CheckCircle2 size={24} color="#16C784" />
                  ) : (
                    <AlertTriangle size={24} color="#F04455" />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#14243B' }}>
                    {isHealthy ? 'ALL SYSTEMS OPERATIONAL · NO FAULTS DETECTED' : '4 CRITICAL/WARNING FAULTS CONFIRMED'}
                  </div>
                  <div style={{ fontSize: '0.84rem', color: isHealthy ? '#0D6843' : '#A31828', marginTop: '2px', lineHeight: 1.4 }}>
                    {result.summary}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowEvidenceModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '9999px',
                    background: 'rgba(255, 255, 255, 0.85)',
                    border: '1px solid rgba(23, 107, 255, 0.2)',
                    color: '#176BFF',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <FileText size={14} />
                  <span>View Evidence Telemetry</span>
                </button>
              </div>
            </div>
          </div>

          {/* Fault Cards (Demo 2) */}
          {!isHealthy && result.incidents.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Category Filter Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.74rem', color: '#5A7189', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ListFilter size={14} /> Filter Faults:
                </span>
                <button
                  onClick={() => setActiveTabFault('all')}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '9999px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: activeTabFault === 'all' ? 'linear-gradient(135deg, #176BFF, #00D9F5)' : 'rgba(255, 255, 255, 0.7)',
                    color: activeTabFault === 'all' ? '#FFFFFF' : '#5A7189',
                    border: activeTabFault === 'all' ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgba(23, 107, 255, 0.1)',
                  }}
                >
                  All (4)
                </button>
                {result.incidents.map((inc) => (
                  <button
                    key={inc.id}
                    onClick={() => setActiveTabFault(inc.device_id)}
                    style={{
                      padding: '5px 14px',
                      borderRadius: '9999px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: activeTabFault === inc.device_id ? 'linear-gradient(135deg, #176BFF, #00D9F5)' : 'rgba(255, 255, 255, 0.7)',
                      color: activeTabFault === inc.device_id ? '#FFFFFF' : '#5A7189',
                      border: activeTabFault === inc.device_id ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgba(23, 107, 255, 0.1)',
                    }}
                  >
                    {inc.device_name}
                  </button>
                ))}
              </div>

              {/* Render Filtered Incident Cards */}
              {result.incidents
                .filter((inc) => activeTabFault === 'all' || activeTabFault === inc.device_id)
                .map((fault) => (
                  <div
                    key={fault.id}
                    className="dashboard-card specular-rim"
                    style={{
                      padding: '22px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      borderLeft: `4px solid ${fault.severity.toUpperCase() === 'CRITICAL' ? '#F04455' : '#F4A62A'}`,
                    }}
                  >
                    {/* Fault Card Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: '9999px',
                              background: fault.severity.toUpperCase() === 'CRITICAL' ? 'rgba(240, 68, 85, 0.12)' : 'rgba(244, 166, 42, 0.12)',
                              color: fault.severity.toUpperCase() === 'CRITICAL' ? '#C22A3A' : '#B27008',
                              border: `1px solid ${fault.severity.toUpperCase() === 'CRITICAL' ? 'rgba(240, 68, 85, 0.3)' : 'rgba(244, 166, 42, 0.3)'}`,
                            }}
                          >
                            {fault.severity}
                          </span>
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#14243B', margin: 0 }}>
                            {fault.device_name} — {fault.problem}
                          </h3>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#5A7189', fontFamily: 'var(--font-mono)' }}>
                          Device ID: {fault.device_id} · Ticket: {fault.id}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleCopyCommands(fault)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            borderRadius: '9999px',
                            background: 'rgba(23, 107, 255, 0.08)',
                            border: '1px solid rgba(23, 107, 255, 0.25)',
                            color: copiedIncidentId === fault.id ? '#0E8053' : '#176BFF',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {copiedIncidentId === fault.id ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedIncidentId === fault.id ? 'Copied!' : 'Copy Commands'}</span>
                        </button>

                        <button
                          onClick={() => handleOpenApproval(fault)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 16px',
                            borderRadius: '9999px',
                            background: 'linear-gradient(135deg, #176BFF 0%, #00D9F5 100%)',
                            color: '#FFFFFF',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            border: '1px solid rgba(255, 255, 255, 0.4)',
                            boxShadow: '0 4px 14px rgba(23, 107, 255, 0.25)',
                            cursor: 'pointer',
                          }}
                        >
                          <ShieldCheck size={14} />
                          <span>Request Approval</span>
                        </button>
                      </div>
                    </div>

                    {/* Root Cause & Diagnosis */}
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: '12px',
                        background: 'rgba(255, 255, 255, 0.7)',
                        border: '1px solid rgba(23, 107, 255, 0.1)',
                        fontSize: '0.82rem',
                        lineHeight: 1.5,
                        color: '#14243B',
                      }}
                    >
                      <strong style={{ color: '#176BFF' }}>Clarix Expected Diagnosis:</strong> {fault.recommended_solution || fault.root_cause}
                    </div>

                    {/* Cisco IOS Commands Terminal */}
                    <div>
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: '#7E92A6',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Terminal size={13} color="#176BFF" />
                        <span>Suggested Cisco IOS / Service Remediation</span>
                      </div>
                      <pre
                        style={{
                          background: '#0E1A29',
                          border: '1px solid rgba(23, 107, 255, 0.2)',
                          borderRadius: '12px',
                          padding: '12px 16px',
                          color: '#00D9F5',
                          fontSize: '0.8rem',
                          lineHeight: 1.6,
                          fontFamily: 'var(--font-mono)',
                          overflowX: 'auto',
                        }}
                      >
                        {fault.commands.map((cmd, i) => (
                          <div key={i}>
                            <span style={{ color: '#5A7189', marginRight: '10px' }}>{i + 1}</span>
                            <span>{cmd}</span>
                          </div>
                        ))}
                      </pre>
                    </div>

                    {/* Evidence Points */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#7E92A6', fontWeight: 800, textTransform: 'uppercase' }}>
                        Diagnostic Telemetry Evidence:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {fault.evidence.map((ev, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: '0.74rem',
                              padding: '3px 10px',
                              borderRadius: '6px',
                              background: 'rgba(23, 107, 255, 0.06)',
                              border: '1px solid rgba(23, 107, 255, 0.15)',
                              color: '#14243B',
                            }}
                          >
                            ▸ {ev}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

              {/* Bottom Multi-Action Control Bar */}
              <div
                className="dashboard-card specular-rim"
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  background: 'rgba(255, 255, 255, 0.85)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} color="#176BFF" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#14243B' }}>
                    Clarix Automated Triage Workflow Complete
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => {
                      const allCommands = result.incidents.flatMap((i) => [
                        `# --- Fix for ${i.device_name} (${i.problem}) ---`,
                        ...i.commands,
                        '',
                      ]);
                      navigator.clipboard.writeText(allCommands.join('\n'));
                      alert('All 4 remediation command sets copied to clipboard!');
                    }}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '9999px',
                      background: 'rgba(23, 107, 255, 0.08)',
                      border: '1px solid rgba(23, 107, 255, 0.25)',
                      color: '#176BFF',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Terminal size={14} style={{ display: 'inline', marginRight: 6 }} />
                    <span>Copy All 4 Remediation Sets</span>
                  </button>

                  <button
                    onClick={() => handleOpenApproval(result.incidents[0])}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 20px',
                      borderRadius: '9999px',
                      background: 'linear-gradient(135deg, #176BFF 0%, #00D9F5 100%)',
                      color: '#FFFFFF',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      border: '1px solid rgba(255, 255, 255, 0.4)',
                      boxShadow: '0 4px 16px rgba(23, 107, 255, 0.3)',
                      cursor: 'pointer',
                    }}
                  >
                    <ShieldCheck size={16} />
                    <span>Batch Approval Request</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Diagnostic Evidence Modal */}
      {showEvidenceModal && result && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(20, 36, 59, 0.35)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="glass-floating specular-rim"
            style={{
              width: '100%',
              maxWidth: '680px',
              background: 'rgba(255, 255, 255, 0.94)',
              border: '1px solid rgba(255, 255, 255, 0.95)',
              borderRadius: '24px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 24px 64px rgba(23, 107, 255, 0.16)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={20} color="#176BFF" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#14243B', margin: 0 }}>
                  Complete Diagnostic Evidence Telemetry
                </h3>
              </div>
              <button
                onClick={() => setShowEvidenceModal(false)}
                style={{
                  background: 'rgba(23, 107, 255, 0.06)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#5A7189',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {result.incidents.map((inc) => (
              <div
                key={inc.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.7)',
                  border: '1px solid rgba(23, 107, 255, 0.1)',
                  padding: '14px',
                  borderRadius: '14px',
                }}
              >
                <div style={{ color: '#176BFF', fontWeight: 800, fontSize: '0.88rem', marginBottom: '8px' }}>
                  {inc.device_name} ({inc.id})
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px', padding: 0 }}>
                  {inc.evidence.map((ev, i) => (
                    <li key={i} style={{ fontSize: '0.8rem', color: '#14243B', display: 'flex', gap: '8px' }}>
                      <span style={{ color: '#F04455' }}>▸</span>
                      <span>{ev}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <button
              onClick={() => setShowEvidenceModal(false)}
              style={{
                alignSelf: 'flex-end',
                padding: '8px 20px',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, #176BFF 0%, #00D9F5 100%)',
                color: '#FFFFFF',
                fontSize: '0.82rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Human Approval Modal */}
      {selectedFaultForApproval && (
        <HumanApprovalModal
          isOpen={approvalModalOpen}
          onClose={() => setApprovalModalOpen(false)}
          deviceId={selectedFaultForApproval.device_id}
          deviceName={selectedFaultForApproval.device_name}
          incidentId={selectedFaultForApproval.id}
          proposedCommands={selectedFaultForApproval.commands}
          expectedImpact={selectedFaultForApproval.expected_result}
          problemSummary={selectedFaultForApproval.problem}
        />
      )}
    </div>
  );
};
