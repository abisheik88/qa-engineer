"""Deterministic root-cause analysis.

Turns a failure signal into a classified root cause with the four things every
classification must carry: a taxonomy class (with confidence and evidence-backed
reason), a recommended action, and an owner. It reuses the analysis platform's
failure taxonomy; it adds the ownership and recommendation mappings and the
metadata-driven classes (flaky) the taxonomy cannot infer from a message alone.

No unsupported conclusions: a signal that matches no rule is `unknown`.
"""

from qa_analysis import taxonomy

# classification -> the party that typically owns the fix.
OWNERSHIP = {
    taxonomy.ASSERTION: "test-author-or-product",
    taxonomy.LOCATOR: "test-author",
    taxonomy.TIMEOUT: "test-author-or-environment",
    taxonomy.NETWORK: "backend-or-infrastructure",
    taxonomy.AUTH: "auth-or-test-setup",
    taxonomy.AUTHORIZATION: "permissions-or-test-account",
    taxonomy.ENVIRONMENT: "environment-owner",
    taxonomy.CONFIGURATION: "config-owner",
    taxonomy.INFRASTRUCTURE: "ci-or-infrastructure",
    taxonomy.TEST_DATA: "test-data-owner",
    taxonomy.APPLICATION_BUG: "product",
    taxonomy.FRAMEWORK: "framework-or-driver",
    taxonomy.FLAKY: "test-author",
    taxonomy.UNKNOWN: "needs-triage",
}

# classification -> the safe recommended action (implements the analysis
# platform's recommendation-guidelines; never recommends forcing a pass).
RECOMMENDATION = {
    taxonomy.ASSERTION: "Confirm whether the app or the expectation is wrong; fix whichever is genuinely incorrect.",
    taxonomy.LOCATOR: "Inspect the current DOM and update the locator to target the same element.",
    taxonomy.TIMEOUT: "Investigate the slowness; raise a wait only if the operation is legitimately slower.",
    taxonomy.NETWORK: "Check the upstream service and the request; retry only if the failure is genuinely transient.",
    taxonomy.AUTH: "Fix the credentials or auth setup; do not weaken the authentication check.",
    taxonomy.AUTHORIZATION: "Grant the test account the needed permission or use an authorized role; do not bypass the check.",
    taxonomy.ENVIRONMENT: "Fix the environment (base URL, service availability); the test is likely fine.",
    taxonomy.CONFIGURATION: "Correct the configuration; do not work around it in the test.",
    taxonomy.INFRASTRUCTURE: "Escalate to CI or infrastructure owners; add resources, do not shrink the suite.",
    taxonomy.TEST_DATA: "Repair or reseed the data; do not delete the assertion that caught the gap.",
    taxonomy.APPLICATION_BUG: "File a bug against the product; do NOT modify the test to pass.",
    taxonomy.FRAMEWORK: "Update or pin the framework/driver; report upstream if it is a genuine defect.",
    taxonomy.FLAKY: "Stabilize the test (fix the race or synchronization); quarantine only with a tracking issue.",
    taxonomy.UNKNOWN: "Investigate further; the evidence was insufficient to classify.",
}


def analyze(signal):
    """Classify a failure signal into a root cause.

    signal is a dict that may contain: message, httpStatus, retries, finalStatus,
    evidence (a list of evidence refs). Returns a dict:
    {classification, confidence, reason, ownership, recommendation, evidence}.
    """
    message = signal.get("message", "")
    http_status = signal.get("httpStatus")
    retries = signal.get("retries", 0) or 0
    final_status = signal.get("finalStatus")

    provided = signal.get("classification")

    # Flakiness is a metadata signal, not a message pattern: a test that needed a
    # retry to pass, or is explicitly flagged flaky, is nondeterministic.
    if final_status == "flaky" or (retries > 0 and final_status in ("passed", "flaky")):
        classification, confidence, reason = (
            taxonomy.FLAKY, 0.8,
            "The test passed only after a retry, indicating nondeterministic behavior.",
        )
    elif provided in taxonomy.CLASSES:
        # The analysis platform already classified this deterministically; trust it
        # rather than re-deriving from the message.
        classification = provided
        confidence = signal.get("confidence", 0.8)
        reason = signal.get("reason") or f"Classified {provided} by the analysis platform."
    else:
        classification, confidence, reason = taxonomy.classify(message, http_status=http_status)

    return {
        "classification": classification,
        "confidence": confidence,
        "reason": reason,
        "ownership": OWNERSHIP.get(classification, "needs-triage"),
        "recommendation": RECOMMENDATION.get(classification, RECOMMENDATION[taxonomy.UNKNOWN]),
        "evidence": signal.get("evidence", []),
    }
