"""JUnit XML parser.

Framework-agnostic: Playwright, Selenium, Cypress, WebdriverIO, and most unit
runners emit JUnit XML, so this one parser normalizes them all into the pack's
per-test result shape. This is the concrete proof that different frameworks
share one contract — only where the file lives differs, not how it is read.

Parses deterministically; a malformed document raises rather than guessing.
"""

import xml.etree.ElementTree as ET

from .redaction import redact_text


class MalformedArtifact(ValueError):
    """Raised when an artifact cannot be parsed. Never swallowed into a guess."""


def _int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _duration_ms(raw, path):
    """`time` in seconds as whole milliseconds.

    An absent or empty attribute is zero — plenty of runners omit it. A value
    that is present but not a finite number means the document is not what it
    claims to be, so it raises: found by the Node port's parity corpus, where
    `time="not-a-number"` escaped as a bare ValueError and `time="nan"` as
    "cannot convert float NaN to integer". Both reached the caller as a traceback
    and exit 1, while the CLI's documented failure mode is exit 2 with
    {error, detail}.
    """
    if raw is None or raw == "":
        return 0
    try:
        seconds = float(raw)
    except (TypeError, ValueError):
        raise MalformedArtifact(
            f"testcase time={raw!r} is not a number at {path}"
        ) from None
    if seconds != seconds or seconds in (float("inf"), float("-inf")):
        raise MalformedArtifact(f"testcase time={raw!r} is not a finite number at {path}")
    return int(round(seconds * 1000))


def parse_junit(path):
    """Parse a JUnit XML file into a normalized result.

    Returns a dict: {tests: {total, passed, failed, skipped}, executed: [...]}.
    Each executed entry: {title, file, status, durationMs, message?}.
    Raises MalformedArtifact if the XML is unreadable or not JUnit-shaped.
    """
    try:
        tree = ET.parse(path)
    except (ET.ParseError, OSError) as exc:
        raise MalformedArtifact(f"could not parse JUnit XML at {path}: {exc}") from exc

    root = tree.getroot()
    # Accept either a <testsuites> root or a single <testsuite> root.
    if root.tag == "testsuites":
        suites = root.findall("testsuite")
    elif root.tag == "testsuite":
        suites = [root]
    else:
        raise MalformedArtifact(f"not a JUnit document (root <{root.tag}>) at {path}")

    executed = []
    for suite in suites:
        for case in suite.findall("testcase"):
            failure = case.find("failure")
            error = case.find("error")
            skipped = case.find("skipped")
            if failure is not None or error is not None:
                status = "failed"
                node = failure if failure is not None else error
                message = redact_text((node.get("message") or node.text or "").strip())
            elif skipped is not None:
                status = "skipped"
                message = redact_text((skipped.get("message") or "").strip())
            else:
                status = "passed"
                message = ""
            entry = {
                "title": case.get("name", ""),
                "file": case.get("classname", ""),
                "status": status,
                "durationMs": _duration_ms(case.get("time"), path),
            }
            if message:
                entry["message"] = message
            executed.append(entry)

    counts = {
        "total": len(executed),
        "passed": sum(1 for e in executed if e["status"] == "passed"),
        "failed": sum(1 for e in executed if e["status"] == "failed"),
        "skipped": sum(1 for e in executed if e["status"] == "skipped"),
    }
    return {"tests": counts, "executed": executed}
