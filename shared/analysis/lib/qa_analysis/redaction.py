"""Credential, secret, token, and PII redaction.

Every analyzer runs artifact text through redaction before it appears in a
finding, a report, or stdout. Redaction happens as evidence is captured, not
after — a secret must never reach a model's context or a log. Standard library
only; deterministic.
"""

import re

# Ordered (name, pattern, replacement). Order matters: match structured,
# high-signal secrets (JWTs, provider keys) before generic fallbacks.
_RULES = [
    ("jwt", re.compile(r"eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}")),
    ("aws-access-key", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("github-token", re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}")),
    ("slack-token", re.compile(r"xox[baprs]-[A-Za-z0-9-]{10,}")),
    ("openai-key", re.compile(r"sk-[A-Za-z0-9]{20,}")),
    ("bearer", re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/-]+=*")),
    # Sensitive header lines: keep the header name, mask the value.
    #
    # The value is `[^\r\n]+` rather than `.+$`, and the indent is `[ \t]*` rather
    # than `\s*`, for one reason: on CRLF text, `.+` swallows the carriage return
    # and `$` matches before the newline, so redacting a header silently rewrote
    # the line ending to LF and corrupted the rest of the document's endings.
    # Horizontal whitespace is also what a header indent actually is. Found by the
    # Node port's parity corpus, where the two languages disagreed here and
    # JavaScript was right.
    ("auth-header", re.compile(r"(?im)^([ \t]*(?:authorization|proxy-authorization)[ \t]*[:=][ \t]*)[^\r\n]+")),
    ("cookie-header", re.compile(r"(?im)^([ \t]*(?:set-cookie|cookie)[ \t]*[:=][ \t]*)[^\r\n]+")),
    # Secret-like assignments: key=value / "key": "value".
    ("assigned-secret", re.compile(
        r'(?i)(\b(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret)\b\s*[:=]\s*["\']?)'
        r'([^\s"\'&]{4,})')),
    # Credentials in URLs and query strings.
    ("url-credential", re.compile(r"(?i)(://[^:/@\s]+:)([^@/\s]+)(@)")),
    ("query-secret", re.compile(
        r"(?i)([?&](?:password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key)=)([^&\s#]+)")),
    # PII: email addresses.
    ("email", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")),
]

# Rules whose replacement preserves a leading captured group (the label/prefix).
_PREFIX_PRESERVING = {
    "auth-header": r"\1[REDACTED:auth-header]",
    "cookie-header": r"\1[REDACTED:cookie-header]",
    "assigned-secret": r"\1[REDACTED:secret]",
    "url-credential": r"\1[REDACTED:credential]\3",
    "query-secret": r"\1[REDACTED:secret]",
}


def redact_text(text):
    """Return text with every recognized secret or PII value masked."""
    if not text:
        return text
    result = text
    for name, pattern in _RULES:
        if name in _PREFIX_PRESERVING:
            result = pattern.sub(_PREFIX_PRESERVING[name], result)
        else:
            result = pattern.sub(f"[REDACTED:{name}]", result)
    return result


def detect_secrets(text):
    """Return a list of {type, start, end} for secrets found — never the values.

    Used to decide whether an artifact is safe to expose, without surfacing the
    secret itself.
    """
    findings = []
    if not text:
        return findings
    for name, pattern in _RULES:
        for match in pattern.finditer(text):
            findings.append({"type": name, "start": match.start(), "end": match.end()})
    findings.sort(key=lambda f: f["start"])
    return findings


_SENSITIVE_HEADERS = {
    "authorization", "proxy-authorization", "cookie", "set-cookie",
    "x-api-key", "x-auth-token", "api-key", "x-csrf-token",
}


def redact_headers(headers):
    """Mask the values of sensitive HTTP headers.

    Accepts a dict, or a list of {"name","value"} entries (HAR shape), and
    returns the same shape with sensitive values replaced.
    """
    def mask(name, value):
        return "[REDACTED:header]" if name.strip().lower() in _SENSITIVE_HEADERS else redact_text(value)

    if isinstance(headers, dict):
        return {k: mask(k, str(v)) for k, v in headers.items()}
    if isinstance(headers, list):
        out = []
        for entry in headers:
            if isinstance(entry, dict) and "name" in entry:
                out.append({**entry, "value": mask(str(entry["name"]), str(entry.get("value", "")))})
            else:
                out.append(entry)
        return out
    return headers
