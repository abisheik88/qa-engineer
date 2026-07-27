"""Playwright-specific analyzers: trace and JSON report.

These are the Playwright *adapter* for the analysis platform. They depend on
the framework-agnostic qa_analysis core for the evidence model, redaction, and
the failure taxonomy; they add only what is Playwright-specific — the shape of
a Playwright trace.zip and of Playwright's JSON reporter. Everything they emit
is in the shared normalized shape, so nothing downstream knows it was Playwright.

The adapter carries its own CLI (`python -m playwright_analysis report|trace
<path>`) so a skill can reach it the same way it reaches every other
deterministic tool. Framework knowledge stays inside the adapter: the core CLI
never grows a `--framework` flag ([ADR-0013](../../../../docs/architecture/ADR-0013-framework-boundary.md)).

Usage:
  python -m playwright_analysis report <results.json>
  python -m playwright_analysis trace <trace.zip>
"""

import argparse
import json
import sys
import zipfile

from qa_analysis.junit import MalformedArtifact
from qa_analysis.redaction import redact_text
from qa_analysis import taxonomy


def parse_report(path):
    """Parse Playwright's JSON reporter output into the normalized result shape.

    Mirrors qa_analysis.junit's output ({tests, executed}) so a Playwright run
    normalizes identically whether it emitted JSON or JUnit. Raises
    MalformedArtifact on unreadable input.
    """
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (json.JSONDecodeError, OSError, UnicodeDecodeError) as exc:
        raise MalformedArtifact(f"could not parse Playwright report at {path}: {exc}") from exc

    executed = []
    for suite in data.get("suites", []):
        _walk_suite(suite, executed)

    counts = {
        "total": len(executed),
        "passed": sum(1 for e in executed if e["status"] == "passed"),
        "failed": sum(1 for e in executed if e["status"] == "failed"),
        "skipped": sum(1 for e in executed if e["status"] == "skipped"),
    }
    return {"tests": counts, "executed": executed}


def _walk_suite(suite, executed):
    for spec in suite.get("specs", []):
        for test in spec.get("tests", []):
            results = test.get("results", [])
            status = _status_of(results)
            message = ""
            if status == "failed" and results:
                errors = results[-1].get("errors") or []
                if errors:
                    message = redact_text((errors[0].get("message") or "").strip())
            entry = {
                "title": spec.get("title", ""),
                "file": suite.get("file", ""),
                "status": status,
                "durationMs": results[-1].get("duration", 0) if results else 0,
                "retries": max(0, len(results) - 1),
            }
            if message:
                entry["message"] = message
            executed.append(entry)
    for child in suite.get("suites", []):
        _walk_suite(child, executed)


def _status_of(results):
    if not results:
        return "skipped"
    final = results[-1].get("status")
    if final in ("passed", "expected"):
        return "flaky" if len(results) > 1 else "passed"
    if final in ("skipped",):
        return "skipped"
    return "failed"


def analyze_trace(path):
    """Extract a deterministic summary from a Playwright trace.zip.

    A trace is a zip of newline-delimited JSON event files. This lists the
    actions, surfaces the last error, and counts console and network events —
    enough for a diagnostic skill to reason over, without decoding the full
    binary. Raises MalformedArtifact if the file is not a valid trace zip.
    """
    if not zipfile.is_zipfile(path):
        raise MalformedArtifact(f"not a valid trace zip: {path}")

    actions, console, network, errors = [], 0, 0, []
    try:
        with zipfile.ZipFile(path) as archive:
            names = [n for n in archive.namelist() if n.endswith(".trace") or n.endswith(".jsonl") or "trace" in n]
            for name in names or archive.namelist():
                with archive.open(name) as member:
                    for raw in member.read().decode("utf-8", "replace").splitlines():
                        raw = raw.strip()
                        if not raw or not raw.startswith("{"):
                            continue
                        try:
                            event = json.loads(raw)
                        except json.JSONDecodeError:
                            continue
                        kind = event.get("type") or event.get("kind")
                        if kind in ("action", "before"):
                            actions.append(redact_text(str(event.get("apiName") or event.get("method") or "")))
                        elif kind == "console":
                            console += 1
                        elif kind in ("resource", "network", "http"):
                            network += 1
                        if event.get("error") or kind == "error":
                            msg = event.get("error", {}).get("message") if isinstance(event.get("error"), dict) else event.get("message")
                            if msg:
                                errors.append(redact_text(str(msg)))
    except (OSError, KeyError) as exc:
        raise MalformedArtifact(f"could not read trace {path}: {exc}") from exc

    last_error = errors[-1] if errors else ""
    classification, confidence, reason = taxonomy.classify(last_error) if last_error else (taxonomy.UNKNOWN, 0.2, "No error found in trace.")
    return {
        "actions": [a for a in actions if a],
        "consoleEvents": console,
        "networkEvents": network,
        "errors": errors,
        "classification": classification,
        "confidence": confidence,
        "reason": reason,
    }


def main(argv=None):
    """CLI: JSON to stdout, exit 0 on success, 2 on a malformed artifact."""
    parser = argparse.ArgumentParser(
        prog="playwright_analysis",
        description="Playwright adapter: normalize a JSON report or summarize a trace",
    )
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("report", help="normalize Playwright's JSON reporter output")
    p.add_argument("path")
    p = sub.add_parser("trace", help="summarize a Playwright trace.zip")
    p.add_argument("path")
    args = parser.parse_args(argv)

    try:
        result = parse_report(args.path) if args.command == "report" else analyze_trace(args.path)
    except MalformedArtifact as exc:
        json.dump({"error": "malformed-artifact", "detail": str(exc)}, sys.stdout, indent=2, sort_keys=True)
        sys.stdout.write("\n")
        return 2
    json.dump(result, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
