"""Deterministic finding prioritization.

Assigns every finding a severity, priority, the three impacts, an owner, and an
estimated effort — by a fixed algorithm, so the same finding always ranks the
same way. Priority is not a feeling; it is a function of severity, confidence,
and business impact.
"""

from qa_analysis import taxonomy

# Base severity per classification (before confidence adjustment).
_SEVERITY = {
    taxonomy.APPLICATION_BUG: "high",
    taxonomy.INFRASTRUCTURE: "high",
    taxonomy.NETWORK: "high",
    taxonomy.AUTH: "high",
    taxonomy.AUTHORIZATION: "high",
    taxonomy.ASSERTION: "medium",
    taxonomy.LOCATOR: "medium",
    taxonomy.TIMEOUT: "medium",
    taxonomy.TEST_DATA: "medium",
    taxonomy.CONFIGURATION: "medium",
    taxonomy.ENVIRONMENT: "medium",
    taxonomy.FRAMEWORK: "medium",
    taxonomy.FLAKY: "medium",
    taxonomy.UNKNOWN: "low",
}

# Where the impact predominantly lands, per classification.
_IMPACT = {
    taxonomy.APPLICATION_BUG: {"business": "high", "technical": "high", "testing": "low"},
    taxonomy.NETWORK: {"business": "high", "technical": "high", "testing": "medium"},
    taxonomy.AUTH: {"business": "high", "technical": "medium", "testing": "medium"},
    taxonomy.AUTHORIZATION: {"business": "high", "technical": "medium", "testing": "medium"},
    taxonomy.INFRASTRUCTURE: {"business": "medium", "technical": "high", "testing": "high"},
    taxonomy.LOCATOR: {"business": "low", "technical": "low", "testing": "high"},
    taxonomy.ASSERTION: {"business": "medium", "technical": "medium", "testing": "medium"},
    taxonomy.TIMEOUT: {"business": "low", "technical": "medium", "testing": "high"},
    taxonomy.TEST_DATA: {"business": "low", "technical": "low", "testing": "high"},
    taxonomy.CONFIGURATION: {"business": "low", "technical": "medium", "testing": "high"},
    taxonomy.ENVIRONMENT: {"business": "low", "technical": "medium", "testing": "high"},
    taxonomy.FRAMEWORK: {"business": "low", "technical": "medium", "testing": "high"},
    taxonomy.FLAKY: {"business": "low", "technical": "low", "testing": "high"},
    taxonomy.UNKNOWN: {"business": "low", "technical": "low", "testing": "medium"},
}

# Rough effort to resolve, per classification.
_EFFORT = {
    taxonomy.LOCATOR: "low",
    taxonomy.ASSERTION: "low",
    taxonomy.CONFIGURATION: "low",
    taxonomy.ENVIRONMENT: "low",
    taxonomy.TEST_DATA: "medium",
    taxonomy.TIMEOUT: "medium",
    taxonomy.FLAKY: "medium",
    taxonomy.AUTH: "medium",
    taxonomy.AUTHORIZATION: "medium",
    taxonomy.FRAMEWORK: "medium",
    taxonomy.NETWORK: "high",
    taxonomy.INFRASTRUCTURE: "high",
    taxonomy.APPLICATION_BUG: "external",
    taxonomy.UNKNOWN: "unknown",
}

_RANK = {"low": 1, "medium": 2, "high": 3}
_PRIORITY = {1: "P3", 2: "P2", 3: "P1", 4: "P1"}


def prioritize(root_cause, blocking=False):
    """Prioritize a root cause. Returns a dict with severity, priority, the three
    impacts, confidence, owner, and estimatedEffort.

    priority derives from severity, business impact, and confidence, and is
    escalated one step when the failure blocks a release (blocking=True).
    """
    classification = root_cause["classification"]
    confidence = root_cause.get("confidence", 0.5)
    severity = _SEVERITY.get(classification, "low")
    impact = _IMPACT.get(classification, _IMPACT[taxonomy.UNKNOWN])

    # Priority score: severity and business impact drive it; low confidence
    # holds it back (an uncertain finding should not top the queue).
    score = _RANK[severity]
    if impact["business"] == "high":
        score += 1
    if confidence < 0.5:
        score -= 1
    if blocking:
        score += 1
    score = max(1, min(4, score))

    return {
        "severity": severity,
        "priority": _PRIORITY[score],
        "businessImpact": impact["business"],
        "technicalImpact": impact["technical"],
        "testingImpact": impact["testing"],
        "confidence": confidence,
        "owner": root_cause.get("ownership", "needs-triage"),
        "estimatedEffort": _EFFORT.get(classification, "unknown"),
    }
