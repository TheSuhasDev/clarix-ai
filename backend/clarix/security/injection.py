"""Heuristic prompt-injection / jailbreak detector.

HONEST LIMITS: this is pattern matching over normalised text. It catches common, known phrasings and
obvious obfuscation (unicode tricks, spaced-out letters, base64). A determined attacker can evade it,
and benign text can trigger it. It is ONE layer. The load-bearing protections are the capability gates
(tool permissions, policy engine, taint/sink rules, human approval, air-gap), which hold even if this
detector is fooled.
"""
from __future__ import annotations

import base64
import binascii
import re
import unicodedata
from dataclasses import dataclass, field

from ..classification import CLASSES, max_class

MAX_INPUT = 8000
BLOCK_AT, REVIEW_AT = 60, 35

_ZW = re.compile(r"[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff\u00ad\u2000-\u200a\u2028\u2029]")
_CTRL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")
_SPACED = re.compile(r"\b(?:[a-z]\s){2,}[a-z]\b")
_B64 = re.compile(r"[A-Za-z0-9+/]{24,}={0,2}")
_HOMOGLYPH = str.maketrans({
    "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s",
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "s", "у": "y", "х": "x", "і": "i",
    "ј": "j", "ѕ": "s", "ԁ": "d", "ԛ": "q", "ν": "v"
})


@dataclass(frozen=True)
class Rule:
    name: str
    category: str
    weight: int
    reason: str
    pattern: re.Pattern


def _r(name: str, cat: str, w: int, reason: str, pat: str) -> Rule:
    return Rule(name, cat, w, reason, re.compile(pat, re.I | re.S))


RULES: tuple[Rule, ...] = (
    _r("override", "Instruction Override", 60, "Attempt to override system instructions.",
       r"\b(ignore|disregard|forget|override|bypass|skip)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|any|your|the|these)\b[^.\n]{0,30}\b(instructions?|rules?|constraints?|guidelines?|prompts?|directives?|polic(?:y|ies)|safety)\b"),
    _r("new-instructions", "Instruction Override", 25, "Presents replacement instructions.", r"\b(new|updated|revised) (system )?(instructions?|rules?)\s*:"),
    _r("prompt-leak", "System Prompt Leak", 50, "Attempt to extract the system prompt.",
       r"\b(reveal|show|print|repeat|output|display|leak|dump|tell me|disclose)\b[^.\n]{0,70}\b(system|hidden|initial|original|secret|internal)\s+(prompt|instructions?|message|rules)\b"),
    _r("repeat-above", "System Prompt Leak", 45, "Asks the model to repeat its preceding context.", r"\brepeat\b[^.\n]{0,20}\b(everything|all|the text|the words)\b[^.\n]{0,15}\b(above|before)\b"),
    _r("roleplay-jailbreak", "Jailbreak Pattern", 60, "Role-play override pattern.",
       r"\b(you are now|pretend (to be|you are)|act as|roleplay as|from now on,? you)\b[^.\n]{0,50}\b(dan|unrestricted|unfiltered|jailbroken|no (rules|restrictions|limits|filters)|developer mode|evil)\b"),
    _r("secret-request", "Credential Access", 35, "Requests a secret, token or password.",
       r"\b(print|reveal|show|give|output|display|send)\b[^.\n]{0,30}\b(admin|root|api|access|auth)?\s*(token|password|passwd|credentials?)\b"),
    _r("dan", "Jailbreak Pattern", 55, "Known jailbreak phrase.", r"\bdo anything now\b"),
    _r("mode-switch", "Jailbreak Pattern", 45, "Fake privileged-mode activation.", r"\b(developer|debug|god|admin|sudo) mode (enabled|on|activated|unlocked)\b"),
    _r("delimiter", "Delimiter Injection", 40, "Contains chat-template or role delimiters.",
       r"<\|?(im_start|im_end|system|endoftext)\|?>|\[/?inst\]|<</?sys>>|(^|\n)\s*(system|assistant)\s*:"),
    _r("net-exfil-cmd", "Data Exfiltration", 50, "References an outbound network command.",
       r"\b(curl|wget|nc|ncat|netcat|invoke-webrequest|iwr|scp|sftp|ftp|telnet)\b[^\n]{0,80}(https?://|\b\d{1,3}(\.\d{1,3}){3}\b|[a-z0-9-]+\.[a-z]{2,})"),
    _r("exfil-dest", "Data Exfiltration", 45, "Asks to transmit data to an external destination.",
       r"\b(send|email|e-mail|post|upload|transmit|forward|exfiltrate|leak)\b[^\n]{0,60}\b(to|at|via)\b[^\n]{0,30}(\b[\w.+-]+@[\w-]+\.[\w.]+|https?://\S+|\b[a-z0-9-]+\.(com|org|net|io|ru|cn|xyz|evil)\b)"),
    _r("cred-files", "Credential Access", 35, "Targets credential or system files.", r"(/etc/(passwd|shadow|sudoers)|(^|[\s/\"'])\.env\b|id_rsa|\.ssh/|\.aws/credentials)"),
    _r("classified-out", "Data Exfiltration", 30, "Classified material combined with an outbound transfer request.",
       r"(confidential|secret|restricted|financial|proprietary)[^\n]{0,80}\b(send|post|upload|email|transmit|forward)\b|\b(send|post|upload|email|transmit|forward)\b[^\n]{0,80}(confidential|secret|restricted|proprietary)"),
    _r("shell-inject", "Command Injection", 40, "Shell metacharacter / command injection pattern.",
       r"(\$\(|`[^`]+`|;\s*(rm|cat|curl|wget|chmod|sh|bash|nc)\b|\|\s*(sh|bash)\b|&&\s*(rm|curl|wget)\b|\brm\s+-rf\b)"),
    _r("conceal", "Indirect Injection", 35, "Instructs concealment from the user/operator.",
       r"\b(do not|don't|never)\b[^.\n]{0,20}\b(tell|inform|alert|notify|mention|reveal)\b[^.\n]{0,25}\b(user|operator|human|anyone)\b"),
    _r("addresses-ai", "Indirect Injection", 40, "Text addresses the AI directly (typical of injected documents).",
       r"\b(when|if|once) (the |an )?(ai|assistant|model|llm|agent|chatbot)\b[^.\n]{0,40}\b(reads?|sees?|processes?|summari[sz]es?|encounters?)\b|\battention[, ]+(ai|assistant|llm|model)\b"),
    _r("hidden-comment", "Indirect Injection", 40, "Instruction hidden in a comment.", r"<!--[^>]{0,300}(ignore|instruction|assistant|system)[^>]*-->"),
    _r("disable-controls", "Policy Evasion", 45, "Asks to disable safety, filtering or logging.",
       r"\b(disable|turn off|deactivate|remove|bypass)\b[^.\n]{0,30}\b(safety|filters?|guardrails?|polic(y|ies)|monitoring|logging|audit)\b"),
    _r("tool-abuse", "Tool Abuse", 45, "Explicitly requests a forbidden sink tool.", r"\b(call|invoke|use|run|execute)\b[^.\n]{0,20}\b(http_post|send_email|network_request|database_export)\b"),
    # SEC-03: Multilingual patterns for Spanish, French, German, Hindi, Kannada, Portuguese, Chinese, Arabic
    _r("multilingual-override", "Instruction Override", 60, "Multilingual attempt to override system instructions.",
       r"("
       r"\b(ignora|ignorar|olvida|olvidar|desecha|descartar)\b[^.\n]{0,50}\b(instrucciones|reglas|directrices|indicaciones)\b|"
       r"\b(ignore|ignorez|oublie|oubliez|annule|annulez)\b[^.\n]{0,50}\b(instructions|consignes|règles|regles|directives)\b|"
       r"\b(ignoriere|ignorieren|vergiss|vergessen Sie|verwerfe)\b[^.\n]{0,50}\b(anweisungen|instruktionen|regeln|richtlinien|prompts)\b|"
       r"\b(pichhle|pichle|purane|saare|sabhi)\s+(nirdesh|instructions?|hidayat(en)?)\s+(bhool|chhod|ignore|disregard)\b|"
       r"\b(पिछली|पिछले|सारे|सभी)\s+(निर्देश|हिदायतें|नियम|इंस्ट्रक्शन)\s+(भूल|छोड़|अनदेखा)\b|"
       r"\b(hinde|hindina|ella)\s+(soochane|instructions?|nirdesha)\s*(annu)?\s*(marethu|bittubidu|ignore)\b|"
       r"\b(ignore|desconsidere|esqueça|esqueca)\b[^.\n]{0,50}\b(instruções|instrucoes|regras|diretrizes)\b|"
       r"(忽略|无视|忘记|跳过|撤销)(之前|以往|所有|全部|以上)?的?(指示|指令|提示词|规则|要求)|"
       r"(تجاهل|انس[ىي]|الغ[يى]|اترك)\s+(جميع\s+|كل\s+)?(التعليمات|الأوامر|الاوامر|التوجيهات|القواعد)"
       r")"),
    _r("multilingual-leak", "System Prompt Leak", 50, "Multilingual attempt to extract system prompt.",
       r"("
       r"\b(muestra|revela|imprime|dime|exhibe)\b[^.\n]{0,50}\b(el\s+prompt|el\s+mensaje|las\s+instrucciones|la\s+configuraci[oó]n)\s+(del?\s+)?sistema\b|"
       r"\b(révèle|revele|affiche|montre|donne)\b[^.\n]{0,50}\b(le\s+prompt|le\s+message|les\s+instructions)\s+(du\s+)?système\b|"
       r"\b(zeige|offenbare|nenne|gib)\b[^.\n]{0,50}\b(system-?prompt|systemanweisungen|system-?instruktionen)\b|"
       r"\b(system\s+prompt|system\s+instructions?)\s+(dikhao|batao|reveal\s+karo|print\s+karo)\b|"
       r"\b(सिस्टम\s+प्रॉम्प्ट|सिस्टम\s+निर्देश|सिस्टम\s+संदेश)\s+(दिखाओ|बताओ|प्रकट\s+करो)\b|"
       r"\b(system\s+prompt|system\s+instructions?)\s+(thorisu|heli|display\s+maadu)\b|"
       r"\b(revele|mostre|exiba|diga)\b[^.\n]{0,50}\b(prompt|instruções)\s+(do\s+)?sistema\b|"
       r"(显示|输出|透露|告诉我|打印)(系统)?(提示词|指令|规则|system\s*prompt)|"
       r"(اظهر|اكشف|اعرض|قل\s+لي|اطبع)\s+(موجه|تعليمات|رسالة)\s+النظام"
       r")"),
    _r("multilingual-jailbreak", "Jailbreak Pattern", 60, "Multilingual roleplay or developer mode jailbreak.",
       r"("
       r"\b(ahora\s+eres|act[uú]a\s+como|comportate\s+como)\b[^.\n]{0,40}\b(dan|sin\s+restricciones|modo\s+desarrollador|unrestricted)\b|\bmodo\s+desarrollador\s+(activado|desbloqueado|on)\b|"
       r"\b(tu\s+es\s+maintenant|agis\s+comme)\b[^.\n]{0,40}\b(dan|sans\s+limites?|mode\s+d[ée]veloppeur)\b|\bmode\s+d[ée]veloppeur\s+(activ[ée]|on)\b|"
       r"\b(du\s+bist\s+jetzt|handle\s+als)\b[^.\n]{0,40}\b(dan|ohne\s+einschr[äa]nkungen|entwicklermodus)\b|\bentwicklermodus\s+(aktiviert|ein|on)\b|"
       r"\b(ab\s+tum|tum\s+ab)\s+(dan|developer\s+mode|bina\s+niyam)\b|\bdeveloper\s+mode\s+(on|chalu|activate)\b|"
       r"\b(अब\s+तुम|तुम\s+अब)\s+(डेवलपर\s+मोड|डैन|बिना\s+नियम)\b|\bडेवलपर\s+मोड\s+(चालू|सक्रिय)\b|"
       r"\b(neenu\s+eega|neevu\s+eega)\s+(dan|developer\s+mode)\b|"
       r"\b(voc[eê]\s+agora\s+[eé]|aja\s+como)\b[^.\n]{0,40}\b(dan|sem\s+restri[cç][oõ]es|modo\s+desenvolvedor)\b|\bmodo\s+desenvolvedor\s+(ativado|on)\b|"
       r"(你现在是|扮演|进入)(开发者模式|无限制模式|DAN|evil)|(开发者模式|无限制模式)(激活|开启|启用)|"
       r"(أنت\s+الآن|انت\s+الان|تصرف\s+كـ?)[^.\n]{0,40}(دان|dan|وضع\s+المطور|بدون\s+قيود)|وضع\s+المطور"
       r")"),
)


@dataclass
class Verdict:
    category: str
    risk: int
    decision: str
    risk_label: str
    reason: str
    matched: list[str] = field(default_factory=list)
    trust: str = "USER"
    classification: str = "INTERNAL"
    obfuscated: bool = False

    def to_dict(self) -> dict:
        return {"category": self.category, "risk": self.risk, "decision": self.decision, "riskLabel": self.risk_label,
                "reason": self.reason, "matched": self.matched, "trust": self.trust, "classification": self.classification}


def normalise(text: str) -> tuple[str, bool]:
    """NFKC fold, strip zero-width/control chars, collapse whitespace; join 's p a c e d' letters."""
    changed = False
    t = unicodedata.normalize("NFKC", text)
    t2 = _CTRL.sub(" ", _ZW.sub("", t))
    changed |= t2 != t
    low = t2.lower()
    spaced = bool(_SPACED.search(re.sub(r" {2,}", "  ", low)))
    if spaced:
        # Mark 2+ spaces as word gaps
        low = re.sub(r" {2,}", "\x00", low)
        # Collapse sequences of spaced single letters: e.g. "s y s t e m" -> "system", "i g n o r e" -> "ignore"
        low = re.sub(r"\b[a-z](?:\s+[a-z]){2,}\b", lambda m: re.sub(r"\s+", "", m.group(0)), low)
        low = _SPACED.sub(lambda m: m.group(0).replace(" ", ""), low)
        low = low.replace("\x00", " ")
        changed = True
    low = re.sub(r"[ \t\r\f\v]+", " ", low)
    return low, changed


SQUASHED = {
    "ignoreallpreviousinstructions": 60, "ignorepreviousinstructions": 60, "ignoreallinstructions": 60,
    "disregardpreviousinstructions": 60, "ignoretheaboveinstructions": 60, "revealthesystemprompt": 50,
    "revealyoursystemprompt": 50, "youarenowdan": 60, "doanythingnow": 55, "developermode": 45,
    "systemprompt": 50, "ignoratodaslasinstrucciones": 60, "ignorartodaslasinstrucciones": 60,
    "ignoretouteslesinstructions": 60, "ignorierealleanweisungen": 60, "pichlenirdeshbhooljao": 60,
    "hindinasochanemarethu": 60, "ignoreasinstrucoes": 60,
}


def _decoded_b64(text: str) -> list[str]:
    out = []
    for m in _B64.findall(text)[:5]:
        try:
            raw = base64.b64decode(m + "=" * (-len(m) % 4), validate=True)
            s = raw.decode("utf-8")
        except (binascii.Error, UnicodeDecodeError, ValueError):
            continue
        if s and sum(ch.isprintable() or ch in "\n\t" for ch in s) / len(s) > 0.95 and len(s) >= 12:
            out.append(s)
    return out


def _guess_classification(text: str) -> str:
    low = text.lower()
    if re.search(r"\b(top secret|classified document|classified project|restricted clearance|restricted access)\b", low):
        return "RESTRICTED"
    if re.search(r"\b(confidential password|financial record|payroll database|master credential|secret key)\b", low):
        return "CONFIDENTIAL"
    return "INTERNAL"


def _label(score: int) -> str:
    return "CRITICAL" if score >= 85 else "HIGH" if score >= BLOCK_AT else "MEDIUM" if score >= REVIEW_AT else "LOW"


def scan(text: str, trust: str = "USER") -> Verdict:
    """Score `text`. Untrusted sources (documents, tool output) use the same rules."""
    if text is None:
        text = ""
    text = text[:MAX_INPUT]
    norm, obf = normalise(text)
    variants = [norm, norm.translate(_HOMOGLYPH)]
    decoded = _decoded_b64(text)
    hits: dict[str, Rule] = {}
    for v in variants + [d.lower() for d in decoded]:
        for rule in RULES:
            if rule.name not in hits and rule.pattern.search(v):
                hits[rule.name] = rule
    if obf:  # letters were spaced/zero-width obfuscated: also test the fully squashed text
        squashed = re.sub(r"[^a-z0-9]", "", norm)
        for phrase, w in SQUASHED.items():
            if phrase in squashed and "squashed" not in hits:
                hits["squashed"] = Rule("squashed", "Instruction Override" if "ignore" in phrase or "disregard" in phrase else "Jailbreak Pattern", w, "Obfuscated (spaced-out) injection phrase.", re.compile("x"))
    enc_hit = bool(decoded) and any(rule.pattern.search(d.lower()) for d in decoded for rule in RULES)
    weights = sorted((r.weight for r in hits.values()), reverse=True)
    score = 4
    if weights:
        score += weights[0] + int(0.4 * sum(weights[1:]))
    if enc_hit:
        score += 20
    if obf and hits:
        score += 10
    score = min(99, score)
    top = max(hits.values(), key=lambda r: r.weight) if hits else None
    category = "Obfuscated Payload" if enc_hit else (top.category if top else "Benign request")
    reason = ("Hidden base64 payload contains injection patterns." if enc_hit
              else top.reason if top else "No suspicious patterns matched by the heuristic detector.")
    decision = "BLOCK" if score >= BLOCK_AT else "REQUIRE_APPROVAL" if score >= REVIEW_AT else "ALLOW"
    cls = "INTERNAL" if (not hits and not enc_hit) else _guess_classification(text)
    return Verdict(category=category, risk=score, decision=decision, risk_label=_label(score), reason=reason,
                   matched=sorted(hits), trust=trust, classification=cls, obfuscated=obf)


__all__ = ["scan", "Verdict", "BLOCK_AT", "REVIEW_AT", "MAX_INPUT", "CLASSES", "max_class"]
