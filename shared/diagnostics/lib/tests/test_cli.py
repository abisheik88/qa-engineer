"""Tests for the diagnostic engine's CLI — the documented entry point.

The CLI is how a skill reaches the engine, so its contract matters as much as the
engine's reasoning: JSON on stdout, exit 0 on success, exit 2 with an `error`
body on bad input, and no invented output when a payload is malformed. Before
this existed, six skills told an agent to "run the bundled qa_diagnostics
package" with no command, no input shape, and no exit-code contract.
"""

import contextlib
import io
import json
import os
import pathlib
import tempfile
import unittest

from qa_diagnostics import cli, internal_contracts

EXECUTION = {
    "tests": {"total": 2, "passed": 1, "failed": 1, "skipped": 0},
    "executed": [
        {"title": "checkout", "status": "failed",
         "message": "locator not found: #cart-button",
         "file": "tests/checkout.spec.ts", "retries": 0},
        {"title": "login", "status": "passed", "file": "tests/login.spec.ts"},
    ],
}

ANALYSIS = {
    "findings": [
        {"classification": "application-bug", "reason": "POST /api/payment returned 500",
         "confidence": 0.9, "httpStatus": 500, "affectedTests": ["checkout"]},
    ],
}


class CliTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self._tmp.name)
        self.execution_path = self._write("execution-result.json", EXECUTION)
        self.analysis_path = self._write("analysis-result.json", ANALYSIS)

    def tearDown(self):
        self._tmp.cleanup()

    def _write(self, name, payload):
        path = self.root / name
        path.write_text(json.dumps(payload), encoding="utf-8")
        return str(path)

    def _run(self, argv):
        buffer = io.StringIO()
        with contextlib.redirect_stdout(buffer):
            code = cli.main(argv)
        return code, buffer.getvalue()

    def test_diagnose_emits_a_validated_diagnosis(self):
        code, out = self._run(["diagnose", "--execution-result", self.execution_path])
        self.assertEqual(code, 0)
        diagnosis = json.loads(out)
        self.assertEqual(set(diagnosis), {"entries", "timeline", "recommendations"})
        self.assertEqual(diagnosis["entries"][0]["rootCause"]["classification"], "locator-failure")
        # The emitted payload satisfies the internal contract.
        internal_contracts.validate_diagnosis(diagnosis)

    def test_diagnose_prefers_analysis_findings_over_executed_tests(self):
        code, out = self._run([
            "diagnose",
            "--execution-result", self.execution_path,
            "--analysis-result", self.analysis_path,
        ])
        self.assertEqual(code, 0)
        diagnosis = json.loads(out)
        self.assertEqual(diagnosis["entries"][0]["rootCause"]["classification"], "application-bug")

    def test_plan_repairs_reads_a_diagnosis(self):
        _, diagnosis_out = self._run(["diagnose", "--execution-result", self.execution_path])
        diagnosis_path = self._write("diagnosis.json", json.loads(diagnosis_out))
        code, out = self._run(["plan-repairs", "--diagnosis", diagnosis_path])
        self.assertEqual(code, 0)
        plans = json.loads(out)["plans"]
        self.assertTrue(plans)
        self.assertIn("priority", plans[0])

    def test_summarize_produces_a_readiness_verdict(self):
        _, diagnosis_out = self._run(["diagnose", "--execution-result", self.execution_path])
        diagnosis_path = self._write("diagnosis.json", json.loads(diagnosis_out))
        code, out = self._run([
            "summarize", "--execution-result", self.execution_path, "--diagnosis", diagnosis_path,
        ])
        self.assertEqual(code, 0)
        summary = json.loads(out)
        self.assertEqual(set(summary), {"totals", "byClassification", "topPriority", "releaseReadiness"})
        self.assertEqual(summary["releaseReadiness"], "ready-with-risks")

    def test_report_runs_the_whole_pipeline_in_one_call(self):
        code, out = self._run(["report", "--execution-result", self.execution_path])
        self.assertEqual(code, 0)
        payload = json.loads(out)
        self.assertEqual(set(payload), {"diagnosis", "plans", "summary"})
        self.assertTrue(payload["diagnosis"]["entries"])
        self.assertTrue(payload["plans"])

    def test_release_blocking_classification_is_not_ready(self):
        code, out = self._run([
            "report",
            "--execution-result", self.execution_path,
            "--analysis-result", self.analysis_path,
        ])
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)["summary"]["releaseReadiness"], "not-ready")

    def test_missing_file_exits_two_with_an_error_body(self):
        code, out = self._run(["diagnose", "--execution-result", str(self.root / "nope.json")])
        self.assertEqual(code, 2)
        self.assertEqual(json.loads(out)["error"], "io-error")

    def test_malformed_json_exits_two(self):
        path = self.root / "bad.json"
        path.write_text("{not json", encoding="utf-8")
        code, out = self._run(["diagnose", "--execution-result", str(path)])
        self.assertEqual(code, 2)
        self.assertEqual(json.loads(out)["error"], "io-error")

    def test_payload_failing_its_seam_contract_exits_two(self):
        bad = self._write("bad-analysis.json", {"findings": [{"classification": 500}]})
        code, out = self._run([
            "diagnose", "--execution-result", self.execution_path, "--analysis-result", bad,
        ])
        self.assertEqual(code, 2)
        body = json.loads(out)
        self.assertEqual(body["error"], "invalid-payload")
        self.assertIn("analysis-result.schema.json", body["detail"])


class BundledLayoutTests(unittest.TestCase):
    """The engine must find its internal schemas in both layouts it runs in:
    the repository, and a bundled skill where they travel as package data."""

    def test_schema_dir_resolves_in_the_repository_layout(self):
        self.assertTrue(internal_contracts.schema_dir().is_dir())
        self.assertTrue((internal_contracts.schema_dir() / "diagnosis.schema.json").is_file())

    def test_package_local_schemas_take_precedence(self):
        # Simulates the bundled layout: schemas sit inside the package.
        package_local = pathlib.Path(internal_contracts.__file__).resolve().parent / "schemas"
        self.assertFalse(
            package_local.exists(),
            "the repository copy must not carry package-local schemas; "
            "the bundlers add them, and the fallback covers this layout",
        )
        # The resolution order is what makes the bundled layout work.
        self.assertEqual(
            internal_contracts._SCHEMA_DIRS[0],
            package_local / "internal",
        )


if __name__ == "__main__":
    unittest.main()
