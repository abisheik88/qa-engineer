"""The evidence and finding model shared by every analyzer.

Every finding an analyzer produces carries the same structure, so downstream
skills (qa-debug, qa-report, qa-fix) consume one shape regardless of which
analyzer or framework produced it. Text fields are redacted at construction.
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone

from .redaction import redact_text

EVIDENCE_TYPES = {
    "trace", "har", "junit", "report", "console", "network", "stdout",
    "stderr", "screenshot", "video", "log", "file", "diff",
}


def utc_now():
    """ISO 8601 UTC timestamp. Isolated so tests can monkeypatch it."""
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Evidence:
    """One observation supporting a finding. Excerpts are redacted."""
    type: str
    description: str
    source: str
    excerpt: str = ""

    def __post_init__(self):
        if self.type not in EVIDENCE_TYPES:
            raise ValueError(f"unknown evidence type: {self.type}")
        self.excerpt = redact_text(self.excerpt)

    def to_dict(self):
        data = {"type": self.type, "description": self.description, "source": self.source}
        if self.excerpt:
            data["excerpt"] = self.excerpt
        return data


@dataclass
class Finding:
    """A single diagnostic conclusion, traceable to a specific artifact.

    Carries everything the evidence model requires: the artifact and location
    it came from, when, why, the supporting evidence, a calibrated confidence,
    the affected tests, related artifacts, and recommended actions.
    """
    classification: str
    reason: str
    artifact: str
    location: str
    confidence: float = None
    timestamp: str = field(default_factory=utc_now)
    evidence: list = field(default_factory=list)
    affected_tests: list = field(default_factory=list)
    related_artifacts: list = field(default_factory=list)
    recommendations: list = field(default_factory=list)

    def to_dict(self):
        data = {
            "classification": self.classification,
            "reason": self.reason,
            "artifact": self.artifact,
            "location": self.location,
            "timestamp": self.timestamp,
            "evidence": [e.to_dict() if isinstance(e, Evidence) else e for e in self.evidence],
            "affectedTests": self.affected_tests,
            "relatedArtifacts": self.related_artifacts,
            "recommendations": self.recommendations,
        }
        if self.confidence is not None:
            data["confidence"] = self.confidence
        return data


@dataclass
class AnalyzerOutput:
    """The envelope an analyzer emits: findings plus the artifacts it examined.

    A downstream skill wraps this in its own output contract; on its own it is
    the deterministic, machine-readable result of one analysis.
    """
    analyzer: str
    findings: list = field(default_factory=list)
    artifacts: list = field(default_factory=list)
    warnings: list = field(default_factory=list)
    generated_at: str = field(default_factory=utc_now)

    def to_dict(self):
        return {
            "analyzer": self.analyzer,
            "generatedAt": self.generated_at,
            "findings": [f.to_dict() if isinstance(f, Finding) else f for f in self.findings],
            "artifacts": [a.to_dict() if hasattr(a, "to_dict") else a for a in self.artifacts],
            "warnings": self.warnings,
        }


@dataclass
class Artifact:
    """A discovered artifact, in the common model shared with the execution engine."""
    type: str
    location: str
    framework: str = "unknown"
    ownership: str = "qa-analysis"
    timestamp: str = field(default_factory=utc_now)
    media_type: str = ""
    test_ref: str = ""
    present: bool = True

    def to_dict(self):
        data = {
            "type": self.type,
            "location": self.location,
            "framework": self.framework,
            "timestamp": self.timestamp,
            "ownership": self.ownership,
            "present": self.present,
        }
        if self.media_type:
            data["mediaType"] = self.media_type
        if self.test_ref:
            data["testRef"] = self.test_ref
        return data
