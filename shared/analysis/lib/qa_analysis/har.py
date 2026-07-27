"""HAR (HTTP Archive) parser.

Framework-agnostic: a HAR is a standard JSON format, whoever produced it.
Extracts request outcomes, flags failures and slow calls, and redacts headers
and credentialed URLs before anything is exposed. A malformed HAR raises.
"""

import json

from .redaction import redact_text, redact_headers
from .junit import MalformedArtifact


def parse_har(path, slow_ms=1000):
    """Parse a HAR file into a redacted network summary.

    Returns {entries, failures, slow, redacted: True}, where each entry is
    {method, url, status, durationMs, headersRedacted}. Failures are entries
    with status >= 400 or status 0 (no response). Raises MalformedArtifact on
    unreadable input.
    """
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (json.JSONDecodeError, OSError, UnicodeDecodeError) as exc:
        raise MalformedArtifact(f"could not parse HAR at {path}: {exc}") from exc

    try:
        raw_entries = data["log"]["entries"]
    except (KeyError, TypeError) as exc:
        raise MalformedArtifact(f"not a HAR document at {path}") from exc

    entries = []
    for item in raw_entries:
        request = item.get("request", {})
        response = item.get("response", {})
        status = _int(response.get("status"))
        entry = {
            "method": request.get("method", ""),
            # Redaction strips any credentials embedded in the URL.
            "url": redact_text(request.get("url", "")),
            "status": status,
            "durationMs": int(round(float(item.get("time", 0) or 0))),
            "requestHeaders": redact_headers(request.get("headers", [])),
            "responseHeaders": redact_headers(response.get("headers", [])),
        }
        entries.append(entry)

    failures = [e for e in entries if e["status"] == 0 or e["status"] >= 400]
    slow = [e for e in entries if e["durationMs"] >= slow_ms]
    return {"entries": entries, "failures": failures, "slow": slow, "redacted": True}


def _int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
