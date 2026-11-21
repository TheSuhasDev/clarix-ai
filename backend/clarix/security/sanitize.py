"""Output sanitiser applied to model text before it is returned. Redacts obvious secrets and strips
tool-call control lines so the UI never shows raw protocol text."""
from __future__ import annotations

import re

_PATTERNS = [
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----", re.S), "[REDACTED PRIVATE KEY]"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "[REDACTED AWS KEY]"),
    (re.compile(r"\b(ghp|gho|ghs)_[A-Za-z0-9]{30,}\b"), "[REDACTED TOKEN]"),
    (re.compile(r"\bsk-[A-Za-z0-9]{20,}\b"), "[REDACTED API KEY]"),
    (re.compile(r"(?i)\b(password|passwd|secret|token)\s*[:=]\s*\S{6,}"), r"\1: [REDACTED]"),
]
_TOOL_LINE = re.compile(r"^\s*TOOL_CALL\b.*$", re.M)

_TAG_BLOCKS = [
    re.compile(r"<think>.*?</think>", re.S | re.I),
    re.compile(r"<thought>.*?</thought>", re.S | re.I),
    re.compile(r"<reasoning>.*?</reasoning>", re.S | re.I),
]
_UNCLOSED_TAGS = [
    re.compile(r"<think>.*\Z", re.S | re.I),
    re.compile(r"<thought>.*\Z", re.S | re.I),
    re.compile(r"<reasoning>.*\Z", re.S | re.I),
]
_STRAY_CLOSING = [
    re.compile(r"\A[\s\S]*?</think>\s*", re.I),
    re.compile(r"\A[\s\S]*?</thought>\s*", re.I),
    re.compile(r"\A[\s\S]*?</reasoning>\s*", re.I),
]
_PLAIN_THINK_PATTERNS = [
    re.compile(
        r"^(?:Thinking Process:|Here's a thinking process:|Okay,?\s+let's\s+tackle|Wait,?\s+the\s+system\s+says)[\s\S]*?(?=\n\n|\Z)\s*",
        re.I,
    ),
]


def extract_and_strip_thinking(text: str) -> tuple[str, str | None]:
    """Extract stripped reasoning for optional debug inspection while returning clean answer."""
    raw = text or ""
    extracted: list[str] = []

    # Extract tagged thoughts
    for pat in _TAG_BLOCKS:
        for m in pat.finditer(raw):
            extracted.append(m.group(0))

    out = raw
    for pat in _TAG_BLOCKS:
        out = pat.sub("", out)
    for pat in _UNCLOSED_TAGS:
        m = pat.search(out)
        if m:
            extracted.append(m.group(0))
            out = pat.sub("", out)
    for pat in _STRAY_CLOSING:
        m = pat.match(out)
        if m:
            extracted.append(m.group(0))
            out = pat.sub("", out)
    for pat in _PLAIN_THINK_PATTERNS:
        m = pat.match(out)
        if m:
            extracted.append(m.group(0))
            out = pat.sub("", out)

    reasoning = "\n\n".join(e.strip() for e in extracted if e.strip()) or None
    return out.strip(), reasoning


def strip_thinking(text: str) -> str:
    """Remove <think>…</think> blocks, unclosed think blocks, stray </think> tags, and plain text
    reasoning monologue. Applied BEFORE tool-call parsing and sanitization so reasoning is never
    shown to the user, audited, or executed."""
    clean, _ = extract_and_strip_thinking(text)
    return clean


def sanitize(text: str) -> tuple[str, list[str]]:
    notes: list[str] = []
    out = _TOOL_LINE.sub("", text)
    for pat, repl in _PATTERNS:
        out, n = pat.subn(repl, out)
        if n:
            notes.append(f"redacted {n} secret-like value(s)")
    return out.strip(), notes
