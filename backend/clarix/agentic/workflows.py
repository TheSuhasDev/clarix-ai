"""Built-in agentic workflows and offline local scheduler."""
from __future__ import annotations

import logging
import threading
import time
from typing import Any

log = logging.getLogger("clarix.workflows")

BUILTIN_WORKFLOWS: list[dict[str, Any]] = [
    {
        "id": "workflow-summarize-risks",
        "name": "Summarize Documents & Flag Risks",
        "description": "Scans indexed workspace documents via RAG, extracts architectural controls, and highlights high-risk or confidential compliance gaps.",
        "defaultRole": "analyst",
        "defaultGoal": "Retrieve and summarize key architectural controls from indexed workspace documents. Highlight any security risks or compliance gaps.",
        "icon": "FileText",
        "estimatedSteps": 3,
        "category": "Analysis",
    },
    {
        "id": "workflow-cross-check",
        "name": "Cross-Check Documents for Contradictions",
        "description": "Cross-references claims across multiple indexed specifications to detect contradictions, conflicting policies, or divergent requirements.",
        "defaultRole": "analyst",
        "defaultGoal": "Cross-reference architecture documents and specifications to identify any contradictory statements, mismatched numbers, or policy conflicts.",
        "icon": "CheckSquare",
        "estimatedSteps": 4,
        "category": "Verification",
    },
    {
        "id": "workflow-security-audit",
        "name": "Security Audit of Ingested Documents",
        "description": "Audits all document chunks, flags quarantined chunks from injection scans, inspects data classification boundaries, and verifies integrity.",
        "defaultRole": "researcher",
        "defaultGoal": "Perform a read-only security audit of ingested documents, checking chunk classifications, quarantine statuses, and untrusted ingress sources.",
        "icon": "ShieldAlert",
        "estimatedSteps": 3,
        "category": "Audit",
    },
    {
        "id": "workflow-daily-integrity",
        "name": "Daily Integrity Report",
        "description": "Verifies the cryptographic HMAC hash chain, validates the external signed anchor, audits database triggers, and checks security state signatures.",
        "defaultRole": "analyst",
        "defaultGoal": "Verify the HMAC-SHA256 audit log integrity, inspect the external signed anchor, check SQLite append-only triggers, and generate a daily integrity verification summary.",
        "icon": "Lock",
        "estimatedSteps": 2,
        "category": "Integrity",
    },
]


class LocalScheduler:
    """
    Offline local scheduler for automated agent runs.
    - Runs entirely offline without external cron/cloud services.
    - Strictly enforces max 1 concurrent scheduled run.
    - All scheduler invocations are cryptographically audited.
    """

    def __init__(self, ctx, interval_seconds: int = 3600):
        self.ctx = ctx
        self.interval_seconds = interval_seconds
        self.enabled = False
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._lock = threading.Lock()
        self.last_run: float | None = None
        self.last_run_id: str | None = None
        self.is_running_job = False

    def start(self) -> None:
        """Start scheduler worker loop."""
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True, name="ClarixScheduler")
        self._thread.start()

    def stop(self) -> None:
        """Stop scheduler worker loop."""
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
            self._thread = None

    def toggle(self, enabled: bool) -> dict[str, Any]:
        """Enable or disable scheduled runs."""
        with self._lock:
            self.enabled = enabled
            self.ctx.audit.append(
                user="operator",
                action=f"Scheduler {'enabled' if enabled else 'disabled'}",
                component="Scheduler",
                risk="LOW",
                decision="ALLOW",
                classification="INTERNAL",
                payload=f"scheduler:toggle:{enabled}:interval={self.interval_seconds}",
            )
            return self.status()

    def status(self) -> dict[str, Any]:
        """Return scheduler status."""
        next_run = (self.last_run + self.interval_seconds) if (self.enabled and self.last_run) else None
        return {
            "enabled": self.enabled,
            "intervalSeconds": self.interval_seconds,
            "lastRun": self.last_run,
            "nextRun": next_run,
            "running": self.is_running_job,
            "lastRunId": self.last_run_id,
        }

    def _loop(self) -> None:
        while not self._stop_event.is_set():
            if self.enabled and not self.is_running_job:
                now = time.time()
                if self.last_run is None or (now - self.last_run) >= self.interval_seconds:
                    self._execute_scheduled_task()
            self._stop_event.wait(timeout=5.0)

    def _execute_scheduled_task(self) -> None:
        with self._lock:
            if self.is_running_job:
                return
            self.is_running_job = True

        try:
            log.info("Triggering scheduled workflow: workflow-daily-integrity")
            runner = getattr(self.ctx, "agentic_runner", None)
            if runner:
                run = runner.create_run(
                    goal="Execute scheduled daily cryptographic audit and state integrity verification.",
                    role="analyst",
                    plan_mode="auto",
                    workflow_id="workflow-daily-integrity",
                    actor="scheduler",
                )
                self.last_run_id = run.id
                self.last_run = time.time()
                self.ctx.audit.append(
                    user="scheduler",
                    action="Executed scheduled daily integrity run",
                    component="Scheduler",
                    risk="LOW",
                    decision="ALLOW",
                    classification="INTERNAL",
                    payload=f"scheduler:run:{run.id}:workflow=workflow-daily-integrity",
                )
        except Exception as e:
            log.error(f"Scheduled task error: {e}")
        finally:
            with self._lock:
                self.is_running_job = False


class AgenticWorkflowManager:
    """Manages built-in workflow definitions and the local scheduler."""

    def __init__(self, ctx):
        self.ctx = ctx
        self.scheduler = LocalScheduler(ctx)

    def list_workflows(self) -> list[dict[str, Any]]:
        return list(BUILTIN_WORKFLOWS)

    def get_workflow(self, workflow_id: str) -> dict[str, Any] | None:
        for w in BUILTIN_WORKFLOWS:
            if w["id"] == workflow_id:
                return dict(w)
        return None
