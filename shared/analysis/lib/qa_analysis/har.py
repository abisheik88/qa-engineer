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

    # The shape has to be checked, not assumed. `log.entries` being a *string*
    # satisfies the subscripting above, and iterating it then yields characters,
    # so the parser died on `'str' object has no attribute 'get'` — an
    # AttributeError, which the CLI does not catch, so the caller got a traceback
    # instead of the documented exit 2. Found by the Node port's parity gate.
    if not isinstance(raw_entries, list):
        raise MalformedArtifact(f"HAR log.entries is not a list at {path}")

    entries = []
    for item in raw_entries:
        if not isinstance(item, dict):
            raise MalformedArtifact(f"HAR log.entries contains a non-object at {path}")
        request = item.get("request") or {}
        response = item.get("response") or {}
        status = _int(response.get("status"))
        entry = {
            "method": request.get("method", ""),
            # Redaction strips any credentials embedded in the URL.
            "url": redact_text(request.get("url", "")),
            "status": status,
            "durationMs": _millis(item.get("time"), path),
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


def _millis(raw, path):
    """HAR `time` is already milliseconds, rounded to a whole number.

    A value that is present but not a number raises rather than becoming 0 — the
    same rule as the JUnit parser, and for the same reason: a fabricated duration
    makes a malformed document look like a clean measurement. Before this, the
    bare `float()` escaped as a ValueError and reached the caller as a traceback.
    """
    if raw is None or raw == "":
        return 0
    try:
        value = float(raw)
    except (TypeError, ValueError):
        raise MalformedArtifact(f"entry time={raw!r} is not a number at {path}") from None
    if value != value or value in (float("inf"), float("-inf")):
        raise MalformedArtifact(f"entry time={raw!r} is not a finite number at {path}")
    return int(round(value))
