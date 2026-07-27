"""Validate internal Analysis → Diagnostics seam payloads.

Uses the existing dependency-free qa_analysis.contracts validator against
schemas under shared/diagnostics/schemas/internal/.

The schemas must be reachable in **both** layouts this package runs in:

- the repository, where they live at `shared/diagnostics/schemas/internal/`; and
- a bundled skill, where the installer materializes the package into
  `<skill>/scripts/lib/qa_diagnostics/` and copies the schemas alongside it as
  package data (`qa_diagnostics/schemas/internal/`).

Resolution therefore tries package-local data first and falls back to the
canonical repository path. Missing schemas raise `InternalContractError` naming
the locations tried, rather than a bare FileNotFoundError from deep inside a
diagnosis.
"""

from __future__ import annotations

import json
from pathlib import Path

from qa_analysis import contracts

_HERE = Path(__file__).resolve().parent

# Ordered candidates: bundled package data first, then the repository layout.
_SCHEMA_DIRS = (
    _HERE / "schemas" / "internal",
    _HERE.parents[1] / "schemas" / "internal",
)


class InternalContractError(ValueError):
    """Raised when an internal seam payload fails its schema."""


def schema_dir() -> Path:
    """The directory holding the internal schemas, whichever layout applies."""
    for candidate in _SCHEMA_DIRS:
        if candidate.is_dir():
            return candidate
    tried = ", ".join(str(c) for c in _SCHEMA_DIRS)
    raise InternalContractError(
        f"internal schemas not found; tried: {tried}. "
        "A bundled skill must carry qa_diagnostics/schemas/internal/ as package data."
    )


def _load(name: str) -> dict:
    path = schema_dir() / name
    if not path.is_file():
        raise InternalContractError(f"internal schema missing: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def _require(payload: dict, schema_name: str) -> dict:
    schema = _load(schema_name)
    ok, errors = contracts.validate(payload, schema)
    if not ok:
        raise InternalContractError(f"{schema_name}: " + "; ".join(errors))
    return payload


def validate_analysis_result(payload: dict) -> dict:
    return _require(payload, "analysis-result.schema.json")


def validate_execution_result_min(payload: dict) -> dict:
    return _require(payload, "execution-result-min.schema.json")


def validate_diagnosis(payload: dict) -> dict:
    return _require(payload, "diagnosis.schema.json")
