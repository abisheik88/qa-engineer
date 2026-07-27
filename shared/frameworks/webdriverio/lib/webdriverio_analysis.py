"""WebdriverIO analysis adapter.

WebdriverIO emits JUnit XML (via @wdio/junit-reporter), so its normalization is
the framework-agnostic JUnit parser — the adapter points at the artifact and
tags provenance. Thin by design: the fourth framework confirms the boundary.
"""

from qa_analysis import junit, taxonomy

FRAMEWORK = "webdriverio"

# Where WebdriverIO projects conventionally write JUnit results.
RESULT_GLOBS = ["**/junit*.xml", "**/results/*.xml", "**/test-results/*.xml"]


def normalize(junit_path):
    """Normalize a WebdriverIO run into the shared result shape via the agnostic
    JUnit parser. Identical output shape to any other framework."""
    return junit.parse_junit(junit_path)


def classify_failure(message, http_status=None):
    """Classify a WebdriverIO failure using the shared taxonomy."""
    return taxonomy.classify(message, http_status=http_status)
