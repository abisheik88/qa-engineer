"""qa_analysis — the pack's deterministic analysis core.

Framework-agnostic tooling shared by every diagnostic skill: redaction,
the evidence and finding model, the failure taxonomy, artifact discovery,
format parsers (JUnit, HAR), contract validation, and the diff guard.

Standard library only. Knows nothing about any test framework; framework
specifics live in shared/frameworks/<name>/lib and depend on this package.
"""

__version__ = "0.1.0"
