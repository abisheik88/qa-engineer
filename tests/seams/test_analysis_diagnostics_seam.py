"""Seam regression tests: Analysis → Diagnostics internal contracts."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

# Ensure both packages import when running from repo root.
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "shared" / "analysis" / "lib"))
sys.path.insert(0, str(ROOT / "shared" / "diagnostics" / "lib"))

from qa_analysis import taxonomy  # noqa: E402
from qa_diagnostics import engine, internal_contracts  # noqa: E402


class AnalysisToDiagnosticsSeamTests(unittest.TestCase):
    def test_diagnose_output_matches_internal_schema(self):
        execution = {
            "tests": {"passed": 0, "failed": 1, "flaky": 0, "skipped": 0},
            "executed": [
                {
                    "title": "login",
                    "status": "failed",
                    "message": "no such element",
                    "file": "login.spec.ts",
                }
            ],
        }
        analysis = {
            "findings": [
                {
                    "classification": taxonomy.LOCATOR,
                    "reason": "element not found",
                    "confidence": 0.9,
                    "affectedTests": ["login"],
                    "evidence": [{"type": "trace", "description": "step", "source": "trace.zip"}],
                }
            ]
        }
        internal_contracts.validate_analysis_result(analysis)
        internal_contracts.validate_execution_result_min(execution)
        diagnosis = engine.diagnose(execution, analysis)
        internal_contracts.validate_diagnosis(diagnosis)
        self.assertEqual(diagnosis["entries"][0]["rootCause"]["classification"], taxonomy.LOCATOR)

    def test_invalid_analysis_result_rejected(self):
        with self.assertRaises(internal_contracts.InternalContractError):
            internal_contracts.validate_analysis_result({"findings": [{"reason": "missing class"}]})

    def test_invalid_diagnosis_rejected(self):
        with self.assertRaises(internal_contracts.InternalContractError):
            internal_contracts.validate_diagnosis({"entries": [], "timeline": []})


class ExecutionToEvaluationSeamTests(unittest.TestCase):
    """Execution → Evaluation: minimal execution_result shape evals depend on."""

    def test_execution_min_accepts_normalized_shape(self):
        payload = {
            "tests": {"passed": 1, "failed": 0},
            "executed": [{"title": "ok", "status": "passed"}],
        }
        internal_contracts.validate_execution_result_min(payload)

    def test_execution_min_rejects_bad_status(self):
        with self.assertRaises(internal_contracts.InternalContractError):
            internal_contracts.validate_execution_result_min(
                {"executed": [{"status": "banana"}]}
            )


if __name__ == "__main__":
    unittest.main()
