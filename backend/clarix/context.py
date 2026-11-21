"""Builds and wires every component. The single object handed to request handlers."""
from __future__ import annotations

import logging
import time

from .agent import Agent
from .agentic.memory import AgentMemoryStore
from .agentic.runner import AgentRunner
from .agentic.workflows import AgenticWorkflowManager
from .airgap import guard
from .approvals import Approvals, Grants
from .audit import AuditLog
from .config import Settings
from .db import Database
from .integrity import IntegrityManager
from .intent import IntentClassifier
from .llm.ollama import OllamaClient
from .metrics import Metrics
from .netmon import NetworkMonitor
from .rag.commands import RagCommands
from .rag.embedder import Embedder
from .rag.gate import RagGate
from .rag.graph import KnowledgeGraph
from .rag.store import RagStore
from .rag.verifier import EvidenceVerificationEngine
from .security.crypto_storage import CryptoStorage
from .security.policy import PolicyEngine
from .security.threats import ThreatStore
from .telemetry import Telemetry
from .tools.registry import ToolRegistry
from .tools.runtime import ToolRuntime
from .voice import VoiceManager

log = logging.getLogger("clarix")


class Context:
    def __init__(self, settings: Settings, install_guard: bool = True, db: Database | None = None):
        self.settings = settings
        settings.effective_data_dir.mkdir(parents=True, exist_ok=True)
        settings.workspace.mkdir(parents=True, exist_ok=True)
        self.db = db or Database(settings.db_path)
        self.crypto = CryptoStorage(settings.effective_data_dir)
        self.graph = KnowledgeGraph(self.db)
        self.verifier = EvidenceVerificationEngine(max_retries=1)
        self.intent = IntentClassifier()
        self.audit = AuditLog(self.db)
        self.integrity = IntegrityManager(self)
        self.metrics = Metrics(self.db)
        self.tools = ToolRegistry(self.db)
        self.grants = Grants(self.db)
        self.policy = PolicyEngine(self.db, self.tools.level, self.grants.has)
        self.approvals = Approvals(self.db, self.audit, settings.approval_timeout_s, self.grants)
        self.threats = ThreatStore(self.db)
        self.ollama = OllamaClient(settings.ollama_url)
        self.embedder = Embedder(self.ollama, settings.embed_model, settings.embed_backend)
        self.rag = RagStore(self.db, self.audit, self.embedder, settings.workspace, settings.max_upload_bytes,
                            graph=self.graph, crypto=self.crypto)
        self.rag_gate = RagGate(self)
        self.runtime = ToolRuntime(self)
        self.approvals.resume_tool = self.runtime.resume
        self.agent = Agent(self)
        self.rag_commands = RagCommands(self)
        self.telemetry = Telemetry(self)
        self.voice = VoiceManager(self)
        self.agentic_memory = AgentMemoryStore(self)
        self.agentic_workflows = AgenticWorkflowManager(self)
        self.agentic_runner = AgentRunner(self)
        self.netmon = NetworkMonitor(self)
        self.started = time.time()
        guard.set_sink(self._on_blocked)
        if install_guard:
            guard.install(settings.airgap_enforce)
        if not settings.airgap_enforce:
            log.warning("CLARIX_AIRGAP_ENFORCE=false: the in-process egress guard is DISABLED (development only).")
        if not settings.auth_enabled:
            log.warning("No API token configured: running in DEV MODE without authentication (loopback only).")

    def _on_blocked(self, rec: dict) -> None:
        self.db.x("INSERT INTO blocked_connections(ts,host,port,protocol,subsystem,rule) VALUES(?,?,?,?,?,?)",
                  (rec["ts"], rec["host"], rec["port"], rec["protocol"], rec["subsystem"], rec["rule"]))
        self.audit.append(user="system", action=f"Blocked outbound {rec['protocol']} to {rec['host']}:{rec['port']}", component="Air-Gap Monitor",
                          risk="HIGH", decision="BLOCK", classification="INTERNAL", payload=f"airgap:{rec['subsystem']}:{rec['host']}:{rec['port']}")

    def start(self) -> None:
        self.telemetry.start()
        self.integrity.start()
        self.netmon.start()
        if hasattr(self, "agentic_workflows") and hasattr(self.agentic_workflows, "scheduler"):
            self.agentic_workflows.scheduler.start()

    def close(self) -> None:
        if hasattr(self, "agentic_workflows") and hasattr(self.agentic_workflows, "scheduler"):
            self.agentic_workflows.scheduler.stop()
        if hasattr(self, "voice"):
            self.voice.shutdown()
        self.netmon.close()
        self.telemetry.stop()
        self.integrity.stop()
        guard.set_sink(None)
