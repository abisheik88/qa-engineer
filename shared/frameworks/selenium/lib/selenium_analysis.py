"""Selenium analysis adapter.

Selenium's runners (JUnit, TestNG, pytest) emit JUnit XML, so Selenium
normalization *is* the framework-agnostic JUnit parser — the adapter only points
at the right artifact and tags provenance. This is the proof of the pack's
multi-framework claim: the second framework's analysis is a few lines, because
the contract and the parsing are shared, and only the artifact location differs.
"""

from qa_analysis import junit, taxonomy

FRAMEWORK = "selenium"

# Where Selenium projects conventionally write results (documented in
# selenium-artifacts.md); discovery uses these, the parser is shared.
RESULT_GLOBS = ["**/target/surefire-reports/*.xml", "**/test-results/*.xml", "**/junit*.xml"]


def normalize(junit_path):
    """Normalize a Selenium run into the shared result shape via the agnostic
    JUnit parser. Identical output shape to any other framework's normalization."""
    return junit.parse_junit(junit_path)


def classify_failure(message, http_status=None):
    """Classify a Selenium failure using the shared taxonomy — no Selenium-specific
    classifier, because failure classes are framework-agnostic."""
    return taxonomy.classify(message, http_status=http_status)
