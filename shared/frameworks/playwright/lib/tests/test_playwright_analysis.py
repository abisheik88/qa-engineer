"""Tests for the Playwright analysis adapter, including that it emits the
framework-agnostic normalized shape."""

import contextlib
import io
import json
import os
import pathlib
import tempfile
import unittest
import zipfile

import playwright_analysis as pw
from qa_analysis import taxonomy
from qa_analysis.junit import MalformedArtifact

FIXTURES = pathlib.Path(__file__).resolve().parent / "fixtures"


def _make_trace(path):
    events = [
        {"type": "action", "apiName": "page.goto"},
        {"type": "action", "apiName": "locator.click"},
        {"type": "console", "text": "a warning"},
        {"type": "resource", "url": "https://api.example.com/pay"},
        {"type": "error", "message": "Timeout 30000ms exceeded waiting for locator getByRole"},
    ]
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("test.trace", "\n".join(json.dumps(e) for e in events))


class ReportTests(unittest.TestCase):
    def test_report_normalizes_like_junit(self):
        result = pw.parse_report(str(FIXTURES / "playwright-report.json"))
        self.assertEqual(result["tests"], {"total": 2, "passed": 1, "failed": 1, "skipped": 0})
        # Same shape the agnostic JUnit parser produces.
        self.assertEqual(set(result.keys()), {"tests", "executed"})
        self.assertEqual(set(result["executed"][0].keys()) >= {"title", "file", "status", "durationMs"}, True)

    def test_report_redacts_error_messages(self):
        # A report whose error carries a secret must not leak it.
        err = {"message": "failed with Authorization: Bearer eyJa.bbb.ccc"}
        result = {"status": "failed", "duration": 1, "errors": [err]}
        spec = {"title": "t", "tests": [{"results": [result]}]}
        report = {"suites": [{"file": "x.spec.ts", "specs": [spec]}]}
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
            json.dump(report, handle)
            path = handle.name
        try:
            out = pw.parse_report(path)
            self.assertNotIn("eyJa.bbb.ccc", json.dumps(out))
        finally:
            os.unlink(path)


class CliTests(unittest.TestCase):
    """The adapter's own CLI — the documented way a skill reaches it, so the
    normalization step is never done by hand."""

    def _capture(self, argv):
        buffer = io.StringIO()
        with contextlib.redirect_stdout(buffer):
            code = pw.main(argv)
        return code, buffer.getvalue()

    def test_report_subcommand_emits_normalized_json(self):
        code, out = self._capture(["report", str(FIXTURES / "playwright-report.json")])
        self.assertEqual(code, 0)
        payload = json.loads(out)
        self.assertEqual(payload["tests"], {"total": 2, "passed": 1, "failed": 1, "skipped": 0})

    def test_trace_subcommand_emits_summary_json(self):
        with tempfile.TemporaryDirectory() as root:
            trace = os.path.join(root, "trace.zip")
            _make_trace(trace)
            code, out = self._capture(["trace", trace])
        self.assertEqual(code, 0)
        payload = json.loads(out)
        self.assertEqual(payload["classification"], taxonomy.LOCATOR)

    def test_malformed_artifact_exits_two_with_an_error_body(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
            handle.write("{not json")
            path = handle.name
        try:
            code, out = self._capture(["report", path])
        finally:
            os.unlink(path)
        self.assertEqual(code, 2)
        self.assertEqual(json.loads(out)["error"], "malformed-artifact")


class TraceTests(unittest.TestCase):
    def test_trace_summary_and_classification(self):
        with tempfile.TemporaryDirectory() as root:
            trace = os.path.join(root, "trace.zip")
            _make_trace(trace)
            result = pw.analyze_trace(trace)
            self.assertIn("page.goto", result["actions"])
            self.assertEqual(result["consoleEvents"], 1)
            self.assertEqual(result["networkEvents"], 1)
            self.assertEqual(result["classification"], taxonomy.LOCATOR)

    def test_non_zip_raises(self):
        with tempfile.NamedTemporaryFile("w", suffix=".zip", delete=False) as handle:
            handle.write("not a zip")
            path = handle.name
        try:
            with self.assertRaises(MalformedArtifact):
                pw.analyze_trace(path)
        finally:
            os.unlink(path)


if __name__ == "__main__":
    unittest.main()
