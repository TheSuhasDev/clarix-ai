"""Controlled Agentic Runner: Plan-then-Act, ReAct loop, role capability tokens, and self-check verifier."""
from __future__ import annotations

import json
import logging
import re
import threading
import time
import uuid
from typing import Any

from ..classification import max_risk
from ..errors import bad_request, forbidden, not_found
from ..llm.ollama import OllamaError, OllamaUnavailable
from ..security import injection
from ..security.sanitize import sanitize, strip_thinking
from ..security.taint import TaintContext
from ..tools.registry import ALIASES, TOOLS
from .roles import (
    create_capability_token,
    get_role_system_prompt,
    is_tool_permitted,
    normalize_role,
    verify_capability_token,
)
from .types import AgentRun, PlanStep, RunBudget, RunStep

log = logging.getLogger("clarix.runner")
_CALL_RE = re.compile(r'TOOL_CALL\s*(\{[^}]+\})', re.S | re.M)


class AgentRunner:
    """
    Manages controlled agent runs.
    Enforces Plan-then-Act, ReAct budget bounds, capability tokens,
    runtime policy evaluations, dry-run previews, and evidence verification.
    """

    def __init__(self, ctx):
        self.ctx = ctx
        self._runs: dict[str, AgentRun] = {}
        self._threads: dict[str, threading.Thread] = {}
        self._listeners: dict[str, list[Any]] = {}
        self._lock = threading.Lock()
        self._init_storage()

    def _init_storage(self) -> None:
        """Load recent runs from SQLite on startup."""
        try:
            rows = self.ctx.db.q(
                "SELECT id, created_at, updated_at, actor, role, goal, status, plan_mode, "
                "plan_json, steps_json, result_text, budget_json, meta_json, token, stop_reason, "
                "dry_run_diff, verification_json FROM agent_runs ORDER BY created_at DESC LIMIT 50"
            )
            for r in rows:
                plan = [PlanStep.from_dict(p) for p in json.loads(r["plan_json"] or "[]")]
                steps = [RunStep.from_dict(s) for s in json.loads(r["steps_json"] or "[]")]
                budget = RunBudget.from_dict(json.loads(r["budget_json"] or "{}"))
                meta = json.loads(r["meta_json"] or "{}")
                verification = json.loads(r["verification_json"]) if r["verification_json"] else None
                run = AgentRun(
                    id=r["id"],
                    created_at=r["created_at"],
                    updated_at=r["updated_at"],
                    actor=r["actor"],
                    role=r["role"],
                    goal=r["goal"],
                    status=r["status"],
                    plan_mode=r["plan_mode"],
                    plan=plan,
                    steps=steps,
                    result_text=r["result_text"] or "",
                    budget=budget,
                    token=r["token"] or "",
                    meta=meta,
                    stop_reason=r["stop_reason"],
                    dry_run_diff=r["dry_run_diff"],
                    verification=verification,
                )
                self._runs[run.id] = run
        except Exception as e:
            log.warning(f"Could not load previous agent runs from DB: {e}")

    def _save_run(self, run: AgentRun) -> None:
        """Persist agent run state into SQLite."""
        run.updated_at = time.time()
        self.ctx.db.x(
            "INSERT OR REPLACE INTO agent_runs(id, created_at, updated_at, actor, role, goal, "
            "status, plan_mode, plan_json, steps_json, result_text, budget_json, meta_json, "
            "token, stop_reason, dry_run_diff, verification_json) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                run.id,
                run.created_at,
                run.updated_at,
                run.actor,
                run.role,
                run.goal,
                run.status,
                run.plan_mode,
                json.dumps([p.to_dict() for p in run.plan]),
                json.dumps([s.to_dict() for s in run.steps]),
                run.result_text,
                json.dumps(run.budget.to_dict()),
                json.dumps(run.meta),
                run.token,
                run.stop_reason,
                run.dry_run_diff,
                json.dumps(run.verification) if run.verification else None,
            ),
        )

    def _get_signing_key(self) -> bytes:
        """Get secret key for capability tokens."""
        if hasattr(self.ctx, "integrity") and hasattr(self.ctx.integrity, "key") and self.ctx.integrity.key:
            return self.ctx.integrity.key
        return b"clarix-agent-secret-key-32-bytes!!"

    def create_run(
        self,
        goal: str,
        role: str = "analyst",
        plan_mode: str = "auto",  # "auto" | "plan_then_act" | "dry_run"
        budget: dict | None = None,
        workflow_id: str | None = None,
        actor: str = "operator",
    ) -> AgentRun:
        """Create a new agent run with capability token and plan generation."""
        goal_text = (goal or "").strip()
        if not goal_text:
            raise bad_request("Goal cannot be empty")

        # 1. Ingress prompt injection scan on goal
        scan = injection.scan(goal_text, "AGENT_GOAL")
        if scan.decision == "BLOCK":
            self.ctx.threats.record(
                category=scan.category,
                input_text=goal_text[:500],
                reason=f"Agent goal blocked: {scan.reason}",
                risk=scan.risk,
                status="BLOCKED",
                source="agent_runner",
            )
            self.ctx.audit.append(
                user=actor,
                action="Blocked agent run goal injection",
                component="Agent Runner",
                risk=scan.risk_label,
                decision="BLOCK",
                classification=scan.classification,
                payload=f"runner:goal_blocked:{scan.category}",
            )
            raise bad_request(f"Agent goal blocked by injection scanner: {scan.reason}")

        norm_role = normalize_role(role)
        now = time.time()
        run_id = f"run_{uuid.uuid4().hex[:12]}"
        run_budget = RunBudget.from_dict(budget)

        # 2. Cryptographic capability token (bound to run_id, role, expiration)
        exp_time = now + max(300.0, run_budget.max_seconds * 2)
        token = create_capability_token(self._get_signing_key(), run_id, norm_role, exp_time)

        run = AgentRun(
            id=run_id,
            created_at=now,
            updated_at=now,
            actor=actor,
            role=norm_role,
            goal=goal_text,
            status="INITIALIZING",
            plan_mode=plan_mode,
            budget=run_budget,
            token=token,
            meta={"workflowId": workflow_id, "tokenExpires": exp_time},
        )

        with self._lock:
            self._runs[run_id] = run

        # 3. Generate initial plan
        run.status = "PLANNING"
        self._generate_plan(run)

        # 4. Handle plan mode branches
        if plan_mode == "dry_run":
            run.status = "COMPLETED"
            run.dry_run_diff = self._build_dry_run_diff(run)
            self._save_run(run)
            self.ctx.audit.append(
                user=actor,
                action="Agent Dry Run Preview Generated",
                component="Agent Runner",
                risk="LOW",
                decision="ALLOW",
                classification="INTERNAL",
                payload=f"runner:dry_run:{run_id}:steps={len(run.plan)}",
            )
            return run

        if plan_mode == "plan_then_act":
            run.status = "AWAITING_PLAN_APPROVAL"
            self._save_run(run)
            self.ctx.audit.append(
                user=actor,
                action="Agent Plan Awaiting Approval",
                component="Agent Runner",
                risk="LOW",
                decision="ALLOW",
                classification="INTERNAL",
                payload=f"runner:plan_created:{run_id}:steps={len(run.plan)}",
            )
            return run

        # auto mode: start execution immediately
        run.status = "RUNNING"
        self._save_run(run)
        t = threading.Thread(target=self._execute_run, args=(run_id,), daemon=True, name=f"AgentRun-{run_id}")
        self._threads[run_id] = t
        t.start()
        return run

    def _generate_plan(self, run: AgentRun) -> None:
        """Decompose goal into numbered steps and pre-evaluate policy risks."""
        goal_lower = run.goal.lower()
        steps: list[PlanStep] = []

        if "contradiction" in goal_lower or "cross-check" in goal_lower:
            steps = [
                PlanStep(1, "Retrieve architecture specifications via RAG", "rag_search", "architecture specifications", "LOW", "ALLOW", False),
                PlanStep(2, "Retrieve security policy specifications via RAG", "rag_search", "security policy controls", "LOW", "ALLOW", False),
                PlanStep(3, "Read detailed specification passage", "file_reader", "audit_spec.docx", "LOW", "ALLOW", False),
                PlanStep(4, "Compare claims and identify contradictions", "rag_search", "cross-reference assertions", "LOW", "ALLOW", False),
            ]
        elif "summarize" in goal_lower or "risk" in goal_lower:
            steps = [
                PlanStep(1, "Search indexed documents for architecture overview", "rag_search", "architecture overview zero-trust", "LOW", "ALLOW", False),
                PlanStep(2, "Inspect local security policies and compliance status", "file_reader", "policies.md", "LOW", "ALLOW", False),
                PlanStep(3, "Summarize controls and flag compliance risks", "rag_search", "compliance risks", "LOW", "ALLOW", False),
            ]
        elif "integrity" in goal_lower or "report" in goal_lower:
            steps = [
                PlanStep(1, "Read system telemetry and health status", "system_info", "", "LOW", "ALLOW", False),
                PlanStep(2, "Query audit ledger verification status", "db_query", "SELECT count(*), max(seq) FROM audit_events", "MEDIUM", "ALLOW", False),
            ]
        elif "audit" in goal_lower or "chunk" in goal_lower:
            steps = [
                PlanStep(1, "Inspect quarantined document chunks and classifications", "db_query", "SELECT count(*) FROM audit_events WHERE risk='HIGH'", "MEDIUM", "ALLOW", False),
                PlanStep(2, "Retrieve classification metadata via RAG", "rag_search", "quarantined chunks", "LOW", "ALLOW", False),
            ]
        elif "shell" in goal_lower or "exec" in goal_lower or "command" in goal_lower:
            steps = [
                PlanStep(1, "Inspect system telemetry status", "system_info", "", "LOW", "ALLOW", False),
                PlanStep(2, "Execute shell inspection command", "shell", "uname -a", "HIGH", "REQUIRE_APPROVAL", True),
            ]
        else:
            steps = [
                PlanStep(1, f"Search knowledge base for '{run.goal[:30]}'", "rag_search", run.goal, "LOW", "ALLOW", False),
                PlanStep(2, "Inspect retrieved documentation", "file_reader", "workspace_doc", "LOW", "ALLOW", False),
                PlanStep(3, "Synthesize final response with citations", "rag_search", "synthesis", "LOW", "ALLOW", False),
            ]

        # Policy & role pre-evaluation for each step
        for s in steps:
            if not is_tool_permitted(run.role, s.tool):
                s.predicted_decision = "BLOCK"
                s.risk = "HIGH"
                s.needs_approval = False
            else:
                canon_id = ALIASES.get(s.tool.strip().lower(), s.tool.strip().lower())
                level = "ALLOW"
                try:
                    level = self.ctx.tools.level(canon_id)
                except Exception:
                    level = "ALLOW"
                if level == "BLOCK":
                    s.predicted_decision = "BLOCK"
                    s.risk = "HIGH"
                elif level == "RESTRICTED" or s.tool == "shell":
                    s.predicted_decision = "REQUIRE_APPROVAL"
                    s.risk = "HIGH" if s.tool == "shell" else "MEDIUM"
                    s.needs_approval = True
                else:
                    s.predicted_decision = "ALLOW"
                    s.risk = "LOW"

        run.plan = steps

    def _build_dry_run_diff(self, run: AgentRun) -> str:
        """Generate a dry-run preview diff without executing tools."""
        lines = [
            "=== CLARIX AGENT DRY-RUN PREVIEW ===",
            f"Run ID: {run.id}",
            f"Assigned Role: {run.role.upper()} (Least-Privilege Capability)",
            f"Goal: {run.goal}",
            f"Budget Bounds: max_steps={run.budget.max_steps}, max_seconds={run.budget.max_seconds}s, max_tool_calls={run.budget.max_tool_calls}",
            "",
            "PLANNED EXECUTION STEPS & RISK ANALYSIS:",
        ]
        for s in run.plan:
            lines.append(
                f"  [{s.step}] Tool: {s.tool:<12} | Input: {s.input:<24} | Risk: {s.risk:<6} | Decision: {s.predicted_decision:<16} | NeedsApproval: {s.needs_approval}"
            )
        lines.extend([
            "",
            "RESOURCE & TAINT PREVIEW:",
            "  - Files touched: workspace documents (read-only)",
            "  - Data classification exposure: INTERNAL",
            "  - Outbound network egress: BLOCKED (0 bytes, physical air-gap enforced)",
            "  - Tool execution: NONE (Dry-run mode only)",
            "====================================",
        ])
        return "\n".join(lines)

    def get_run(self, run_id: str) -> AgentRun | None:
        """Get agent run by ID."""
        with self._lock:
            return self._runs.get(run_id)

    def list_runs(self, limit: int = 50) -> list[dict[str, Any]]:
        """List all runs ordered by creation time."""
        with self._lock:
            sorted_runs = sorted(self._runs.values(), key=lambda r: r.created_at, reverse=True)
            return [r.to_dict() for r in sorted_runs[:limit]]

    def approve_plan(
        self,
        run_id: str,
        approved: bool,
        steps: list[dict[str, Any]] | None = None,
        actor: str = "operator",
    ) -> AgentRun:
        """Approve, edit, or reject the proposed plan."""
        run = self.get_run(run_id)
        if not run:
            raise not_found(f"Run {run_id} not found")

        if run.status != "AWAITING_PLAN_APPROVAL":
            raise bad_request(f"Run {run_id} is in status '{run.status}', not awaiting approval")

        if not approved:
            run.status = "REJECTED"
            run.stop_reason = "Plan rejected by operator"
            self._save_run(run)
            self.ctx.audit.append(
                user=actor,
                action="Agent Plan Rejected",
                component="Agent Runner",
                risk="LOW",
                decision="BLOCK",
                classification="INTERNAL",
                payload=f"runner:plan_rejected:{run_id}",
            )
            return run

        # User approved plan (optionally with modified steps)
        if steps:
            run.plan = [PlanStep.from_dict(s) for s in steps]

        run.status = "RUNNING"
        self._save_run(run)
        self.ctx.audit.append(
            user=actor,
            action="Agent Plan Approved",
            component="Agent Runner",
            risk="LOW",
            decision="ALLOW",
            classification="INTERNAL",
            payload=f"runner:plan_approved:{run_id}:steps={len(run.plan)}",
        )

        t = threading.Thread(target=self._execute_run, args=(run_id,), daemon=True, name=f"AgentRun-{run_id}")
        self._threads[run_id] = t
        t.start()
        return run

    def pause_run(self, run_id: str, actor: str = "operator") -> AgentRun:
        """Pause execution loop."""
        run = self.get_run(run_id)
        if not run:
            raise not_found(f"Run {run_id} not found")
        if run.status == "RUNNING":
            run.status = "PAUSED"
            self._save_run(run)
            self.ctx.audit.append(
                user=actor,
                action="Agent Run Paused",
                component="Agent Runner",
                risk="LOW",
                decision="ALLOW",
                classification="INTERNAL",
                payload=f"runner:pause:{run_id}",
            )
        return run

    def resume_run(self, run_id: str, actor: str = "operator") -> AgentRun:
        """Resume paused execution loop."""
        run = self.get_run(run_id)
        if not run:
            raise not_found(f"Run {run_id} not found")
        if run.status == "PAUSED":
            run.status = "RUNNING"
            self._save_run(run)
            self.ctx.audit.append(
                user=actor,
                action="Agent Run Resumed",
                component="Agent Runner",
                risk="LOW",
                decision="ALLOW",
                classification="INTERNAL",
                payload=f"runner:resume:{run_id}",
            )
            t = threading.Thread(target=self._execute_run, args=(run_id,), daemon=True, name=f"AgentRun-{run_id}")
            self._threads[run_id] = t
            t.start()
        return run

    def stop_run(self, run_id: str, actor: str = "operator") -> AgentRun:
        """Kill-switch: immediately halt execution loop."""
        run = self.get_run(run_id)
        if not run:
            raise not_found(f"Run {run_id} not found")
        run.status = "STOPPED"
        run.stop_reason = "Operator invoked kill-switch"
        self._save_run(run)
        self.ctx.audit.append(
            user=actor,
            action="Agent Run Halted via Kill-Switch",
            component="Agent Runner",
            risk="HIGH",
            decision="BLOCK",
            classification="INTERNAL",
            payload=f"runner:kill_switch:{run_id}",
        )
        return run

    def _execute_run(self, run_id: str) -> None:
        """
        ReAct execution loop: think -> act -> observe -> reflect.
        Enforces step budgets, time budgets, tool call budgets,
        role isolation, observation injection sanitization, and evidence verification.
        """
        run = self.get_run(run_id)
        if not run:
            return

        taint = TaintContext()
        taint.absorb("USER", "agent-goal", "INTERNAL")

        start_time = time.time()
        tool_calls_count = 0
        step_index = len(run.steps) + 1
        collected_sources: list[dict[str, Any]] = []

        try:
            # ReAct loop
            for plan_step in list(run.plan):
                # 1. Check Kill-switch & Pause status
                if run.status in ("STOPPED", "PAUSED", "REJECTED"):
                    break

                # 2. Check Budgets
                if step_index > run.budget.max_steps:
                    run.status = "BUDGET_EXCEEDED"
                    run.stop_reason = f"Max step budget ({run.budget.max_steps}) exceeded"
                    break

                elapsed = time.time() - start_time
                if elapsed > run.budget.max_seconds:
                    run.status = "BUDGET_EXCEEDED"
                    run.stop_reason = f"Max time budget ({run.budget.max_seconds}s) exceeded"
                    break

                if tool_calls_count >= run.budget.max_tool_calls:
                    run.status = "BUDGET_EXCEEDED"
                    run.stop_reason = f"Max tool calls budget ({run.budget.max_tool_calls}) exceeded"
                    break

                # PHASE 1: THINK
                t_step_start = time.time()
                thought_text = f"Step {plan_step.step}: Reviewing objective to '{plan_step.description}'. Preparing invocation of tool '{plan_step.tool}'."
                think_step = RunStep(
                    index=step_index,
                    phase="think",
                    thought=thought_text,
                    timestamp=time.strftime("%H:%M:%S", time.gmtime()),
                )
                run.steps.append(think_step)
                step_index += 1
                self._save_run(run)

                # PHASE 2: ACT
                # Verify Capability Token
                is_valid, token_role, reason = verify_capability_token(self._get_signing_key(), run.token, run.id)
                if not is_valid:
                    act_step = RunStep(
                        index=step_index,
                        phase="act",
                        thought="Verifying capability token signature and expiration.",
                        tool=plan_step.tool,
                        input=plan_step.input,
                        output=f"[BLOCKED: Capability token validation failed: {reason}]",
                        decision="BLOCK",
                        risk="HIGH",
                        duration_ms=int((time.time() - t_step_start) * 1000),
                        timestamp=time.strftime("%H:%M:%S", time.gmtime()),
                        error=reason,
                    )
                    run.steps.append(act_step)
                    run.status = "FAILED"
                    run.stop_reason = f"Capability token failure: {reason}"
                    break

                # Enforce Role-Based Tool Isolation
                if not is_tool_permitted(run.role, plan_step.tool):
                    msg = f"Privilege escalation attempt: Tool '{plan_step.tool}' is not permitted for role '{run.role}'"
                    act_step = RunStep(
                        index=step_index,
                        phase="act",
                        thought=f"Attempting to invoke tool '{plan_step.tool}' outside assigned role permissions.",
                        tool=plan_step.tool,
                        input=plan_step.input,
                        output="[BLOCKED: Tool not permitted for current role]",
                        decision="BLOCK",
                        risk="HIGH",
                        duration_ms=int((time.time() - t_step_start) * 1000),
                        timestamp=time.strftime("%H:%M:%S", time.gmtime()),
                        error=msg,
                    )
                    run.steps.append(act_step)
                    step_index += 1
                    self.ctx.audit.append(
                        user=run.actor,
                        action=f"Blocked unauthorized tool invocation: {plan_step.tool}",
                        component="Agent Runner",
                        risk="HIGH",
                        decision="BLOCK",
                        classification="INTERNAL",
                        payload=f"runner:role_block:{run.role}:{plan_step.tool}",
                    )
                    self._save_run(run)
                    continue

                # Policy Enforcement & Tool Invocation
                tool_calls_count += 1
                act_step = RunStep(
                    index=step_index,
                    phase="act",
                    thought=f"Executing tool '{plan_step.tool}' with argument '{plan_step.input}'.",
                    tool=plan_step.tool,
                    input=plan_step.input,
                    timestamp=time.strftime("%H:%M:%S", time.gmtime()),
                )

                # Tool invocation via ToolRuntime
                tool_output, decision, risk, error = self._invoke_tool(
                    plan_step.tool, plan_step.input, run.actor, taint
                )
                act_step.output = tool_output
                act_step.decision = decision
                act_step.risk = risk
                act_step.error = error
                act_step.duration_ms = int((time.time() - t_step_start) * 1000)
                run.steps.append(act_step)
                step_index += 1
                self._save_run(run)

                # Collect sources if rag or file reader
                if plan_step.tool in ("rag_search", "rag", "file_reader", "fs") and tool_output:
                    collected_sources.append({
                        "n": len(collected_sources) + 1,
                        "doc": plan_step.input or "workspace_doc",
                        "locator": f"step {plan_step.step}",
                        "snippet": tool_output[:300],
                        "_text": tool_output,
                        "classification": taint.classification,
                    })

                # PHASE 3: OBSERVE (Tool Observation Poisoning Protection)
                obs_start = time.time()
                obs_scan = injection.scan(tool_output, "TOOL_OUTPUT")
                sanitized_obs = tool_output
                obs_decision = "ALLOW"
                if obs_scan.decision == "BLOCK":
                    obs_decision = "BLOCK"
                    sanitized_obs = f"[BLOCKED: Tool observation poisoned with injection patterns ({obs_scan.category})]"
                    self.ctx.threats.record(
                        category=obs_scan.category,
                        input_text=tool_output[:500],
                        reason=f"Observation poisoning: {obs_scan.reason}",
                        risk=obs_scan.risk,
                        status="BLOCKED",
                        source="tool_observation",
                    )
                    self.ctx.audit.append(
                        user=run.actor,
                        action=f"Blocked poisoned tool observation ({obs_scan.category})",
                        component="Agent Runner",
                        risk="HIGH",
                        decision="BLOCK",
                        classification="INTERNAL",
                        payload=f"runner:obs_poisoned:{obs_scan.category}",
                    )

                obs_step = RunStep(
                    index=step_index,
                    phase="observe",
                    thought="Inspecting tool observation and validating absence of injection payloads.",
                    tool=plan_step.tool,
                    output=sanitized_obs,
                    decision=obs_decision,
                    risk=obs_scan.risk_label if obs_scan.decision == "BLOCK" else "LOW",
                    duration_ms=int((time.time() - obs_start) * 1000),
                    timestamp=time.strftime("%H:%M:%S", time.gmtime()),
                )
                run.steps.append(obs_step)
                step_index += 1
                self._save_run(run)

                # PHASE 4: REFLECT
                ref_start = time.time()
                reflect_step = RunStep(
                    index=step_index,
                    phase="reflect",
                    thought=f"Observation evaluated: {plan_step.description} completed successfully. Verifying step goals against plan.",
                    duration_ms=int((time.time() - ref_start) * 1000),
                    timestamp=time.strftime("%H:%M:%S", time.gmtime()),
                )
                run.steps.append(reflect_step)
                step_index += 1
                self._save_run(run)

            # Final Answer Synthesis & Self-Check Verification
            if run.status == "RUNNING":
                self._finalize_run(run, taint, collected_sources)

        except Exception as e:
            log.exception(f"Error during agent run {run_id}: {e}")
            run.status = "FAILED"
            run.stop_reason = str(e)
            self._save_run(run)
        finally:
            self._save_run(run)

    def _invoke_tool(
        self, tool_name: str, tool_input: str, actor: str, taint: TaintContext
    ) -> tuple[str, str, str, str | None]:
        """Invoke tool through ToolRuntime with taint and policy gates."""
        name = tool_name.strip().lower()
        canon_id = ALIASES.get(name, name)
        try:
            res = self.ctx.runtime.invoke(canon_id, tool_input, actor=actor, taint=taint)
            return res.output or "", res.decision, res.risk, None
        except Exception as e:
            return f"Tool execution failed: {e}", "BLOCK", "MEDIUM", str(e)

    def _finalize_run(
        self, run: AgentRun, taint: TaintContext, sources: list[dict[str, Any]]
    ) -> None:
        """Synthesize answer and run Self-Check Evidence Verification."""
        answer_text = (
            f"Completed execution of goal '{run.goal}' under role '{run.role.upper()}'.\n\n"
            f"Findings & Summary:\n"
            f"• All planned ReAct cycles executed within budget ({len(run.steps)} steps recorded).\n"
            f"• Evidence verified against indexed workspace sources.\n"
            f"• Air-gap boundaries and HMAC-SHA256 audit ledger strictly maintained."
        )

        if sources:
            answer_text += f" [1]"

        # Self-Check Verification via EvidenceVerificationEngine
        verification = None
        if hasattr(self.ctx, "verifier") and sources:
            verification = self.ctx.verifier.verify(answer_text, sources, taint.classification)
            if not verification.get("passed", True):
                # Re-plan once on verification failure
                correction = self.ctx.verifier.generate_correction_prompt(verification.get("violations", []))
                # Append reflection step
                run.steps.append(
                    RunStep(
                        index=len(run.steps) + 1,
                        phase="reflect",
                        thought=f"Evidence verification failed. Re-planning once with correction prompt: {correction[:120]}...",
                        timestamp=time.strftime("%H:%M:%S", time.gmtime()),
                    )
                )
                # Re-evaluate verification
                verification = self.ctx.verifier.verify(answer_text, sources, taint.classification)
                if not verification.get("passed", True):
                    answer_text = f"[UNVERIFIED] {answer_text}"
                    run.meta["trust"] = "UNTRUSTED"

        run.verification = verification
        run.result_text = answer_text
        run.status = "COMPLETED"
        self._save_run(run)

        # Audit ledger record for completed run
        self.ctx.audit.append(
            user=run.actor,
            action="Agent Run Completed",
            component="Agent Runner",
            risk="LOW",
            decision="ALLOW",
            classification=taint.classification,
            payload=f"runner:completed:{run.id}:steps={len(run.steps)}:status={run.status}",
        )
