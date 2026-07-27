"""The diagnostic engine — the one place failure reasoning happens.

Orchestrates the analysis platform and the diagnostics modules into a single
diagnosis: per-failure root cause, prioritization, a reconstructed timeline, and
ranked recommendations. qa-debug presents the diagnosis; qa-fix turns it into
repair plans; qa-report aggregates diagnoses. None of them re-implements this.
"""

from qa_analysis import taxonomy

from . import root_cause, prioritization, repair, timeline
from . import internal_contracts

_PRIORITY_RANK = {"P1": 3, "P2": 2, "P3": 1}

# Classifications that block a release when they are the cause of a failure.
_RELEASE_BLOCKING = {
    taxonomy.APPLICATION_BUG, taxonomy.NETWORK, taxonomy.INFRASTRUCTURE,
    taxonomy.AUTH, taxonomy.AUTHORIZATION,
}


def diagnose(execution_result, analysis_result=None, generation_result=None):
    """Produce a full diagnosis from the available results.

    Returns {entries: [...], timeline: [...], recommendations: [...]}, where each
    entry combines a root cause with its prioritization and affected tests.
    """
    signals = _signals(execution_result, analysis_result)
    findings = (analysis_result or {}).get("findings", [])

    entries = []
    for signal in signals:
        rc = root_cause.analyze(signal)
        blocking = rc["classification"] in _RELEASE_BLOCKING
        prio = prioritization.prioritize(rc, blocking=blocking)
        entries.append({
            "rootCause": rc,
            "priority": prio,
            "affectedTests": signal.get("affectedTests", []),
        })

    entries.sort(key=lambda e: (_PRIORITY_RANK.get(e["priority"]["priority"], 0),
                                e["rootCause"]["confidence"]), reverse=True)

    diagnosis = {
        "entries": entries,
        "timeline": timeline.build_timeline(execution_result, findings),
        "recommendations": _recommendations(entries),
    }
    # Mechanical seam enforcement: diagnosis must match the internal contract.
    return internal_contracts.validate_diagnosis(diagnosis)


def plan_repairs(diagnosis):
    """Turn a diagnosis into repair plans (for qa-fix). One plan per entry;
    non-repairable causes yield an escalation plan. Never produces code."""
    plans = []
    for entry in diagnosis["entries"]:
        plan = repair.plan_repair(entry["rootCause"], affected_files=entry.get("affectedTests"))
        plan["priority"] = entry["priority"]["priority"]
        plans.append(plan)
    return plans


def summarize(execution_result, diagnosis):
    """Aggregate a diagnosis for qa-report: totals, breakdown by classification,
    the top-priority findings, and a deterministic release-readiness call."""
    tests = (execution_result or {}).get("tests", {})
    by_class = {}
    for entry in diagnosis["entries"]:
        cls = entry["rootCause"]["classification"]
        by_class[cls] = by_class.get(cls, 0) + 1

    return {
        "totals": tests,
        "byClassification": by_class,
        "topPriority": [e for e in diagnosis["entries"] if e["priority"]["priority"] == "P1"],
        "releaseReadiness": _release_readiness(execution_result, diagnosis),
    }


def _signals(execution_result, analysis_result):
    """Derive failure signals, preferring the analysis platform's findings."""
    signals = []
    findings = (analysis_result or {}).get("findings", [])
    if findings:
        for f in findings:
            signals.append({
                "message": f.get("reason", ""),
                "classification": f.get("classification"),
                "confidence": f.get("confidence"),
                "reason": f.get("reason"),
                "httpStatus": f.get("httpStatus"),
                "retries": f.get("retries", 0),
                "finalStatus": f.get("finalStatus"),
                "evidence": f.get("evidence", []),
                "affectedTests": f.get("affectedTests", []),
            })
        return signals

    for test in (execution_result or {}).get("executed", []):
        if test.get("status") in ("failed", "flaky"):
            signals.append({
                "message": test.get("message", ""),
                "retries": test.get("retries", 0),
                "finalStatus": test.get("status"),
                "affectedTests": [test.get("title", "")],
                "evidence": [{
                    "type": "junit",
                    "description": f"{test.get('status')}: {test.get('title', '')}",
                    "source": test.get("file", "execution-result"),
                }],
            })
    return signals


def _recommendations(entries):
    """Ranked, de-duplicated recommendations — highest priority first."""
    seen, ranked = set(), []
    for entry in entries:
        rec = entry["rootCause"]["recommendation"]
        if rec not in seen:
            seen.add(rec)
            ranked.append({
                "action": rec,
                "priority": entry["priority"]["priority"],
                "owner": entry["rootCause"]["ownership"],
                "classification": entry["rootCause"]["classification"],
            })
    return ranked


def _release_readiness(execution_result, diagnosis):
    failed = (execution_result or {}).get("tests", {}).get("failed", 0)
    if failed == 0 and not diagnosis["entries"]:
        return "ready"
    classes = {e["rootCause"]["classification"] for e in diagnosis["entries"]}
    if classes & _RELEASE_BLOCKING:
        return "not-ready"
    if classes <= {taxonomy.UNKNOWN}:
        return "insufficient-data"
    return "ready-with-risks"
