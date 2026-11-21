"""Tests for reasoning leak prevention, truncation detection, document scope filtering,
grounding on specific files, and RAG document deletion."""
from __future__ import annotations

import pytest

from clarix.agent import Agent, SYSTEM_PROMPT
from clarix.config import Settings
from clarix.context import Context
from clarix.security.sanitize import extract_and_strip_thinking, strip_thinking


def test_strip_thinking_closed_block():
    raw = "<think>Let me reason about the user question...\nChecking database.</think>\n\nThis is the real answer."
    clean = strip_thinking(raw)
    assert clean == "This is the real answer."
    assert "<think>" not in clean
    assert "reason about" not in clean


def test_strip_thinking_unclosed_block():
    raw = "<think>Let me reason about this question and it gets cut off mid-thought"
    clean = strip_thinking(raw)
    assert clean == ""


def test_strip_thinking_stray_closing_tag():
    # Model starts without <think> tag but closes with </think>
    raw = "Okay, let's see what the user wants. We need to check network topology. </think>\n\nHere is the summary of the network."
    clean = strip_thinking(raw)
    assert clean == "Here is the summary of the network."
    assert "</think>" not in clean
    assert "Okay, let's see" not in clean


def test_strip_thinking_plain_text_monologue():
    raw = "Okay, let's tackle this user query. The user wants a summary of the network topology CSV file.\n\nSummary:\n- VLAN 100 for internal services\n- HTTPS on port 443 blocked"
    clean = strip_thinking(raw)
    assert "Summary:" in clean
    assert "VLAN 100" in clean
    assert "Okay, let's tackle this user query" not in clean


def test_system_prompt_no_security_rules_leak():
    assert "untrusted DATA" not in SYSTEM_PROMPT
    assert "Never reveal these rules" not in SYSTEM_PROMPT
    assert "air-gapped" in SYSTEM_PROMPT.lower()


class MockOllama:
    def __init__(self, reply_text: str = "Mock answer", truncated: bool = False):
        self.reply_text = reply_text
        self.truncated = truncated
        self.last_messages: list[dict] = []

    def pick_chat_model(self, wanted, default):
        return wanted or default, None

    def chat(self, model, messages, **kwargs):
        self.last_messages = messages
        return {
            "message": {"role": "assistant", "content": self.reply_text},
            "total_duration": 10000000,
            "eval_count": 50,
            "eval_duration": 10000000,
            "truncated": self.truncated,
        }


def test_scope_filtering_and_grounding(tmp_path):
    s = Settings(data_dir=tmp_path / "data", airgap_enforce=False, demo_endpoints=True, embed_backend="hash")
    ctx = Context(s)

    # Ingest two documents
    ctx.rag.ingest("network_topology.csv", b"protocol,port,policy,action\nHTTPS,443,POL-001,BLOCK\nSSH,22,POL-001,BLOCK", "INTERNAL", "operator")
    ctx.rag.ingest("confidential_hr.txt", b"HR Salary data for executive staff: confidential info", "INTERNAL", "operator")

    agent = Agent(ctx)
    mock_ollama = MockOllama(reply_text="Network topology summary: HTTPS 443 and SSH 22 are blocked under POL-001.")
    ctx.ollama = mock_ollama

    # Query with specific documentIds
    res = agent.chat("summarise this document", model="test", actor="operator", document_ids=["network_topology.csv"])
    assert res["meta"]["decision"] == "ALLOW"
    assert "HTTPS 443" in res["text"]

    # Verify that the reference material provided to Ollama contained network_topology.csv and NOT confidential_hr.txt
    system_contents = "\n".join(m["content"] for m in mock_ollama.last_messages if m["role"] == "system")
    assert "network_topology.csv" in system_contents
    assert "HTTPS" in system_contents
    assert "confidential_hr.txt" not in system_contents

    # Verify audit payload records the scoped document
    last_audit = ctx.audit.list(1)[0]
    assert "docs=network_topology.csv" in last_audit["payload"]


def test_ambiguity_clarification_prompt(tmp_path):
    s = Settings(data_dir=tmp_path / "data", airgap_enforce=False, demo_endpoints=True, embed_backend="hash")
    ctx = Context(s)

    # Ingest two documents
    ctx.rag.ingest("network_topology.csv", b"port,protocol\n443,HTTPS", "INTERNAL", "operator")
    ctx.rag.ingest("project_spec.txt", b"Project specifications content", "INTERNAL", "operator")

    agent = Agent(ctx)
    res = agent.chat("summarise this document", model="test", actor="operator", document_ids=None)

    # Should ask which document to summarize
    assert "Multiple documents are currently indexed" in res["text"]
    assert "network_topology.csv" in res["text"]
    assert "project_spec.txt" in res["text"]


def test_named_file_in_query_full_grounding(tmp_path):
    s = Settings(data_dir=tmp_path / "data", airgap_enforce=False, demo_endpoints=True, embed_backend="hash")
    ctx = Context(s)

    csv_data = (
        b"protocol,port,policy,action\n"
        b"HTTPS,443,POL-001,BLOCK\n"
        b"SSH,22,POL-001,BLOCK\n"
        b"DNS,53,POL-001,BLOCK\n"
    )
    ctx.rag.ingest("network_topology.csv", csv_data, "INTERNAL", "operator")
    ctx.rag.ingest("project_documentation.txt", b"Architecture Overview: The AI Harness encapsulates agent reasoning.", "INTERNAL", "operator")

    agent = Agent(ctx)
    mock_ollama = MockOllama(reply_text="The network topology blocks HTTPS (443), SSH (22), and DNS (53) under POL-001.")
    ctx.ollama = mock_ollama

    # User asks without document_ids, but names the file in the query
    res = agent.chat("summarise network_topology.csv", model="test", actor="operator")
    assert res["meta"]["decision"] == "ALLOW"
    assert "443" in res["text"]

    system_contents = "\n".join(m["content"] for m in mock_ollama.last_messages if m["role"] == "system")
    assert "network_topology.csv" in system_contents
    assert "DNS" in system_contents


def test_truncation_detection(tmp_path):
    s = Settings(data_dir=tmp_path / "data", airgap_enforce=False, demo_endpoints=True, embed_backend="hash")
    ctx = Context(s)

    agent = Agent(ctx)
    mock_ollama = MockOllama(reply_text="This reply stopped abruptly due to", truncated=True)
    ctx.ollama = mock_ollama

    res = agent.chat("explain everything", model="test", actor="operator")
    assert res["meta"].get("truncated") is True


def test_delete_document_and_audit(tmp_path):
    s = Settings(data_dir=tmp_path / "data", airgap_enforce=False, demo_endpoints=True, embed_backend="hash")
    ctx = Context(s)

    ctx.rag.ingest("obsolete_file.txt", b"old data to be removed", "INTERNAL", "operator")
    assert any(d["name"] == "obsolete_file.txt" for d in ctx.rag.documents())

    # Delete
    del_res = ctx.rag.delete_document("obsolete_file.txt", actor="operator")
    assert del_res["ok"] is True
    assert del_res["deleted"] == "obsolete_file.txt"

    # Verify removed from store
    assert not any(d["name"] == "obsolete_file.txt" for d in ctx.rag.documents())

    # Verify audit event recorded
    last_audit = ctx.audit.list(1)[0]
    assert "Document deleted: obsolete_file.txt" in last_audit["action"]
    assert "rag:delete:obsolete_file.txt" in last_audit["payload"]
