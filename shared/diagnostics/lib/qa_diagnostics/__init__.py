"""qa_diagnostics — the pack's shared diagnostic engine.

One place where failure reasoning lives: root-cause analysis, timeline
reconstruction, finding prioritization, and repair planning. The three
diagnostic skills (qa-debug, qa-fix, qa-report) consume this engine and differ
only in presentation — the reasoning is not duplicated across them.

Standard library only. Builds on qa_analysis (taxonomy, evidence, diff guard);
adds no framework-specific logic. Deterministic: the same inputs yield the same
diagnosis every time.
"""

__version__ = "0.1.0"
