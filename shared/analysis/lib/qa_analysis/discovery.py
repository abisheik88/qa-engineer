"""Deterministic artifact discovery.

Locates the artifacts a run produced — automatically by convention or from
explicit paths — and classifies each as present, partial, or corrupted. It
handles multiple runs, parallel workers, and sharded output (many result files),
and it reports what is missing rather than inventing it.
"""

import json
import os
import zipfile
from glob import glob

from .evidence import Artifact

# Convention globs for known artifact types, relative to a run root.
_PATTERNS = [
    ("junit", ["**/results.xml", "**/junit*.xml", "**/*junit*.xml"]),
    ("report", ["**/results.json", "**/report.json"]),
    ("html-report", ["**/playwright-report/index.html", "**/*-report/index.html"]),
    ("trace", ["**/trace.zip", "**/*-trace.zip"]),
    ("har", ["**/*.har"]),
    ("video", ["**/*.webm", "**/*.mp4"]),
    ("screenshot", ["**/*.png", "**/*-actual.png"]),
]


def _integrity(artifact_type, path):
    """Classify an artifact as present, partial (empty), or corrupted."""
    try:
        size = os.path.getsize(path)
    except OSError:
        return "missing"
    if size == 0:
        return "partial"
    # Structural spot-checks for formats we can cheaply verify.
    if artifact_type == "trace":
        if not zipfile.is_zipfile(path):
            return "corrupted"
    elif artifact_type in ("report", "har"):
        try:
            with open(path, "r", encoding="utf-8") as handle:
                json.load(handle)
        except (json.JSONDecodeError, OSError, UnicodeDecodeError):
            return "corrupted"
    return "present"


def discover(root=".", explicit=None, framework="unknown"):
    """Discover artifacts under root, or validate explicit paths.

    Returns {present: [Artifact...], partial: [...], corrupted: [...],
    missing: [paths]}. Explicit paths that do not exist are reported as missing;
    convention discovery never reports missing (absence is simply not found).
    """
    present, partial, corrupted, missing = [], [], [], []

    def record(artifact_type, path):
        state = _integrity(artifact_type, path)
        artifact = Artifact(type=artifact_type, location=os.path.relpath(path, root)
                            if os.path.isabs(path) else path, framework=framework,
                            present=(state == "present"))
        if state == "present":
            present.append(artifact)
        elif state == "partial":
            partial.append(artifact)
        elif state == "corrupted":
            corrupted.append(artifact)
        else:
            missing.append(path)

    if explicit:
        for path in explicit:
            if not os.path.exists(path):
                missing.append(path)
                continue
            matched = next((t for t, _ in _PATTERNS if _matches_type(t, path)), "attachment")
            record(matched, path)
    else:
        seen = set()
        for artifact_type, patterns in _PATTERNS:
            for pattern in patterns:
                for path in sorted(glob(os.path.join(root, pattern), recursive=True)):
                    if path in seen:
                        continue
                    seen.add(path)
                    record(artifact_type, path)

    return {
        "present": present,
        "partial": partial,
        "corrupted": corrupted,
        "missing": missing,
    }


def _matches_type(artifact_type, path):
    lower = path.lower()
    if artifact_type == "junit":
        return lower.endswith(".xml")
    if artifact_type == "report":
        return lower.endswith(".json")
    if artifact_type == "trace":
        return lower.endswith(".zip")
    if artifact_type == "har":
        return lower.endswith(".har")
    if artifact_type == "video":
        return lower.endswith((".webm", ".mp4"))
    if artifact_type == "screenshot":
        return lower.endswith(".png")
    if artifact_type == "html-report":
        return lower.endswith(".html")
    return False
