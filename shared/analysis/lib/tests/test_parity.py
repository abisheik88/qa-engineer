"""Validator parity (Python side) and the runtime invariant contracts.

The pack ships two validators — Python for contracts, JavaScript for installer
config — and documents that "a document that passes one passes the other". This
test holds up the Python half of that promise against the shared corpus in
tests/parity/validator-cases.json; packages/installer/test/parity.test.mjs holds
up the JavaScript half against the same file.

It also asserts the cross-field invariants now carried by the shipped contracts,
so the rule that rejects a hallucinated-green result lives in the product, not
only in an evaluation fixture.
"""

import json
import pathlib
import unittest

from qa_analysis import contracts

REPO = pathlib.Path(__file__).resolve().parents[4]
PARITY_CASES = REPO / "tests/parity/validator-cases.json"
CONTRACT_DIR = REPO / "skills"


def _load_cases():
    with open(PARITY_CASES, "r", encoding="utf-8") as handle:
        return json.load(handle)["cases"]


def _contract(skill, name):
    return contracts.load_schema(CONTRACT_DIR / skill / "contracts" / name)


def _base_execution_result(**overrides):
    """A minimal, contract-valid qa-run result; overrides are merged shallowly."""
    result = {
        "contract": {"name": "qa-run/execution-result", "version": "1.0.0"},
        "skill": {"name": "qa-run", "version": "0.2.0"},
        "generatedAt": "2026-07-24T10:05:03Z",
        "summary": "2 passed, 0 failed.",
        "classification": "passed",
        "evidence": [{"type": "command", "description": "Runner exited zero", "source": "exit code 0"}],
        "execution": {"strategy": "smoke", "command": "npx playwright test", "exitCode": 0},
        "framework": {"name": "playwright"},
        "tests": {"total": 2, "passed": 2, "failed": 0, "skipped": 0},
        "artifacts": [],
        "environment": {"location": "local", "headless": True},
    }
    result.update(overrides)
    return result


class ParityCorpusTests(unittest.TestCase):
    def test_every_parity_case_matches_its_expected_verdict(self):
        cases = _load_cases()
        self.assertGreater(len(cases), 20, "parity corpus should be meaningful")
        for case in cases:
            with self.subTest(case=case["name"]):
                ok, errors = contracts.validate(case["instance"], case["schema"])
                self.assertEqual(
                    ok, case["valid"],
                    f"{case['name']}: expected valid={case['valid']}, errors={errors}",
                )

    def test_unsupported_keyword_is_reported_not_ignored(self):
        ok, errors = contracts.validate({}, {"type": "object", "anyOf": [{"type": "object"}]})
        self.assertFalse(ok)
        self.assertTrue(any("unsupported keyword" in e for e in errors), errors)

    def test_supported_keywords_are_declared(self):
        for keyword in ("allOf", "if", "then", "else", "maxItems", "maxLength", "format"):
            self.assertIn(keyword, contracts.SUPPORTED_KEYWORDS)


class ExecutionResultInvariantTests(unittest.TestCase):
    """qa-run: a green claim must be backed by the runner's own numbers."""

    def setUp(self):
        self.schema = _contract("qa-run", "execution-result.schema.json")

    def test_honest_pass_is_valid(self):
        ok, errors = contracts.validate(_base_execution_result(), self.schema)
        self.assertTrue(ok, errors)

    def test_passed_with_nonzero_exit_code_is_rejected(self):
        bad = _base_execution_result()
        bad["execution"]["exitCode"] = 1
        ok, errors = contracts.validate(bad, self.schema)
        self.assertFalse(ok, "passed + exitCode 1 must not validate")
        self.assertTrue(any("exitCode" in e for e in errors), errors)

    def test_passed_with_failed_tests_is_rejected(self):
        bad = _base_execution_result()
        bad["tests"] = {"total": 12, "passed": 11, "failed": 1, "skipped": 0}
        ok, _ = contracts.validate(bad, self.schema)
        self.assertFalse(ok, "passed + failed>0 must not validate")

    def test_failed_without_a_failing_test_is_rejected(self):
        bad = _base_execution_result(classification="failed")
        bad["execution"]["exitCode"] = 1
        ok, _ = contracts.validate(bad, self.schema)
        self.assertFalse(ok, "failed + tests.failed 0 must not validate")

    def test_honest_failure_is_valid(self):
        good = _base_execution_result(classification="failed")
        good["execution"]["exitCode"] = 1
        good["tests"] = {"total": 12, "passed": 11, "failed": 1, "skipped": 0}
        ok, errors = contracts.validate(good, self.schema)
        self.assertTrue(ok, errors)

    def test_no_tests_run_with_executed_tests_is_rejected(self):
        bad = _base_execution_result(classification="no-tests-run")
        ok, _ = contracts.validate(bad, self.schema)
        self.assertFalse(ok, "no-tests-run + total>0 must not validate")

    def test_blocked_run_may_have_a_null_exit_code(self):
        good = _base_execution_result(classification="blocked")
        good["execution"]["exitCode"] = None
        good["tests"] = {"total": 0, "passed": 0, "failed": 0, "skipped": 0}
        ok, errors = contracts.validate(good, self.schema)
        self.assertTrue(ok, errors)


class ReportResultInvariantTests(unittest.TestCase):
    """qa-report: "ready" may not be claimed over failing tests."""

    def setUp(self):
        self.schema = _contract("qa-report", "report-result.schema.json")

    def _base(self, **overrides):
        result = {
            "contract": {"name": "qa-report/report-result", "version": "1.0.0"},
            "skill": {"name": "qa-report", "version": "0.1.0"},
            "generatedAt": "2026-07-24T10:05:03Z",
            "summary": "All green.",
            "classification": "ready",
            "evidence": [{"type": "execution-result", "description": "run", "source": "qa-artifacts/run.json"}],
            "summaries": {"executive": "Green.", "engineering": "Green."},
            "testSummary": {"total": 10, "passed": 10, "failed": 0, "skipped": 0},
            "releaseReadiness": {"verdict": "ready", "rationale": "No failures."},
            "formats": {"markdown": True, "htmlReady": False, "json": True},
        }
        result.update(overrides)
        return result

    def test_ready_with_zero_failures_is_valid(self):
        ok, errors = contracts.validate(self._base(), self.schema)
        self.assertTrue(ok, errors)

    def test_ready_with_failing_tests_is_rejected(self):
        bad = self._base()
        bad["testSummary"] = {"total": 10, "passed": 9, "failed": 1, "skipped": 0}
        ok, _ = contracts.validate(bad, self.schema)
        self.assertFalse(ok, "ready + failed>0 must not validate")

    def test_verdict_must_agree_with_the_envelope_classification(self):
        bad = self._base()
        bad["releaseReadiness"]["verdict"] = "not-ready"
        ok, _ = contracts.validate(bad, self.schema)
        self.assertFalse(ok, "classification 'ready' with verdict 'not-ready' must not validate")


class FixResultInvariantTests(unittest.TestCase):
    """qa-fix: a plan the diff guard rejected cannot be reported repairable."""

    def setUp(self):
        self.schema = _contract("qa-fix", "fix-result.schema.json")

    def _base(self, **overrides):
        result = {
            "contract": {"name": "qa-fix/fix-result", "version": "1.0.0"},
            "skill": {"name": "qa-fix", "version": "0.1.0"},
            "generatedAt": "2026-07-24T10:05:03Z",
            "summary": "Locator update proposed.",
            "classification": "repairable",
            "evidence": [{"type": "debug-result", "description": "diagnosis", "source": "qa-artifacts/debug.json"}],
            "repairPlan": {
                "candidateType": "locator-update",
                "proposedChanges": ["Update the cart-button locator to the renamed element."],
                "affectedFiles": ["tests/cart.spec.ts"],
                "risk": "low",
            },
            "permissionRequired": True,
            "rollbackStrategy": "git checkout the file.",
            "diffGuardReview": {"status": "not-run", "note": "No diff drafted."},
        }
        result.update(overrides)
        return result

    def test_plan_only_review_is_valid(self):
        ok, errors = contracts.validate(self._base(), self.schema)
        self.assertTrue(ok, errors)

    def test_failed_diff_guard_cannot_be_repairable(self):
        bad = self._base()
        bad["diffGuardReview"] = {"status": "fail", "note": "removed-assertion"}
        ok, _ = contracts.validate(bad, self.schema)
        self.assertFalse(ok, "diff-guard fail + repairable must not validate")

    def test_failed_diff_guard_with_escalation_is_valid(self):
        good = self._base(classification="needs-investigation")
        good["diffGuardReview"] = {"status": "fail", "note": "removed-assertion"}
        ok, errors = contracts.validate(good, self.schema)
        self.assertTrue(ok, errors)


class ShippedContractsUseOnlyTheSupportedSubsetTests(unittest.TestCase):
    def test_every_contract_and_schema_parses_and_stays_in_subset(self):
        roots = [
            REPO / "skills",
            REPO / "shared/analysis/schemas",
            REPO / "shared/diagnostics/schemas",
            REPO / "packages/installer/schemas",
        ]
        checked = 0
        for root in roots:
            for path in sorted(root.rglob("*.json")):
                if "schema" not in path.name:
                    continue
                with open(path, "r", encoding="utf-8") as handle:
                    schema = json.load(handle)
                unknown = sorted(self._keywords(schema) - set(contracts.SUPPORTED_KEYWORDS))
                self.assertEqual(unknown, [], f"{path} uses unsupported keyword(s) {unknown}")
                checked += 1
        self.assertGreater(checked, 10, "expected to check every shipped schema")

    def _keywords(self, node):
        """Every schema keyword used anywhere in the document."""
        found = set()
        if not isinstance(node, dict):
            return found
        for key, value in node.items():
            found.add(key)
            if key == "properties" and isinstance(value, dict):
                for sub in value.values():
                    found |= self._keywords(sub)
            elif key in ("items", "if", "then", "else"):
                found |= self._keywords(value)
            elif key == "allOf" and isinstance(value, list):
                for sub in value:
                    found |= self._keywords(sub)
        return found


if __name__ == "__main__":
    unittest.main()
