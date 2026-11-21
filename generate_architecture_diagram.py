"""Generates high-resolution publication-quality architecture diagram for Clarix AI."""
import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Circle, Rectangle

def build_diagram():
    fig_w, fig_h = 38, 25
    fig, ax = plt.subplots(figsize=(fig_w, fig_h), dpi=100)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    # Background
    fig.patch.set_facecolor('#FFFFFF')
    ax.set_facecolor('#FFFFFF')

    # Color Palette
    C_BLUE_BG = '#F0F6FF'
    C_BLUE_BORDER = '#2563EB'
    C_BLUE_TITLE = '#1E40AF'
    C_BLUE_CARD = '#FFFFFF'

    C_CYAN_BG = '#ECFEFF'
    C_CYAN_BORDER = '#0891B2'
    C_CYAN_TITLE = '#0E7490'

    C_RED_BG = '#FEF2F2'
    C_RED_BORDER = '#DC2626'
    C_RED_TITLE = '#991B1B'
    C_RED_CARD = '#FFFFFF'

    C_PURPLE_BG = '#FAF5FF'
    C_PURPLE_BORDER = '#7C3AED'
    C_PURPLE_TITLE = '#5B21B6'
    C_PURPLE_CARD = '#FFFFFF'

    C_INDIGO_BG = '#EEF2FF'
    C_INDIGO_BORDER = '#4F46E5'
    C_INDIGO_TITLE = '#3730A3'
    C_INDIGO_CARD = '#FFFFFF'

    C_GREEN_BG = '#ECFDF5'
    C_GREEN_BORDER = '#059669'
    C_GREEN_TITLE = '#065F46'
    C_GREEN_CARD = '#FFFFFF'

    C_AMBER_BG = '#FFFBEB'
    C_AMBER_BORDER = '#D97706'
    C_AMBER_TITLE = '#92400E'
    C_AMBER_CARD = '#FFFFFF'

    # Helper for rounded boxes
    def draw_box(x, y, w, h, bg, border, lw=1.5, rx=0.8, linestyle='-'):
        box = FancyBboxPatch((x, y), w, h,
                             boxstyle=f"round,pad=0,rounding_size={rx}",
                             linewidth=lw, edgecolor=border, facecolor=bg,
                             linestyle=linestyle, zorder=2)
        ax.add_patch(box)
        return box

    def draw_card(x, y, w, h, title, sub, items=None, tag=None, bg=C_BLUE_CARD, border='#CBD5E1', title_color='#0F172A', badge_tone=None):
        draw_box(x, y, w, h, bg, border, lw=1.2, rx=0.5)
        
        # Header text
        ax.text(x + 0.6, y + h - 0.9, title, fontsize=10.5, fontweight='bold', color=title_color, zorder=5)
        if sub:
            ax.text(x + 0.6, y + h - 1.55, sub, fontsize=8.0, fontstyle='italic', color='#64748B', zorder=5)
        
        # Tag / partial badge
        if tag:
            tag_color = '#D97706' if tag.lower() == 'partial' else '#2563EB'
            tag_bg = '#FEF3C7' if tag.lower() == 'partial' else '#DBEAFE'
            tag_w = len(tag) * 0.28 + 0.7
            draw_box(x + w - tag_w - 0.4, y + h - 1.3, tag_w, 0.9, tag_bg, tag_color, lw=1, rx=0.3)
            ax.text(x + w - tag_w / 2 - 0.4, y + h - 0.85, tag, fontsize=7.2, fontweight='bold', color=tag_color, ha='center', va='center', zorder=6)

        if items:
            curr_y = y + h - 2.2
            for it in items:
                ax.text(x + 0.8, curr_y, f"• {it}", fontsize=8.2, color='#334155', zorder=5)
                curr_y -= 0.85

    # 1. Main Header Title
    ax.text(50, 97.6, "Clarix AI — System Architecture", fontsize=24, fontweight='bold', color='#0F172A', ha='center', va='center', zorder=10)
    ax.text(50, 95.8, "Zero-Trust Air-Gapped AI Agent Enclave • Cryptographic Tamper-Evident Ledger • Policy-Enforced Isolation",
            fontsize=12.5, color='#475569', ha='center', va='center', zorder=10)

    # Top Status Badges
    badges = [
        ("🔒 PHYSICAL AIR-GAP", "#DC2626", "#FEF2F2"),
        ("⚡ LOCAL LOOPBACK ONLY (127.0.0.1)", "#2563EB", "#EFF6FF"),
        ("🛡️ ZERO EXTERNAL DEPENDENCIES", "#059669", "#ECFDF5"),
        ("📜 HMAC-SHA256 AUDIT LEDGER", "#D97706", "#FFFBEB"),
    ]
    bx = 20.0
    for text, c_fg, c_bg in badges:
        bw = len(text) * 0.26 + 1.2
        draw_box(bx, 93.8, bw, 1.2, c_bg, c_fg, lw=1.2, rx=0.4)
        ax.text(bx + bw / 2, 94.4, text, fontsize=8.5, fontweight='bold', color=c_fg, ha='center', va='center', zorder=10)
        bx += bw + 1.2

    # 2. Outer Air-Gap Perimeter Bounding Box (Cross-Cutting Boundary)
    draw_box(1.5, 7.5, 97.0, 85.0, '#FFFFFF', '#DC2626', lw=3.0, rx=1.5, linestyle='--')
    ax.text(3.0, 91.2, "AIR-GAPPED SYSTEM BOUNDARY — In-Process Socket Guard & Host nftables Boundary (Zero Egress to Network)",
            fontsize=10.5, fontweight='bold', color='#DC2626', zorder=4)

    # -------------------------------------------------------------
    # FIVE VERTICAL ARCHITECTURAL COLUMNS (LEFT TO RIGHT FLOW)
    # -------------------------------------------------------------

    # COLUMN 1: Operator Console (React 18 / Vite)
    c1_x, c1_y, c1_w, c1_h = 3.0, 34.0, 17.5, 56.0
    draw_box(c1_x, c1_y, c1_w, c1_h, C_BLUE_BG, C_BLUE_BORDER, lw=1.8, rx=1.0)
    ax.text(c1_x + 0.8, c1_y + c1_h - 1.4, "Operator Console", fontsize=13, fontweight='bold', color=C_BLUE_TITLE, zorder=4)
    ax.text(c1_x + 0.8, c1_y + c1_h - 2.5, "Frontend Web Client (React 18 / Vite on 127.0.0.1:5173)", fontsize=8.5, color='#475569', zorder=4)

    draw_card(c1_x + 0.7, c1_y + 43.5, c1_w - 1.4, 8.8,
              "Interactive Secure Chat", "agentService.ts • AgentPage.tsx",
              ["Multi-turn conversational feed", "Streaming response rendering", "Evidence citation markers [n]", "Safety pipeline trace drawer", "Quick security prompt presets"])

    draw_card(c1_x + 0.7, c1_y + 33.2, c1_w - 1.4, 9.3,
              "Air-Gapped Voice Flow", "voiceService.ts • Whisper & Piper",
              ["Offline Whisper STT mic capture", "Live audio waveform & timer", "Zero audio disk retention", "Offline Piper neural TTS toggle", "Speed & volume local controls"])

    draw_card(c1_x + 0.7, c1_y + 19.5, c1_w - 1.4, 12.8,
              "Controlled Agent Cockpit", "agenticService.ts • ReAct Cockpit",
              ["Role Selector (Least Privilege)", "Plan-then-Act approval review", "Live ReAct step streaming view", "Immediate Kill-Switch (STOP)", "Dry-run preview diff drawer", "Step-by-step past run replay", "One-click built-in workflows"])

    draw_card(c1_x + 0.7, c1_y + 1.2, c1_w - 1.4, 17.2,
              "SOC Governance Pages", "SOC Operator Management Consoles",
              ["Threat Monitor & Attack Simulator", "Policy Manager (POL-001..008)", "Tool Permissions & Sandbox execution", "Human Approval Queue (Pending requests)", "RAG Ingest & Knowledge Graph explorer", "Taint Tracking & Data Leak Scenarios", "Egress Monitor (Zero egress proofs)", "Audit Ledger & Chain Verifier", "Tamper Lockdown & Rebaseline Modal"])

    # COLUMN 2: API Gateway & Security Enclave
    c2_x, c2_y, c2_w, c2_h = 21.8, 34.0, 18.2, 56.0
    draw_box(c2_x, c2_y, c2_w, c2_h, C_RED_BG, C_RED_BORDER, lw=1.8, rx=1.0)
    ax.text(c2_x + 0.8, c2_y + c2_h - 1.4, "Security Enclave & Gateway", fontsize=13, fontweight='bold', color=C_RED_TITLE, zorder=4)
    ax.text(c2_x + 0.8, c2_y + c2_h - 2.5, "FastAPI / ASGI & Zero-Trust Pipeline (127.0.0.1:8000)", fontsize=8.5, color='#475569', zorder=4)

    draw_card(c2_x + 0.7, c2_y + 44.5, c2_w - 1.4, 7.8,
              "API Gateway & Dispatcher", "web/asgi.py • web/core.py • routes.py",
              ["Unified Dispatcher (Framework-neutral)", "Token Authentication & Dev loopback", "Endpoint RateLimiter (per-min caps)", "Strict JSON & Multipart size limits", "Public /health endpoint"])

    draw_card(c2_x + 0.7, c2_y + 34.0, c2_w - 1.4, 9.5,
              "Prompt Injection Scanner", "security/injection.py • SEC-03",
              ["12-Language Multilingual heuristics", "System prompt extraction detector", "Delimiter & formatting injection traps", "Roleplay override & jailbreak filters", "Risk scoring (0-100) & Category tagging"])

    draw_card(c2_x + 0.7, c2_y + 22.8, c2_w - 1.4, 10.2,
              "Policy Engine (POL-001..008)", "security/policy.py • PolicyDef",
              ["POL-001: Air-gap network egress deny", "POL-002: Restricted document access", "POL-003: Prompt injection interception", "POL-004: Tool execution permission", "POL-005: Data exfiltration & sinks deny", "POL-006: Voice input STT boundaries", "POL-007: Voice output TTS sanitization", "POL-008: Encrypted agent memory gate"])

    draw_card(c2_x + 0.7, c2_y + 12.0, c2_w - 1.4, 9.8,
              "Taint Tracking & DLP Engine", "security/taint.py • TaintContext",
              ["Classification labels: PUBLIC / INTERNAL", "Classified labels: CONFIDENTIAL / RESTRICTED", "Taint propagation through all transforms", "Sink policy validation (network, file, db)", "Quarantine tagging on untrusted data"])

    draw_card(c2_x + 0.7, c2_y + 1.2, c2_w - 1.4, 9.8,
              "Approval Gate & Output Redactor", "approvals.py • security/sanitize.py",
              ["Async Human-in-the-Loop queue", "Operator token & 5-min timeout", "Secret Redactor (keys, tokens, IPs)", "Thinking blocks removal (<think> tags)", "Observation poisoning protection"])

    # COLUMN 3: Agent Orchestrator & Reasoning Core
    c3_x, c3_y, c3_w, c3_h = 41.2, 34.0, 21.0, 56.0
    draw_box(c3_x, c3_y, c3_w, c3_h, C_PURPLE_BG, C_PURPLE_BORDER, lw=1.8, rx=1.0)
    ax.text(c3_x + 0.8, c3_y + c3_h - 1.4, "Agent Orchestrator & RAG Core", fontsize=13, fontweight='bold', color=C_PURPLE_TITLE, zorder=4)
    ax.text(c3_x + 0.8, c3_y + c3_h - 2.5, "Intent Classification, Retrieval, ReAct Loop & Verification", fontsize=8.5, color='#475569', zorder=4)

    draw_card(c3_x + 0.7, c3_y + 44.5, c3_w - 1.4, 7.8,
              "Intent & Task Classifier", "clarix/intent.py",
              ["Regex AST Intent Categorization", "RAG query vs Tool exec vs Admin", "Command parser (/rag list, ask, search)", "Automatic prompt route optimization"])

    draw_card(c3_x + 0.7, c3_y + 32.5, c3_w - 1.4, 11.0,
              "RAG Gate & Document Retriever", "rag/gate.py • rag/store.py • rag/embedder.py",
              ["Multi-format ingest (PDF, DOCX, PPTX, CSV, MD)", "Neural embeddings (nomic-embed-text / hash)", "BM25 Lexical search & score fusion", "Classification-tiered chunk filtering", "Quarantined chunk interception & drop", "Knowledge Graph triplet context", "graph.py"], tag="partial")

    draw_card(c3_x + 0.7, c3_y + 17.5, c3_w - 1.4, 14.0,
              "Controlled ReAct Runner", "agentic/runner.py • agentic/roles.py",
              ["Least-Privilege Roles: Researcher / Analyst / Operator", "Signed Capability Tokens (HMAC-SHA256, expiring)", "Model Prompt Isolation (out-of-role tools hidden)", "Plan-then-Act pre-evaluation & approval gate", "Configurable ReAct loop (think -> act -> observe -> reflect)", "Per-run Budgets: max_steps, max_seconds, max_tool_calls", "Emergency Kill-Switch (instant halt & ledger commit)"])

    draw_card(c3_x + 0.7, c3_y + 8.5, c3_w - 1.4, 8.2,
              "Sandboxed Tool Runtime", "tools/runtime.py • tools/sandbox.py",
              ["rag_search: Local vector search", "file_reader: In-memory decrypted reading", "calculator: Safe AST arithmetic expression", "db_query: Read-only SQLite SELECT queries", "system_info: Local environment telemetry", "shell: Allowlisted inspection with win32 shims"])

    draw_card(c3_x + 0.7, c3_y + 1.2, c3_w - 1.4, 6.5,
              "Evidence Verification Engine", "rag/verifier.py (Box 3 in Architecture)",
              ["Claim proposition extractor & Source citation checker", "Lexical overlap & entity consistency scoring", "Iterative rewrite re-planning retry loop", "Fallback to [UNVERIFIED] / Untrusted response"])

    # COLUMN 4: Local AI Engines & Speech
    c4_x, c4_y, c4_w, c4_h = 63.4, 34.0, 16.5, 56.0
    draw_box(c4_x, c4_y, c4_w, c4_h, C_INDIGO_BG, C_INDIGO_BORDER, lw=1.8, rx=1.0)
    ax.text(c4_x + 0.8, c4_y + c4_h - 1.4, "Local AI & Speech", fontsize=13, fontweight='bold', color=C_INDIGO_TITLE, zorder=4)
    ax.text(c4_x + 0.8, c4_y + c4_h - 2.5, "Ollama LLM & Air-Gapped Speech (127.0.0.1:11434)", fontsize=8.5, color='#475569', zorder=4)

    draw_card(c4_x + 0.7, c4_y + 35.5, c4_w - 1.4, 16.8,
              "Local LLM Host (Ollama)", "llm/ollama.py • 127.0.0.1:11434",
              ["llama3:8b (Q4_K_M Default)", "mistral:7b (Q4_0 Option)", "qwen:7b (Q4_K_M Option)", "nomic-embed-text (Embeddings)", "Strict Loopback HTTP binding", "Model capability introspection", "TPS & latency evaluation metrics", "Zero telemetry or phone-home", "Air-gapped model staging dir"])

    draw_card(c4_x + 0.7, c4_y + 18.0, c4_w - 1.4, 16.5,
              "Offline Whisper STT", "voice/transcriber.py • voice/manager.py",
              ["faster-whisper (CTranslate2)", "whisper.cpp engine fallback", "Local model staging folder", "Zero network download at runtime", "In-memory audio processing", "Immediate raw audio wipe", "Rate limited & audited metadata", "English + Hindi + Kannada support", "Voice injection threat scanning"])

    draw_card(c4_x + 0.7, c4_y + 1.2, c4_w - 1.4, 15.8,
              "Offline Piper TTS", "voice/synthesizer.py • voice/manager.py",
              ["Piper Neural TTS (ONNX)", "Local voice folder staging", "en_US-lessac-low offline voice", "Max 2000 character boundary", "Worker thread synthesis", "Zero synthesized audio retention", "Pre-synthesis secret redactor", "Browser speechSynthesis fallback", "(localService===true only)"])

    # COLUMN 5: Local Storage & Data Layer
    c5_x, c5_y, c5_w, c5_h = 81.0, 34.0, 16.5, 56.0
    draw_box(c5_x, c5_y, c5_w, c5_h, C_GREEN_BG, C_GREEN_BORDER, lw=1.8, rx=1.0)
    ax.text(c5_x + 0.8, c5_y + c5_h - 1.4, "Data & Encrypted Storage", fontsize=13, fontweight='bold', color=C_GREEN_TITLE, zorder=4)
    ax.text(c5_x + 0.8, c5_y + c5_h - 2.5, "SQLite Engine & AES-256 Vault at Rest", fontsize=8.5, color='#475569', zorder=4)

    draw_card(c5_x + 0.7, c5_y + 35.0, c5_w - 1.4, 17.5,
              "SQLite Database (clarix.db)", "db.py • Relational Engine",
              ["documents & document chunks", "chunk_embeddings (vectors)", "kg_entities & kg_relations", "policies (enabled, enforcements)", "tools (permissions & levels)", "grants & approvals queue", "threats (logged injection attacks)", "blocked_connections (egress log)", "agent_runs (ReAct traces)", "counters & system telemetry"])

    draw_card(c5_x + 0.7, c5_y + 18.0, c5_w - 1.4, 16.0,
              "Encrypted Storage Vault", "security/crypto_storage.py (Box 6)",
              ["AES-256 / Fernet envelope encryption", "Automatic key derivation (.vault_key)", "File permissions locked (0o600)", "Workspace document encryption", "In-memory transparent decryption", "Zero plaintext leakage at rest", "Cryptographic key source audit"])

    draw_card(c5_x + 0.7, c5_y + 1.2, c5_w - 1.4, 15.8,
              "Encrypted Agent Memory", "agentic/memory.py • POL-008",
              ["Per-session encrypted working notes", "Long-term persistent memories", "AES-256 Fernet ciphertext in SQLite", "Injection scanned on WRITE", "Injection scanned on READ", "Classification taint inheritance", "Operator 'Forget' wipe action", "Audited storage & recall operations"])

    # -------------------------------------------------------------
    # CROSS-CUTTING AUDIT & INTEGRITY TIER (BOTTOM ROW)
    # -------------------------------------------------------------
    t_x, t_y, t_w, t_h = 3.0, 19.5, 94.5, 12.8
    draw_box(t_x, t_y, t_w, t_h, C_AMBER_BG, C_AMBER_BORDER, lw=2.0, rx=1.0)
    ax.text(t_x + 1.0, t_y + t_h - 1.5, "Cross-Cutting Cryptographic Integrity & Audit Ledger Tier (POL-006 Tamper Lockdown)",
            fontsize=13, fontweight='bold', color=C_AMBER_TITLE, zorder=4)
    ax.text(t_x + 1.0, t_y + t_h - 2.6,
            "Complete Tamper-Detection for Row Modification, Deletion, Reordering, Truncation, Rollback, Trigger Tampering & Direct DB Edits",
            fontsize=9.0, color='#78350F', zorder=4)

    # 4 Sub-boxes in the Integrity Tier
    sub_w = (t_w - 3.5) / 4.0
    
    # Tier Box 1: Keyed HMAC-SHA256 Chain
    draw_card(t_x + 0.7, t_y + 0.8, sub_w, 9.0,
              "Keyed Audit Hash Chain", "audit.py • audit_events table",
              ["HMAC-SHA256 keyed ledger chain", "Strict external key (.audit_key)", "Canonical JSON serialization", "Append-only SQLite triggers:", "  - audit_no_update trigger", "  - audit_no_delete trigger", "Chain upgrade migration support"])

    # Tier Box 2: External Signed Anchor
    draw_card(t_x + 0.7 + sub_w + 0.7, t_y + 0.8, sub_w, 9.0,
              "Signed External Anchor", "audit_anchor.json • File Anchor",
              ["Anchors {count, head_hash, ts}", "Signed via HMAC secret key", "Written after every audit append", "Catches tail row truncation", "Catches database copy rollback", "Prevents forged row appending"])

    # Tier Box 3: Signed Security State & Lockdown
    draw_card(t_x + 0.7 + (sub_w + 0.7) * 2, t_y + 0.8, sub_w, 9.0,
              "Signed Security State", "integrity.py • Fail-Closed Lockdown",
              ["HMAC over policies + tools + grants", "Detects direct out-of-band DB edits", "Atomic state + signature commits", "Fail-Closed LOCKDOWN (HTTP 423)", "Persisted lockdown.json state", "Separate hash-chained incidents.log"])

    # Tier Box 4: In-Process Egress Guard
    draw_card(t_x + 0.7 + (sub_w + 0.7) * 3, t_y + 0.8, sub_w, 9.0,
              "Egress Guard & Scheduler", "airgap/guard.py • workflows.py",
              ["Monkey-patches socket.connect()", "Monkey-patches getaddrinfo()", "Enforces loopback 127.0.0.1 only", "Drops and audits external packets", "Host nftables script (deploy/)", "Local single-concurrency scheduler"], tag="partial")

    # -------------------------------------------------------------
    # NUMBERED ARROWS (1 TO 7): THE LIFE OF ONE QUESTION
    # -------------------------------------------------------------
    arrow_props = dict(arrowstyle="-|>", mutation_scale=18, linewidth=2.5, zorder=20)
    
    def draw_numbered_badge(cx, cy, num, label=""):
        c = Circle((cx, cy), 1.1, facecolor='#DC2626', edgecolor='#FFFFFF', linewidth=2.0, zorder=25)
        ax.add_patch(c)
        ax.text(cx, cy, str(num), fontsize=11, fontweight='bold', color='#FFFFFF', ha='center', va='center', zorder=26)
        if label:
            ax.text(cx, cy - 1.8, label, fontsize=8.0, fontweight='bold', color='#DC2626', ha='center', va='center', zorder=26)

    # Path 1: User Console -> API Gateway
    a1 = FancyArrowPatch((20.5, 78.0), (21.8, 78.0), connectionstyle="arc3,rad=0", color='#2563EB', **arrow_props)
    ax.add_patch(a1)
    draw_numbered_badge(21.1, 79.5, 1, "Ingress")

    # Path 2: API Gateway -> Security Harness (Prompt Injection & Policy Check)
    a2 = FancyArrowPatch((30.9, 70.0), (30.9, 68.0), connectionstyle="arc3,rad=0", color='#DC2626', **arrow_props)
    ax.add_patch(a2)
    draw_numbered_badge(33.2, 69.0, 2, "Security Gate")

    # Path 3: Security Harness -> RAG Retriever & Document DB
    a3 = FancyArrowPatch((40.0, 68.0), (41.2, 68.0), connectionstyle="arc3,rad=0", color='#7C3AED', **arrow_props)
    ax.add_patch(a3)
    draw_numbered_badge(40.6, 69.8, 3, "RAG Retrieval")

    # Path 4: RAG Retriever -> Encrypted Store -> Context Builder
    a4 = FancyArrowPatch((62.2, 68.0), (81.0, 68.0), connectionstyle="arc3,rad=-0.15", color='#059669', **arrow_props)
    ax.add_patch(a4)
    draw_numbered_badge(71.5, 71.5, 4, "Context Assembly")

    # Path 5: Context Assembly -> Ollama LLM Inference & Sandboxed Tool Loop
    a5 = FancyArrowPatch((51.7, 50.0), (63.4, 50.0), connectionstyle="arc3,rad=0", color='#4F46E5', **arrow_props)
    ax.add_patch(a5)
    draw_numbered_badge(57.5, 51.5, 5, "LLM Inference")

    # Path 6: Tool Output / LLM Generation -> Evidence Verifier & Sanitizer
    a6 = FancyArrowPatch((51.7, 39.0), (40.0, 39.0), connectionstyle="arc3,rad=0", color='#7C3AED', **arrow_props)
    ax.add_patch(a6)
    draw_numbered_badge(45.5, 40.5, 6, "Verification")

    # Path 7: Sanitizer -> Client Response & Audit Ledger Commit
    a7 = FancyArrowPatch((21.8, 40.0), (20.5, 40.0), connectionstyle="arc3,rad=0", color='#2563EB', **arrow_props)
    ax.add_patch(a7)
    draw_numbered_badge(21.1, 41.5, 7, "Response & Audit")

    # Audit emit lines (Vertical lines feeding into Integrity Tier)
    for emit_x, label in [(11.5, "UI Events"), (31.0, "Policy Decisions"), (51.5, "ReAct Steps"), (71.5, "Inference"), (89.0, "Storage & Grants")]:
        a_audit = FancyArrowPatch((emit_x, 34.0), (emit_x, 32.3), connectionstyle="arc3,rad=0",
                                  color='#D97706', arrowstyle="-|>", mutation_scale=12, linewidth=1.5, linestyle=':', zorder=15)
        ax.add_patch(a_audit)

    # -------------------------------------------------------------
    # COMPREHENSIVE BOTTOM LEGEND
    # -------------------------------------------------------------
    leg_x, leg_y, leg_w, leg_h = 3.0, 8.5, 94.5, 9.8
    draw_box(leg_x, leg_y, leg_w, leg_h, '#F8FAFC', '#94A3B8', lw=1.2, rx=0.8)
    ax.text(leg_x + 1.2, leg_y + leg_h - 1.2, "SYSTEM ARCHITECTURE LEGEND & QUESTION LIFECYCLE (STEPS 1 – 7)",
            fontsize=10.5, fontweight='bold', color='#0F172A', zorder=5)

    # 4 Columns in Legend
    # Column A: Steps 1-4
    l_c1 = leg_x + 1.2
    ax.text(l_c1, leg_y + 6.8, "① Ingress & Speech: Operator types in React or speaks via offline Whisper STT -> API Gateway.", fontsize=8.0, color='#1E293B', zorder=5)
    ax.text(l_c1, leg_y + 5.0, "② Security Gate: Ingress injection scan (SEC-03), POL-001..008 evaluation, TaintContext init.", fontsize=8.0, color='#1E293B', zorder=5)
    ax.text(l_c1, leg_y + 3.2, "③ RAG Retrieval: Gate performs vector + lexical search over encrypted files; quarantines unsafe chunks.", fontsize=8.0, color='#1E293B', zorder=5)
    ax.text(l_c1, leg_y + 1.4, "④ Context Assembly: Encapsulates untrusted docs into XML tags; derives signed role capability token.", fontsize=8.0, color='#1E293B', zorder=5)

    # Column B: Steps 5-7
    l_c2 = leg_x + 36.5
    ax.text(l_c2, leg_y + 6.8, "⑤ LLM Inference & ReAct: Ollama queried on loopback; tools gated by role capability token & budgets.", fontsize=8.0, color='#1E293B', zorder=5)
    ax.text(l_c2, leg_y + 5.0, "⑥ Evidence Verification: Claim propositions verified against sources; re-plans if unverified.", fontsize=8.0, color='#1E293B', zorder=5)
    ax.text(l_c2, leg_y + 3.2, "⑦ Sanitization & Ledger: Secrets redacted, citations [n] returned, full event committed to HMAC ledger.", fontsize=8.0, color='#1E293B', zorder=5)
    ax.text(l_c2, leg_y + 1.4, "::: Audit Event Feeds: Every subsystem emits tamper-evident records into append-only SQLite triggers.", fontsize=8.0, color='#B45309', zorder=5)

    # Column C: Layer & Color Codes
    l_c3 = leg_x + 72.0
    ax.text(l_c3, leg_y + 6.8, "■ Blue: User / Operator UI Client & API Layer", fontsize=8.0, fontweight='bold', color='#1D4ED8', zorder=5)
    ax.text(l_c3, leg_y + 5.3, "■ Red: Zero-Trust Security Enclave & Gates", fontsize=8.0, fontweight='bold', color='#B91C1C', zorder=5)
    ax.text(l_c3, leg_y + 3.8, "■ Purple: Controlled Agent Reasoning Core", fontsize=8.0, fontweight='bold', color='#6D28D9', zorder=5)
    ax.text(l_c3, leg_y + 2.3, "■ Green: Encrypted Storage Vault & SQLite", fontsize=8.0, fontweight='bold', color='#047857', zorder=5)
    ax.text(l_c3, leg_y + 0.8, "■ Amber: Cryptographic Integrity & Egress Guard", fontsize=8.0, fontweight='bold', color='#B45309', zorder=5)

    # Tags Explanation
    draw_box(leg_x + leg_w - 7.5, leg_y + 0.6, 6.8, 1.4, '#FEF3C7', '#D97706', lw=1, rx=0.3)
    ax.text(leg_x + leg_w - 4.1, leg_y + 1.3, "partial: partial in code", fontsize=7.2, fontweight='bold', color='#D97706', ha='center', va='center', zorder=6)

    # Save output
    output_path = "Clarix_Architecture.png"
    plt.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
    fig.savefig(output_path, dpi=100, facecolor='#FFFFFF', edgecolor='none')
    plt.close(fig)
    print(f"Generated {output_path}")

if __name__ == '__main__':
    build_diagram()
