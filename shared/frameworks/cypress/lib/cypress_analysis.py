"""Cypress analysis adapter.

Cypress emits JUnit XML (via a JUnit reporter), so Cypress normalization is the
framework-agnostic JUnit parser — the adapter only points at the artifact and
tags provenance. Like the Selenium adapter, its thinness is the proof of the
multi-framework boundary: the contract and parsing are shared; only the artifact
location differs.
"""

from qa_analysis import junit, taxonomy

FRAMEWORK = "cypress"

# Where Cypress projects conventionally write JUnit results (see cypress-artifacts.md).
RESULT_GLOBS = ["**/results/*.xml", "**/cypress/results/*.xml", "**/junit*.xml"]


def normalize(junit_path):
    """Normalize a Cypress run into the shared result shape via the agnostic
    JUnit parser. Identical output shape to any other framework."""
    return junit.parse_junit(junit_path)


def classify_failure(message, http_status=None):
    """Classify a Cypress failure using the shared taxonomy — no Cypress-specific
    classifier, because failure classes are framework-agnostic."""
    return taxonomy.classify(message, http_status=http_status)
