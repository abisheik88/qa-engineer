"""Deterministic repair planning.

Turns a root cause into a repair *plan* — never code. It decides whether the
failure is test-side repairable at all, and if so proposes an abstract change,
the candidate type, the risk, and a rollback. qa-fix consumes these plans; the
plan is always gated by the diff guard and always requires permission before any
edit is applied.
"""

from qa_analysis import taxonomy

# classification -> (repairable, candidate type, abstract change, risk).
# Only test-side causes are repairable; product, network, infra, auth, and
# environment failures are escalations, not repairs.
_PLANS = {
    taxonomy.LOCATOR: (True, "locator-update",
                       "Update the failing locator to target the same element in the current DOM.", "low"),
    taxonomy.ASSERTION: (True, "assertion-improvement",
                         "Correct the assertion to match the intended behavior, or confirm a product bug first.", "medium"),
    taxonomy.TIMEOUT: (True, "wait-strategy",
                       "Replace a fixed or missing wait with a web-first wait on the awaited condition.", "medium"),
    taxonomy.FLAKY: (True, "synchronization",
                     "Remove the race by awaiting the real condition; add a tracked quarantine only if needed.", "medium"),
    taxonomy.TEST_DATA: (True, "test-data",
                         "Repair or reseed the test data the scenario depends on.", "medium"),
    taxonomy.CONFIGURATION: (True, "configuration",
                             "Correct the test configuration the run depends on.", "low"),
    taxonomy.ENVIRONMENT: (False, "environment",
                           "Fix the environment (base URL, service availability); not a test-side repair.", "n/a"),
    taxonomy.AUTH: (True, "authentication",
                    "Repair the test's credentials or auth setup; do not weaken the check.", "medium"),
    taxonomy.AUTHORIZATION: (False, "authorization",
                             "Grant the test account permission or use an authorized role; not a code repair.", "n/a"),
    taxonomy.NETWORK: (False, "network",
                       "Investigate the upstream service; not a test-side repair.", "n/a"),
    taxonomy.INFRASTRUCTURE: (False, "infrastructure",
                              "Escalate to CI/infra; not a test-side repair.", "n/a"),
    taxonomy.APPLICATION_BUG: (False, "application-bug",
                               "File a product bug; the test correctly caught a real defect.", "n/a"),
    taxonomy.FRAMEWORK: (False, "framework",
                         "Update or pin the framework/driver; not a test-side repair.", "n/a"),
    taxonomy.UNKNOWN: (False, "unknown",
                       "Investigate further before any repair.", "n/a"),
}


def plan_repair(root_cause, affected_files=None):
    """Produce a repair plan for a root cause. Returns a dict:
    {repairable, candidateType, proposedChanges, affectedFiles, risk,
    permissionRequired, rollbackStrategy, safetyReview}. Never contains code.
    """
    classification = root_cause["classification"]
    repairable, candidate, change, risk = _PLANS.get(classification, _PLANS[taxonomy.UNKNOWN])

    if repairable:
        safety = ("Any edit will be checked by the diff guard before it is proposed as complete; "
                  "the guard rejects removed assertions, added skips, forced passes, and timeout inflation.")
        rollback = "No source is changed without approval; revert the proposed edits to roll back."
    else:
        safety = "No test-side edit is appropriate; this is an escalation, not a repair."
        rollback = "Not applicable — no change is proposed."

    return {
        "repairable": repairable,
        "candidateType": candidate,
        "proposedChanges": [change] if repairable else [],
        "affectedFiles": list(affected_files or []),
        "risk": risk,
        "permissionRequired": True,
        "rollbackStrategy": rollback,
        "safetyReview": safety,
    }
