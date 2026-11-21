"""Data types and models for controlled agentic execution."""
from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class PlanStep:
    step: int
    description: str
    tool: str
    input: str
    risk: str = "LOW"
    predicted_decision: str = "ALLOW"
    needs_approval: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "step": self.step,
            "description": self.description,
            "tool": self.tool,
            "input": self.input,
            "risk": self.risk,
            "predictedDecision": self.predicted_decision,
            "needsApproval": self.needs_approval,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any] | None) -> PlanStep:
        if not isinstance(d, dict):
            return cls(step=1, description="", tool="", input="")
        try:
            st = int(d.get("step") or 1)
        except (ValueError, TypeError):
            st = 1
        return cls(
            step=st,
            description=str(d.get("description") or ""),
            tool=str(d.get("tool") or ""),
            input=str(d.get("input") or ""),
            risk=str(d.get("risk") or "LOW"),
            predicted_decision=str(d.get("predictedDecision") or d.get("predicted_decision") or "ALLOW"),
            needs_approval=bool(d.get("needsApproval") or d.get("needs_approval") or False),
        )


@dataclass
class RunStep:
    index: int
    phase: str  # "think" | "act" | "observe" | "reflect"
    thought: str = ""
    tool: str | None = None
    input: str | None = None
    output: str | None = None
    decision: str = "ALLOW"
    risk: str = "LOW"
    duration_ms: int = 0
    timestamp: str = ""
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "index": self.index,
            "phase": self.phase,
            "thought": self.thought,
            "tool": self.tool,
            "input": self.input,
            "output": self.output,
            "decision": self.decision,
            "risk": self.risk,
            "durationMs": self.duration_ms,
            "timestamp": self.timestamp,
            "error": self.error,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> RunStep:
        return cls(
            index=int(d.get("index", 1)),
            phase=str(d.get("phase", "think")),
            thought=str(d.get("thought", "")),
            tool=d.get("tool"),
            input=d.get("input"),
            output=d.get("output"),
            decision=str(d.get("decision", "ALLOW")),
            risk=str(d.get("risk", "LOW")),
            duration_ms=int(d.get("durationMs", d.get("duration_ms", 0))),
            timestamp=str(d.get("timestamp", "")),
            error=d.get("error"),
        )


@dataclass
class RunBudget:
    max_steps: int = 8
    max_seconds: float = 120.0
    max_tool_calls: int = 10

    def to_dict(self) -> dict[str, Any]:
        return {
            "maxSteps": self.max_steps,
            "maxSeconds": self.max_seconds,
            "maxToolCalls": self.max_tool_calls,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any] | RunBudget | None) -> RunBudget:
        if isinstance(d, RunBudget):
            return d
        if not isinstance(d, dict):
            return cls()
        try:
            ms = int(d.get("maxSteps") or d.get("max_steps") or 8)
        except (ValueError, TypeError):
            ms = 8
        try:
            msec = float(d.get("maxSeconds") or d.get("max_seconds") or 120.0)
        except (ValueError, TypeError):
            msec = 120.0
        try:
            mtc = int(d.get("maxToolCalls") or d.get("max_tool_calls") or 10)
        except (ValueError, TypeError):
            mtc = 10
        return cls(max_steps=ms, max_seconds=msec, max_tool_calls=mtc)


@dataclass
class AgentRun:
    id: str
    created_at: float
    updated_at: float
    actor: str
    role: str  # "researcher" | "analyst" | "operator"
    goal: str
    status: str  # "INITIALIZING" | "PLANNING" | "AWAITING_PLAN_APPROVAL" | "RUNNING" | "PAUSED" | "STOPPED" | "COMPLETED" | "FAILED" | "BUDGET_EXCEEDED" | "REJECTED"
    plan_mode: str  # "plan_then_act" | "dry_run" | "auto"
    plan: list[PlanStep] = field(default_factory=list)
    steps: list[RunStep] = field(default_factory=list)
    result_text: str = ""
    budget: RunBudget = field(default_factory=RunBudget)
    token: str = ""
    meta: dict[str, Any] = field(default_factory=dict)
    stop_reason: str | None = None
    dry_run_diff: str | None = None
    verification: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        b = self.budget.to_dict() if isinstance(self.budget, RunBudget) else RunBudget.from_dict(self.budget).to_dict()
        return {
            "id": self.id,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
            "actor": self.actor,
            "role": self.role,
            "goal": self.goal,
            "status": self.status,
            "planMode": self.plan_mode,
            "plan": [p.to_dict() if isinstance(p, PlanStep) else PlanStep.from_dict(p).to_dict() for p in (self.plan or [])],
            "steps": [s.to_dict() if isinstance(s, RunStep) else RunStep.from_dict(s).to_dict() for s in (self.steps or [])],
            "resultText": self.result_text,
            "budget": b,
            "token": self.token,
            "meta": self.meta or {},
            "stopReason": self.stop_reason,
            "dryRunDiff": self.dry_run_diff,
            "verification": self.verification,
        }
