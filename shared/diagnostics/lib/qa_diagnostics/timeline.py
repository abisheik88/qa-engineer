"""Deterministic timeline reconstruction.

Reconstructs the ordered sequence of a run — start, browser launch, navigation,
requests and responses, console errors, assertions, failure, cleanup — from the
execution result and the analysis findings. It records only stages for which
there is evidence; it never invents an event to fill the shape. Reusable by
qa-debug and qa-report.
"""

# Canonical phase order, used to sort events that share (or lack) a timestamp.
PHASE_ORDER = [
    "execution-start", "browser-launch", "navigation", "request", "response",
    "console-error", "assertion", "failure", "cleanup", "execution-finish",
]
_PHASE_INDEX = {phase: i for i, phase in enumerate(PHASE_ORDER)}

# Evidence type -> the timeline phase it contributes.
_EVIDENCE_PHASE = {
    "network": "response",
    "console": "console-error",
    "trace": "navigation",
    "junit": "assertion",
    "report": "assertion",
}


def build_timeline(execution_result, findings=None):
    """Build an ordered timeline. Returns a list of event dicts:
    {order, phase, detail, source, timestamp?}. Deterministic: same inputs,
    same timeline. Only evidenced stages appear."""
    events = []
    execution = (execution_result or {}).get("execution", {})

    started = execution.get("startedAt")
    if started or execution_result:
        events.append(_event("execution-start", "Run started", "execution-result", started))

    # Contribute a stage per evidence entry we actually have.
    for finding in findings or []:
        for ev in finding.get("evidence", []):
            phase = _EVIDENCE_PHASE.get(ev.get("type"))
            if phase:
                events.append(_event(phase, ev.get("description", ""), ev.get("source", "analysis"), None))

    # A failure stage per failed test recorded in the result.
    for test in (execution_result or {}).get("executed", []):
        if test.get("status") == "failed":
            events.append(_event("failure", f"Test failed: {test.get('title', '')}",
                                 test.get("file", "execution-result"), None))

    finished = execution.get("finishedAt")
    if finished:
        events.append(_event("cleanup", "Run cleaned up", "execution-result", None))
        events.append(_event("execution-finish", "Run finished", "execution-result", finished))

    # Deterministic order: by canonical phase first (it encodes the logical
    # sequence), then by timestamp within a phase, then by insertion order. Phase
    # order is primary because per-event wall-clock times are often unavailable.
    for i, event in enumerate(events):
        event["_seq"] = i
    events.sort(key=lambda e: (_PHASE_INDEX.get(e["phase"], 99), e["timestamp"] or "", e["_seq"]))
    for order, event in enumerate(events):
        event["order"] = order
        del event["_seq"]
        if event["timestamp"] is None:
            del event["timestamp"]
    return events


def _event(phase, detail, source, timestamp):
    return {"phase": phase, "detail": detail, "source": source, "timestamp": timestamp}
