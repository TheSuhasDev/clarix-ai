"""Generates high-resolution publication-quality architecture diagram for Clarix AI."""
import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Circle, Rectangle

def build_diagram():
    # 38 x 25 inches at 100 DPI = 3800 x 2500 px (at least 3000px wide)
    fig_w, fig_h = 38, 25
    fig, ax = plt.subplots(figsize=(fig_w, fig_h), dpi=100)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    # Background
    fig.patch.set_facecolor('#FFFFFF')
    ax.set_facecolor('#FFFFFF')

    # Color Palette Definitions
    C_BLUE_BG = '#F0F6FF'
    C_BLUE_BORDER = '#2563EB'
    C_BLUE_TITLE = '#1E40AF'

    C_RED_BG = '#FEF2F2'
    C_RED_BORDER = '#DC2626'
    C_RED_TITLE = '#991B1B'

    C_PURPLE_BG = '#FAF5FF'
    C_PURPLE_BORDER = '#7C3AED'
    C_PURPLE_TITLE = '#5B21B6'

    C_INDIGO_BG = '#EEF2FF'
    C_INDIGO_BORDER = '#4F46E5'
    C_INDIGO_TITLE = '#3730A3'

    C_GREEN_BG = '#ECFDF5'
    C_GREEN_BORDER = '#059669'
    C_GREEN_TITLE = '#065F46'

    C_AMBER_BG = '#FFFBEB'
    C_AMBER_BORDER = '#D97706'
    C_AMBER_TITLE = '#92400E'

    # Box drawer helper
    def draw_box(x, y, w, h, bg, border, lw=1.5, rx=0.8, linestyle='-'):
        box = FancyBboxPatch((x, y), w, h,
                             boxstyle=f"round,pad=0,rounding_size={rx}",
                             linewidth=lw, edgecolor=border, facecolor=bg,
                             linestyle=linestyle, zorder=2)
        ax.add_patch(box)
        return box

    # Card drawer helper
    def draw_card(x, y, w, h, title, sub, items=None, tag=None, bg='#FFFFFF', border='#CBD5E1', title_color='#0F172A'):
        draw_box(x, y, w, h, bg, border, lw=1.2, rx=0.5)
        
        # Header title
        ax.text(x + 0.6, y + h - 0.95, title, fontsize=10.0, fontweight='bold', color=title_color, zorder=5)
        if sub:
            ax.text(x + 0.6, y + h - 1.65, sub, fontsize=7.8, fontstyle='italic', color='#64748B', zorder=5)
        
        # Tag / partial badge
        if tag:
            tag_color = '#D97706' if tag.lower() == 'partial' else '#2563EB'
            tag_bg = '#FEF3C7' if tag.lower() == 'partial' else '#DBEAFE'
            tag_w = len(tag) * 0.28 + 0.7
            draw_box(x + w - tag_w - 0.5, y + h - 1.4, tag_w, 0.85, tag_bg, tag_color, lw=1, rx=0.3)
            ax.text(x + w - tag_w / 2 - 0.5, y + h - 0.97, tag, fontsize=7.0, fontweight='bold', color=tag_color, ha='center', va='center', zorder=6)

        if items:
            curr_y = y + h - 2.45
            for it in items:
                ax.text(x + 0.8, curr_y, f"- {it}", fontsize=7.8, color='#334155', zorder=5)
                curr_y -= 0.80

    # 1. Main Header Title
    ax.text(50, 97.6, "Clarix AI - System Architecture", fontsize=24, fontweight='bold', color='#0F172A', ha='center', va='center', zorder=10)
    ax.text(50, 95.8, "Zero-Trust Air-Gapped AI Agent Enclave  |  Cryptographic Tamper-Evident Ledger  |  Policy-Enforced Isolation",
            fontsize=12.0, color='#475569', ha='center', va='center', zorder=10)

    # Top Status Badges
    badges = [
        ("[AIR-GAP] PHYSICAL ISOLATION", "#DC2626", "#FEF2F2"),
        ("[LOOPBACK] 127.0.0.1 BINDING ONLY", "#2563EB", "#EFF6FF"),
        ("[ZERO-TRUST] NO EXTERNAL CALLS", "#059669", "#ECFDF5"),
        ("[TAMPER-EVIDENT] HMAC-SHA256 LEDGER", "#D97706", "#FFFBEB"),
    ]
    bx = 19.5
    for text, c_fg, c_bg in badges:
        bw = len(text) * 0.26 + 1.2
        draw_box(bx, 93.8, bw, 1.2, c_bg, c_fg, lw=1.2, rx=0.4)
        ax.text(bx + bw / 2, 94.4, text, fontsize=8.2, fontweight='bold', color=c_fg, ha='center', va='center', zorder=10)
        bx += bw + 1.2

    # 2. Outer Air-Gap Perimeter Bounding Box (Cross-Cutting Boundary)
    draw_box(1.5, 7.5, 97.0, 85.0, '#FFFFFF', '#DC2626', lw=3.0, rx=1.5, linestyle='--')
    ax.text(3.0, 91.2, "AIR-GAPPED: nothing leaves this machine  --  In-Process Socket Guard & Host nftables Boundary (Zero Network Egress)",
            fontsize=10.5, fontweight='bold', color='#DC2626', zorder=4)

    # -------------------------------------------------------------
    # FIVE VERTICAL ARCHITECTURAL COLUMNS (LEFT TO RIGHT FLOW)
    # Total Column Height = 56.0 (y from 34.0 to 90.0)
    # Gaps between columns = exactly 2.0 units
    # -------------------------------------------------------------

    # COLUMN 1: Operator Console (React 18 / Vite)
    c1_x, c1_y, c1_w, c1_h = 3.2, 34.0, 17.0, 56.0
    draw_box(c1_x, c1_y, c1_w, c1_h, C_BLUE_BG, C_BLUE_BORDER, lw=1.8, rx=1.0)
    ax.text(c1_x + 0.8, c1_y + c1_h - 1.4, "Operator Console", fontsize=12.5, fontweight='bold', color=C_BLUE_TITLE, zorder=4)
    ax.text(c1_x + 0.8, c1_y + c1_h - 2.5, "Frontend Web Client (React 18 / Vite on 127.0.0.1:5173)", fontsize=8.0, color='#475569', zorder=4)

    draw_card(c1_x + 0.6, 73.8, c1_w - 1.2, 12.4,
              "Interactive Secure Chat", "agentService.ts | AgentPage.tsx",
              ["Multi-turn conversational feed & history",
               "Real-time token streaming with syntax highlight",
               "Verifiable citation markers [n] to evidence",
               "Collapsible safety pipeline trace drawer",
               "Quick security test prompt presets",
               "Integrity status pills & posture metrics",
               "Fail-closed lock banner notifications"])

    draw_card(c1_x + 0.6, 60.6, c1_w - 1.2, 12.0,
              "Air-Gapped Voice Flow", "voiceService.ts | Whisper & Piper",
              ["Offline mic capture via browser MediaRecorder",
               "Live audio waveform visualizer & timer",
               "Keyboard shortcut (Ctrl+Shift+Space)",
               "In-memory processing (zero audio disk save)",
               "Offline Piper neural TTS auto-speak toggle",
               "Keyboard shortcut (Ctrl+Shift+S)",
               "Local voice selection, speed & volume"])

    draw_card(c1_x + 0.6, 47.4, c1_w - 1.2, 12.2,
              "Controlled Agent Cockpit", "agenticService.ts | ReAct Cockpit",
              ["Least-Privilege Role Selector (Researcher/Analyst/Operator)",
               "Plan-then-Act review gate with risk summary",
               "Interactive plan approval: Approve All / Reject",
               "Live ReAct step streaming view (think/act/observe)",
               "Immediate Operator Kill-Switch (HALT)",
               "Dry-Run preview diff mode (0 tools run)",
               "Step-by-step past run replay from audit log"])

    draw_card(c1_x + 0.6, 34.8, c1_w - 1.2, 11.6,
              "SOC Governance Consoles", "Security Operator Management Pages",
              ["Threat Monitor & Attack Simulator",
               "Policy Rule Manager (POL-001..008)",
               "Tool Permissions & Sandboxed Runner",
               "Human Approval Queue (Pending tokens)",
               "RAG Ingest & Knowledge Graph explorer",
               "Audit Ledger Verifier & Anchor Exporter",
               "Tamper Lockdown & Rebaseline Modal"])

    # COLUMN 2: API Gateway & Security Enclave
    c2_x, c2_y, c2_w, c2_h = 22.2, 34.0, 17.0, 56.0
    draw_box(c2_x, c2_y, c2_w, c2_h, C_RED_BG, C_RED_BORDER, lw=1.8, rx=1.0)
    ax.text(c2_x + 0.8, c2_y + c2_h - 1.4, "Security Enclave & Gateway", fontsize=12.5, fontweight='bold', color=C_RED_TITLE, zorder=4)
    ax.text(c2_x + 0.8, c2_y + c2_h - 2.5, "FastAPI / ASGI & Zero-Trust Pipeline (127.0.0.1:8000)", fontsize=8.0, color='#475569', zorder=4)

    draw_card(c2_x + 0.6, 76.4, c2_w - 1.2, 9.8,
              "API Gateway & Dispatcher", "web/asgi.py | web/core.py | routes.py",
              ["Unified Dispatcher (Framework-neutral ASGI)",
               "Strict Loopback Token Auth & CORS boundary",
               "Endpoint RateLimiter (per-minute limits)",
               "Strict JSON & Multipart size caps (10MB)",
               "Public /health endpoint (engine readiness)",
               "Fail-closed HTTP 423 on tamper lockdown"])

    draw_card(c2_x + 0.6, 63.6, c2_w - 1.2, 9.8,
              "Prompt Injection Scanner", "security/injection.py | SEC-03",
              ["12-Language Multilingual heuristic scanner",
               "Jailbreak, roleplay & DAN override detection",
               "System prompt extraction attack detector",
               "Delimiter & formatting injection traps",
               "Automated risk scoring (0-100) & tagging",
               "Immediate block & threat logging on high risk"])

    draw_card(c2_x + 0.6, 50.8, c2_w - 1.2, 11.8,
              "Policy Engine (POL-001..008)", "security/policy.py | PolicyDef",
              ["POL-001: Air-gap network egress hard deny",
               "POL-002: Restricted document access control",
               "POL-003: Prompt injection interception",
               "POL-004: Tool execution permissions & role checks",
               "POL-005: Sensitive data exfiltration & sink protection",
               "POL-006: Tamper lockdown & fail-closed security",
               "POL-007: Voice output TTS sanitization & redaction",
               "POL-008: Encrypted agent memory gate"])

    draw_card(c2_x + 0.6, 42.2, c2_w - 1.2, 7.6,
              "Taint Tracking & DLP Engine", "security/taint.py | TaintContext",
              ["Labels: PUBLIC / INTERNAL / CONFIDENTIAL / RESTRICTED",
               "Taint propagation through all transforms",
               "Sink validation (network, file, shell, db)",
               "Quarantine tagging on untrusted external data"])

    draw_card(c2_x + 0.6, 34.8, c2_w - 1.2, 6.6,
              "Approval Gate & Sanitizer", "approvals.py | security/sanitize.py",
              ["Human-in-the-Loop async token queue (5m timeout)",
               "Secret Redactor: API keys, tokens, local paths, IPs",
               "Internal <think> reasoning blocks stripped",
               "Observation poisoning & prompt injection filter"])

    # COLUMN 3: Agent Orchestrator & Reasoning Core
    c3_x, c3_y, c3_w, c3_h = 41.2, 34.0, 18.8, 56.0
    draw_box(c3_x, c3_y, c3_w, c3_h, C_PURPLE_BG, C_PURPLE_BORDER, lw=1.8, rx=1.0)
    ax.text(c3_x + 0.8, c3_y + c3_h - 1.4, "Agent Orchestrator & RAG Core", fontsize=12.5, fontweight='bold', color=C_PURPLE_TITLE, zorder=4)
    ax.text(c3_x + 0.8, c3_y + c3_h - 2.5, "Intent Classification, Retrieval, ReAct Loop & Verification", fontsize=8.0, color='#475569', zorder=4)

    draw_card(c3_x + 0.6, 77.2, c3_w - 1.2, 9.0,
              "Intent & Command Classifier", "clarix/intent.py",
              ["AST Regex Intent Classification (Query/Tool/Admin)",
               "Slash command parser (/rag list, ask, search, sources)",
               "Dynamic system prompt assembly with security rules",
               "Automatic RAG vs Agentic route optimization"])

    draw_card(c3_x + 0.6, 64.6, c3_w - 1.2, 11.6,
              "RAG Gate & Document Retriever", "rag/gate.py | rag/store.py | rag/embedder.py",
              ["Multi-format ingest: PDF, DOCX, PPTX, CSV, TXT, MD",
               "Dense neural embeddings (nomic-embed-text / hash)",
               "BM25 lexical search & reciprocal rank fusion",
               "Classification-tiered chunk filtering & quarantine drops",
               "Knowledge Graph entity-relation triplets",
               "Context builder with strict XML isolation markers"],
              tag="partial")

    draw_card(c3_x + 0.6, 49.0, c3_w - 1.2, 14.6,
              "Controlled ReAct Runner", "agentic/runner.py | agentic/roles.py",
              ["Least-Privilege Roles: Researcher / Analyst / Operator",
               "Signed capability tokens (HMAC-SHA256, 10m expiry)",
               "Model prompt isolation: out-of-role tools hidden",
               "Plan-then-Act structured decomposition & operator review",
               "Configurable ReAct loop: think -> act -> observe -> reflect",
               "Strict per-run budgets: max_steps, max_seconds, tool_calls",
               "Emergency kill-switch: aborts run & commits audit event",
               "One-click workflows: audit, cross-check, integrity report"])

    draw_card(c3_x + 0.6, 41.2, c3_w - 1.2, 6.8,
              "Sandboxed Tool Runtime", "tools/runtime.py | tools/sandbox.py",
              ["rag_search: Local vector & semantic chunk search",
               "file_reader: In-memory decrypted reading (safe sandbox)",
               "calculator: AST-parsed safe arithmetic expressions",
               "db_query: Read-only SQLite queries (SELECT only)",
               "system_info: Host telemetry & resource inspection",
               "shell: Allowlisted shell inspection (Operator role only)"])

    draw_card(c3_x + 0.6, 34.8, c3_w - 1.2, 5.4,
              "Evidence Verification Engine", "rag/verifier.py",
              ["Proposition extraction & source grounding check",
               "Lexical overlap & entity consistency scoring",
               "Re-planning retry on failure; tags [UNVERIFIED]"])

    # COLUMN 4: Local AI Engines & Speech
    c4_x, c4_y, c4_w, c4_h = 62.0, 34.0, 17.0, 56.0
    draw_box(c4_x, c4_y, c4_w, c4_h, C_INDIGO_BG, C_INDIGO_BORDER, lw=1.8, rx=1.0)
    ax.text(c4_x + 0.8, c4_y + c4_h - 1.4, "Local AI & Speech", fontsize=12.5, fontweight='bold', color=C_INDIGO_TITLE, zorder=4)
    ax.text(c4_x + 0.8, c4_y + c4_h - 2.5, "Ollama LLM & Air-Gapped Speech (127.0.0.1:11434)", fontsize=8.0, color='#475569', zorder=4)

    draw_card(c4_x + 0.6, 72.0, c4_w - 1.2, 14.2,
              "Local LLM Host (Ollama)", "llm/ollama.py | 127.0.0.1:11434",
              ["llama3:8b (Q4_K_M Default reasoning engine)",
               "mistral:7b & qwen:7b (Offline models)",
               "nomic-embed-text (Local dense embeddings)",
               "Strict loopback HTTP binding (127.0.0.1)",
               "Model capability & context introspection",
               "Real-time TPS, latency & throughput metrics",
               "Zero telemetry, tracking, or cloud calls",
               "Pre-staged air-gap model directory",
               "Deterministic temperature & seed settings"])

    draw_card(c4_x + 0.6, 51.5, c4_w - 1.2, 16.0,
              "Offline Whisper STT", "voice/transcriber.py | voice/manager.py",
              ["Local faster-whisper (CTranslate2 backend)",
               "whisper.cpp engine fallback for Windows",
               "Pre-staged model dir (CLARIX_WHISPER_MODEL_DIR)",
               "Zero runtime download; clear staging guides",
               "Worker thread non-blocking audio transcription",
               "In-memory processing (immediate raw audio wipe)",
               "Rate-limited endpoint (/api/voice/transcribe)",
               "Multilingual: English, Hindi, Kannada",
               "Transcript passes untrusted injection scan"])

    draw_card(c4_x + 0.6, 34.8, c4_w - 1.2, 15.5,
              "Offline Piper Neural TTS", "voice/synthesizer.py | voice/manager.py",
              ["Piper Neural TTS (local ONNX runtime)",
               "Pre-staged voices dir (CLARIX_TTS_VOICE_DIR)",
               "en_US-lessac-low offline voice pack",
               "POST /api/voice/speak returns audio/wav",
               "Worker thread synthesis; zero disk audio save",
               "Strict 2000 character synthesis safety limit",
               "Pre-synthesis secret redactor & policy gate",
               "Browser speechSynthesis fallback (localService only)",
               "Metadata-only audit logging (no text saved)"])

    # COLUMN 5: Local Storage & Data Layer
    c5_x, c5_y, c5_w, c5_h = 81.0, 34.0, 16.5, 56.0
    draw_box(c5_x, c5_y, c5_w, c5_h, C_GREEN_BG, C_GREEN_BORDER, lw=1.8, rx=1.0)
    ax.text(c5_x + 0.8, c5_y + c5_h - 1.4, "Data & Encrypted Storage", fontsize=12.5, fontweight='bold', color=C_GREEN_TITLE, zorder=4)
    ax.text(c5_x + 0.8, c5_y + c5_h - 2.5, "SQLite Engine & AES-256 Vault at Rest", fontsize=8.0, color='#475569', zorder=4)

    draw_card(c5_x + 0.6, 69.4, c5_w - 1.2, 16.8,
              "SQLite Database (clarix.db)", "db.py | Relational Schema",
              ["documents & document_chunks (RAG corpus)",
               "chunk_embeddings (Vector search indices)",
               "kg_entities & kg_relations (Knowledge graph)",
               "policies (Rule definitions & enforcements)",
               "tools (Permissions, risk tiers & roles)",
               "grants & approvals (Audit approval queue)",
               "threats (Logged prompt injection attempts)",
               "blocked_connections (Air-gap egress log)",
               "agent_runs (ReAct traces & step states)",
               "system_metrics (Telemetry & token counts)"])

    draw_card(c5_x + 0.6, 52.2, c5_w - 1.2, 16.2,
              "Encrypted Storage Vault", "security/crypto_storage.py",
              ["AES-256 / Fernet envelope encryption",
               "Local secret key derivation (.vault_key)",
               "Strict file access permissions (0o600)",
               "Workspace document encryption at rest",
               "Transparent in-memory decryption for tools",
               "Zero plaintext leakage to storage",
               "Cryptographic key source audit on startup",
               "Secure shredding of temporary buffers"])

    draw_card(c5_x + 0.6, 34.8, c5_w - 1.2, 16.4,
              "Encrypted Agent Memory", "agentic/memory.py | POL-008",
              ["Per-session working memory & persistent notes",
               "AES-256 Fernet ciphertext stored in SQLite",
               "Treated strictly as DATA, not instructions",
               "Bidirectional injection scan: on WRITE & READ",
               "Inherits source classification taint labels",
               "Operator 'Forget' button (cryptographic wipe)",
               "Full metadata audit for memory store & recall",
               "Policy toggle POL-008 memory gate enforcement"])

    # -------------------------------------------------------------
    # CROSS-CUTTING AUDIT & INTEGRITY TIER (BOTTOM ROW)
    # y from 19.5 to 32.3 (h = 12.8)
    # -------------------------------------------------------------
    t_x, t_y, t_w, t_h = 3.2, 19.5, 94.3, 12.8
    draw_box(t_x, t_y, t_w, t_h, C_AMBER_BG, C_AMBER_BORDER, lw=2.0, rx=1.0)
    ax.text(t_x + 1.0, t_y + t_h - 1.4, "Cross-Cutting Cryptographic Integrity & Audit Ledger Tier (POL-006 Tamper Lockdown)",
            fontsize=12.5, fontweight='bold', color=C_AMBER_TITLE, zorder=4)
    ax.text(t_x + 1.0, t_y + t_h - 2.5,
            "Complete Tamper Detection: Modification, Deletion, Reordering, Truncation, Rollback, Trigger Tampering & Direct SQLite Edits",
            fontsize=8.5, color='#78350F', zorder=4)

    # 4 Sub-boxes in the Integrity Tier
    sub_w = (t_w - 3.2) / 4.0
    
    # Tier Box 1: Keyed HMAC-SHA256 Chain
    draw_card(t_x + 0.6, t_y + 0.7, sub_w, 9.2,
              "Keyed Audit Hash Chain", "audit.py | audit_events table",
              ["Keyed HMAC-SHA256 immutable ledger",
               "Strict external secret key (.audit_key)",
               "Deterministic canonical JSON serialization",
               "SQLite append-only triggers:",
               "  - audit_no_update trigger (blocks UPDATE)",
               "  - audit_no_delete trigger (blocks DELETE)",
               "Tamper-detection verification utilities"])

    # Tier Box 2: External Signed Anchor
    draw_card(t_x + 0.6 + sub_w + 0.65, t_y + 0.7, sub_w, 9.2,
              "Signed External Anchor", "audit_anchor.json | External State",
              ["Anchors {event_count, head_hash, timestamp}",
               "Cryptographic signature via HMAC key",
               "Written atomically after every audit commit",
               "Catches tail row truncation immediately",
               "Catches entire database copy rollback",
               "Prevents forged rows without valid HMAC"])

    # Tier Box 3: Signed Security State & Lockdown
    draw_card(t_x + 0.6 + (sub_w + 0.65) * 2, t_y + 0.7, sub_w, 9.2,
              "Signed Security State", "integrity.py | Fail-Closed Lockdown",
              ["HMAC signature over policies + tools + grants",
               "Catches direct out-of-band SQLite edits",
               "Atomic state + signature synchronization",
               "Fail-Closed Lockdown (API HTTP 423 Locked)",
               "Persisted lockdown.json state file",
               "Operator rebaseline modal with justification"])

    # Tier Box 4: In-Process Egress Guard
    draw_card(t_x + 0.6 + (sub_w + 0.65) * 3, t_y + 0.7, sub_w, 9.2,
              "Egress Guard & Workflows", "airgap/guard.py | workflows.py",
              ["Monkey-patches socket.connect() at startup",
               "Monkey-patches getaddrinfo() DNS lookups",
               "Permits loopback only (127.0.0.1 / localhost)",
               "Drops & audits any external socket attempt",
               "Host nftables script (deploy/nftables-airgap.conf)",
               "Local scheduled runner (daily integrity report)"],
              tag="partial")

    # Audit emit lines: Vertical arrows from each column down to Integrity Tier
    audit_points = [
        (11.7, 34.0, "UI Audit Events"),
        (30.7, 34.0, "Policy & Threat Logs"),
        (50.6, 34.0, "ReAct Step Traces"),
        (70.5, 34.0, "Model & Voice Logs"),
        (89.2, 34.0, "DB & Key Access Logs")
    ]
    for px, py, plabel in audit_points:
        a_audit = FancyArrowPatch((px, py), (px, 32.3), connectionstyle="arc3,rad=0",
                                  color='#D97706', arrowstyle="-|>", mutation_scale=12, linewidth=1.5, linestyle=':', zorder=15)
        ax.add_patch(a_audit)
        ax.text(px, 33.15, plabel, fontsize=6.8, color='#B45309', ha='center', va='center',
                bbox=dict(boxstyle="round,pad=0.15", fc="#FFFBEB", ec="#FDE68A", lw=0.8), zorder=16)

    # -------------------------------------------------------------
    # NUMBERED BADGES & ARROWS (1 TO 7): THE LIFE OF ONE QUESTION
    # Placed with dedicated clearance - 0 border collisions!
    # -------------------------------------------------------------
    arrow_props = dict(arrowstyle="-|>", mutation_scale=16, linewidth=2.4, zorder=25)

    def draw_badge(cx, cy, num_str, col):
        c = Circle((cx, cy), 0.85, facecolor=col, edgecolor='#FFFFFF', linewidth=2.0, zorder=30)
        ax.add_patch(c)
        ax.text(cx, cy, num_str, fontsize=9.5, fontweight='bold', color='#FFFFFF', ha='center', va='center', zorder=31)

    # STEP 1: Ingress (Operator Console -> API Gateway)
    # Gap 1-2: x from 20.2 to 22.2. Center = 21.2
    a1 = FancyArrowPatch((20.2, 80.0), (22.2, 80.0), connectionstyle="arc3,rad=0", color='#2563EB', **arrow_props)
    ax.add_patch(a1)
    draw_badge(21.2, 81.8, "1", '#2563EB')
    ax.text(21.2, 83.3, "1. Ingress", fontsize=7.6, fontweight='bold', color='#2563EB', ha='center', va='center', zorder=31)

    # STEP 2: Security Gate (API Gateway -> Prompt Injection & Policy Engine)
    # Inside Column 2: Open gap between Card 1 (bottom = 76.4) and Card 2 (top = 73.4). Gap center = 74.9
    a2 = FancyArrowPatch((26.5, 76.4), (26.5, 73.4), connectionstyle="arc3,rad=0", color='#DC2626', **arrow_props)
    ax.add_patch(a2)
    draw_badge(26.5, 74.9, "2", '#DC2626')
    ax.text(32.0, 74.9, "2. Security Gate & Policies", fontsize=7.6, fontweight='bold', color='#DC2626', ha='center', va='center', zorder=31)

    # STEP 3: RAG Retrieval (Security Enclave -> Agent RAG Retriever)
    # Gap 2-3: x from 39.2 to 41.2. Center = 40.2
    a3 = FancyArrowPatch((39.2, 68.5), (41.2, 68.5), connectionstyle="arc3,rad=0", color='#7C3AED', **arrow_props)
    ax.add_patch(a3)
    draw_badge(40.2, 70.3, "3", '#7C3AED')
    ax.text(40.2, 71.8, "3. RAG Search", fontsize=7.6, fontweight='bold', color='#7C3AED', ha='center', va='center', zorder=31)

    # STEP 4: Context Assembly (RAG Retriever -> Data Storage -> Context Assembly)
    # Across Column 4 open corridor between Card 1 (bottom = 72.0) and Card 2 (top = 67.5). Center = 69.75
    a4 = FancyArrowPatch((60.0, 69.75), (81.0, 69.75), connectionstyle="arc3,rad=0", color='#059669', **arrow_props)
    ax.add_patch(a4)
    draw_badge(70.5, 69.75, "4", '#059669')
    ax.text(70.5, 71.1, "4. Context Assembly & Keyed Storage", fontsize=7.6, fontweight='bold', color='#059669', ha='center', va='center', zorder=31)

    # STEP 5: LLM Inference (ReAct Runner -> Ollama LLM Inference)
    # Gap 3-4: x from 60.0 to 62.0. Center = 61.0
    a5 = FancyArrowPatch((60.0, 55.0), (62.0, 55.0), connectionstyle="arc3,rad=0", color='#4F46E5', **arrow_props)
    ax.add_patch(a5)
    draw_badge(61.0, 56.8, "5", '#4F46E5')
    ax.text(61.0, 58.3, "5. Inference", fontsize=7.6, fontweight='bold', color='#4F46E5', ha='center', va='center', zorder=31)

    # STEP 6: Verification (ReAct Tool / LLM Generation -> Evidence Verifier)
    # Gap 3-4: x from 62.0 back to 60.0 at y=37.5. Center = 61.0
    a6 = FancyArrowPatch((62.0, 37.5), (60.0, 37.5), connectionstyle="arc3,rad=0", color='#7C3AED', **arrow_props)
    ax.add_patch(a6)
    draw_badge(61.0, 39.3, "6", '#7C3AED')
    ax.text(61.0, 40.8, "6. Verification", fontsize=7.6, fontweight='bold', color='#7C3AED', ha='center', va='center', zorder=31)

    # STEP 7: Response & Audit (Sanitizer & Output -> Client Response + Ledger)
    # From Column 2 left edge (x=22.2, y=37.5) back to Column 1 (x=20.2, y=37.5)
    a7 = FancyArrowPatch((22.2, 37.5), (20.2, 37.5), connectionstyle="arc3,rad=0", color='#2563EB', **arrow_props)
    ax.add_patch(a7)
    draw_badge(21.2, 39.3, "7", '#2563EB')
    ax.text(21.2, 40.8, "7. Response", fontsize=7.6, fontweight='bold', color='#2563EB', ha='center', va='center', zorder=31)

    # -------------------------------------------------------------
    # COMPREHENSIVE BOTTOM LEGEND
    # y from 8.5 to 18.5 (h = 10.0)
    # -------------------------------------------------------------
    leg_x, leg_y, leg_w, leg_h = 3.2, 8.5, 94.3, 10.0
    draw_box(leg_x, leg_y, leg_w, leg_h, '#F8FAFC', '#94A3B8', lw=1.2, rx=0.8)
    ax.text(leg_x + 1.2, leg_y + leg_h - 1.2, "SYSTEM ARCHITECTURE LEGEND & QUESTION LIFECYCLE (STEPS 1 - 7)",
            fontsize=10.5, fontweight='bold', color='#0F172A', zorder=5)

    # Column A: Steps 1-4
    l_c1 = leg_x + 1.2
    ax.text(l_c1, leg_y + 7.0, "(1) Ingress & Speech: Operator types prompt in React UI or dictates via offline Whisper STT -> API Gateway.", fontsize=7.8, color='#1E293B', zorder=5)
    ax.text(l_c1, leg_y + 5.2, "(2) Security Gate: Ingress injection scan (SEC-03), POL-001..008 policy evaluations, TaintContext init.", fontsize=7.8, color='#1E293B', zorder=5)
    ax.text(l_c1, leg_y + 3.4, "(3) RAG Retrieval: Retrieval gate runs vector + lexical search over encrypted files; quarantines unsafe chunks.", fontsize=7.8, color='#1E293B', zorder=5)
    ax.text(l_c1, leg_y + 1.6, "(4) Context Assembly: Wraps retrieved docs in XML isolation tags; derives signed role capability token.", fontsize=7.8, color='#1E293B', zorder=5)

    # Column B: Steps 5-7 & Audit
    l_c2 = leg_x + 36.5
    ax.text(l_c2, leg_y + 7.0, "(5) LLM Inference & ReAct: Local Ollama queried on loopback (127.0.0.1); tools gated by role tokens & budgets.", fontsize=7.8, color='#1E293B', zorder=5)
    ax.text(l_c2, leg_y + 5.2, "(6) Evidence Verification: Evidence Verifier validates factual claims against sources; triggers re-plan if unverified.", fontsize=7.8, color='#1E293B', zorder=5)
    ax.text(l_c2, leg_y + 3.4, "(7) Sanitization & Ledger: Secrets redacted, citations [n] attached, full event committed to HMAC-SHA256 ledger.", fontsize=7.8, color='#1E293B', zorder=5)
    ax.text(l_c2, leg_y + 1.6, "::: Audit Event Feeds: Every subsystem emits tamper-evident records into append-only SQLite triggers.", fontsize=7.8, color='#B45309', zorder=5)

    # Column C: Color Palette Swatches & Status
    l_c3 = leg_x + 72.0
    swatches = [
        (7.0, '#1D4ED8', '#EFF6FF', "Blue: Operator Console & API Gateway Layer"),
        (5.6, '#B91C1C', '#FEF2F2', "Red: Zero-Trust Security Enclave & Policy Gates"),
        (4.2, '#6D28D9', '#FAF5FF', "Purple: Agent Orchestrator & Reasoning Core"),
        (2.8, '#4338CA', '#EEF2FF', "Indigo: Local AI Host (Ollama) & Offline Speech"),
        (1.4, '#047857', '#ECFDF5', "Green: Data Layer & AES-256 Storage Vault"),
        (0.0, '#B45309', '#FFFBEB', "Amber: Cryptographic Integrity & Egress Guard"),
    ]
    for dy, col_border, col_bg, label in swatches:
        draw_box(l_c3, leg_y + dy, 1.2, 0.9, col_bg, col_border, lw=1.2, rx=0.2)
        ax.text(l_c3 + 1.8, leg_y + dy + 0.45, label, fontsize=7.6, fontweight='bold', color='#1E293B', va='center', zorder=5)

    # Partial Tag Explanation in Legend
    draw_box(leg_x + leg_w - 9.5, leg_y + 0.5, 8.8, 1.3, '#FEF3C7', '#D97706', lw=1, rx=0.3)
    ax.text(leg_x + leg_w - 5.1, leg_y + 1.15, "partial: partial in code", fontsize=7.2, fontweight='bold', color='#D97706', ha='center', va='center', zorder=6)

    # Save high-resolution PNG
    output_path = "Clarix_Architecture.png"
    plt.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
    fig.savefig(output_path, dpi=100, facecolor='#FFFFFF', edgecolor='none')
    plt.close(fig)
    print(f"Generated {output_path}")

if __name__ == '__main__':
    build_diagram()
