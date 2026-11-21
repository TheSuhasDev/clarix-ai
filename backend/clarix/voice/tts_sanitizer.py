"""TTS Sanitizer: strips markdown, citations, URLs, code blocks, and redacts secrets before speech synthesis."""
from __future__ import annotations

import re

# Secret patterns to redact before speech synthesis
_SECRET_PATTERNS = [
    re.compile(r"-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----", re.I),
    re.compile(r"\b(Bearer\s+)[A-Za-z0-9_\-\.]{12,}", re.I),
    re.compile(r"\b(api[_-]?key|secret|token|password|auth(?:orization)?)\s*[:=]\s*['\"]?([A-Za-z0-9_\-\.]{8,})['\"]?", re.I),
    re.compile(r"\b(AKIA[0-9A-Z]{16})\b"),
    re.compile(r"\b([a-f0-9]{32,64})\b"),  # Long hex hashes/tokens
]

# Markdown, citations, and formatting patterns
_CODE_BLOCK_RE = re.compile(r"```[\s\S]*?```")
_INLINE_CODE_RE = re.compile(r"`([^`]+)`")
_URL_RE = re.compile(r"https?://\S+|www\.\S+", re.I)
_MD_LINK_RE = re.compile(r"\[([^\]]+)\]\([^\)]+\)")
_CITATION_RE = re.compile(r"\[\d{1,3}\]")
_HEADER_RE = re.compile(r"^#{1,6}\s+", re.M)
_BULLET_RE = re.compile(r"^\s*[\-\*•]\s+", re.M)
_FORMATTING_CHARS = re.compile(r"[*_~]")
_TRACE_BLOCK_RE = re.compile(r"REQ ID:\s*REQ-\d+[\s\S]*?(?=\n\n|$)", re.I)


def redact_secrets(text: str) -> str:
    """Redact sensitive API keys, tokens, passwords, and private keys."""
    if not text:
        return ""
    cleaned = text
    for pattern in _SECRET_PATTERNS:
        cleaned = pattern.sub("[REDACTED]", cleaned)
    return cleaned


def strip_markdown_and_citations(text: str) -> str:
    """
    Remove code blocks, inline backticks, URLs, markdown links, citation markers [n],
    headers, and bullet markers to produce clean prose for TTS.
    """
    if not text:
        return ""

    # 1. Remove trace or metadata panels
    res = _TRACE_BLOCK_RE.sub(" ", text)

    # 2. Replace code blocks with concise spoken placeholder
    res = _CODE_BLOCK_RE.sub(" [Code block omitted] ", res)

    # 3. Replace markdown links [text](url) with just text
    res = _MD_LINK_RE.sub(r"\1", res)

    # 4. Remove bare URLs
    res = _URL_RE.sub(" ", res)

    # 5. Remove citations like [1], [2]
    res = _CITATION_RE.sub(" ", res)

    # 6. Remove inline code backticks keeping inner text
    res = _INLINE_CODE_RE.sub(r"\1", res)

    # 7. Remove header hashes and bullet marks
    res = _HEADER_RE.sub("", res)
    res = _BULLET_RE.sub("", res)

    # 8. Remove asterisks, underscores, tildes
    res = _FORMATTING_CHARS.sub("", res)

    # 9. Clean up multiple whitespaces and newlines
    lines = [line.strip() for line in res.splitlines() if line.strip()]
    res = ". ".join(lines)
    res = re.sub(r"\s+", " ", res)
    res = re.sub(r"\.{2,}", ".", res)
    return res.strip()


def clean_text_for_speech(
    text: str,
    is_unverified: bool = False,
    is_blocked: bool = False,
    max_chars: int = 2000,
) -> str:
    """
    Complete sanitization pipeline before text-to-speech synthesis:
    1. Prepend short notice if answer is unverified or blocked.
    2. Redact secrets.
    3. Strip markdown, code blocks, URLs, citations.
    4. Cap length at max_chars.
    """
    prefix = ""
    if is_blocked:
        prefix = "Request blocked by policy. "
    elif is_unverified:
        prefix = "Warning: this answer could not be fully verified. "

    redacted = redact_secrets(text or "")
    clean = strip_markdown_and_citations(redacted)

    full = f"{prefix}{clean}".strip()
    if len(full) > max_chars:
        # Gracefully truncate at last word boundary before max_chars
        truncated = full[:max_chars].rsplit(" ", 1)[0]
        return truncated + "..."
    return full
