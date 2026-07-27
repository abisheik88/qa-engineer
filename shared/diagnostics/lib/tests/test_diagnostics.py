"""Unit tests for the diagnostic engine."""

import unittest

from qa_analysis import taxonomy
from qa_diagnostics import root_cause, prioritization, repair, timeline, engine


class RootCauseTests(unittest.TestCase):
    def test_classifies_from_message_with_ownership_and_recommendation(self):
        rc = root_cause.analyze({"message": "no such element: Unable to locate element"})
        self.assertEqual(rc["classification"], taxonomy.LOCATOR)
        self.assertEqual(rc["ownership"], "test-author")
        self.assertTrue(rc["recommendation"])

    def test_flaky_from_retry_metadata_not_message(self):
        rc = root_cause.analyze({"message": "eventually passed", "retries": 1, "finalStatus": "passed"})
        self.assertEqual(rc["classification"], taxonomy.FLAKY)

    def test_trusts_provided_analysis_classification(self):
        rc = root_cause.analyze({"classification": taxonomy.NETWORK, "confidence": 0.9})
        self.assertEqual(rc["classification"], taxonomy.NETWORK)
        self.assertEqual(rc["ownership"], "backend-or-infrastructure")

    def test_authorization_distinct_from_authentication(self):
        self.assertEqual(root_cause.analyze({"httpStatus": 401})["classification"], taxonomy.AUTH)
        self.assertEqual(root_cause.analyze({"httpStatus": 403})["classification"], taxonomy.AUTHORIZATION)

    def test_unknown_when_unclassifiable(self):
        rc = root_cause.analyze({"message": "a mysterious happening"})
        self.assertEqual(rc["classification"], taxonomy.UNKNOWN)


class PrioritizationTests(unittest.TestCase):
    def test_application_bug_outranks_locator(self):
        bug = prioritization.prioritize(root_cause.analyze({"classification": taxonomy.APPLICATION_BUG, "confidence": 0.9}), blocking=True)
        loc = prioritization.prioritize(root_cause.analyze({"classification": taxonomy.LOCATOR, "confidence": 0.8}))
        rank = {"P1": 3, "P2": 2, "P3": 1}
        self.assertGreater(rank[bug["priority"]], rank[loc["priority"]])

    def test_low_confidence_lowers_priority(self):
        high = prioritization.prioritize(root_cause.analyze({"classification": taxonomy.NETWORK, "confidence": 0.9}))
        low = prioritization.prioritize(root_cause.analyze({"classification": taxonomy.NETWORK, "confidence": 0.3}))
        rank = {"P1": 3, "P2": 2, "P3": 1}
        self.assertGreaterEqual(rank[high["priority"]], rank[low["priority"]])

    def test_carries_all_required_fields(self):
        prio = prioritization.prioritize(root_cause.analyze({"classification": taxonomy.LOCATOR}))
        for key in ("severity", "priority", "businessImpact", "technicalImpact",
                    "testingImpact", "confidence", "owner", "estimatedEffort"):
            self.assertIn(key, prio)


class RepairTests(unittest.TestCase):
    def test_locator_is_repairable_with_plan(self):
        plan = repair.plan_repair(root_cause.analyze({"classification": taxonomy.LOCATOR}), affected_files=["a.spec.ts"])
        self.assertTrue(plan["repairable"])
        self.assertEqual(plan["candidateType"], "locator-update")
        self.assertTrue(plan["permissionRequired"])
        self.assertTrue(plan["proposedChanges"])
        self.assertIn("diff guard", plan["safetyReview"])

    def test_application_bug_is_not_repairable(self):
        plan = repair.plan_repair(root_cause.analyze({"classification": taxonomy.APPLICATION_BUG}))
        self.assertFalse(plan["repairable"])
        self.assertEqual(plan["proposedChanges"], [])

    def test_no_code_in_plan(self):
        plan = repair.plan_repair(root_cause.analyze({"classification": taxonomy.TIMEOUT}))
        blob = " ".join(plan["proposedChanges"])
        for code_marker in ("await ", "function", "def ", "=>", "expect("):
            self.assertNotIn(code_marker, blob)


class TimelineTests(unittest.TestCase):
    def test_orders_start_failure_finish(self):
        execution_result = {
            "execution": {"startedAt": "2026-07-18T11:00:00Z", "finishedAt": "2026-07-18T11:00:30Z"},
            "executed": [{"title": "checkout", "file": "e2e/checkout.spec.ts", "status": "failed"}],
        }
        events = timeline.build_timeline(execution_result, [])
        phases = [e["phase"] for e in events]
        self.assertEqual(phases[0], "execution-start")
        self.assertIn("failure", phases)
        self.assertEqual(phases[-1], "execution-finish")

    def test_only_evidenced_stages_appear(self):
        events = timeline.build_timeline({"execution": {}}, [])
        # No finish timestamp and no failures -> only the start stage is evidenced.
        self.assertEqual([e["phase"] for e in events], ["execution-start"])


class EngineTests(unittest.TestCase):
    def test_diagnose_from_analysis_findings(self):
        analysis = {"findings": [
            {"classification": taxonomy.LOCATOR, "confidence": 0.8, "reason": "missing element",
             "affectedTests": ["checkout"], "evidence": [{"type": "trace", "description": "x", "source": "t.zip"}]},
            {"classification": taxonomy.APPLICATION_BUG, "confidence": 0.9, "reason": "500 on pay",
             "affectedTests": ["pay"], "evidence": [{"type": "network", "description": "500", "source": "h.har"}]},
        ]}
        execution = {"tests": {"total": 2, "passed": 0, "failed": 2, "skipped": 0},
                     "execution": {"startedAt": "2026-07-18T11:00:00Z", "finishedAt": "2026-07-18T11:00:30Z"}}
        diagnosis = engine.diagnose(execution, analysis)
        # The application bug (blocking, high) must rank above the locator failure.
        self.assertEqual(diagnosis["entries"][0]["rootCause"]["classification"], taxonomy.APPLICATION_BUG)
        self.assertTrue(diagnosis["timeline"])
        self.assertTrue(diagnosis["recommendations"])

    def test_release_readiness_not_ready_on_product_bug(self):
        analysis = {"findings": [{"classification": taxonomy.APPLICATION_BUG, "confidence": 0.9,
                                  "reason": "bug", "affectedTests": ["t"], "evidence": []}]}
        execution = {"tests": {"total": 1, "passed": 0, "failed": 1, "skipped": 0}}
        summary = engine.summarize(execution, engine.diagnose(execution, analysis))
        self.assertEqual(summary["releaseReadiness"], "not-ready")

    def test_release_readiness_ready_with_no_failures(self):
        execution = {"tests": {"total": 3, "passed": 3, "failed": 0, "skipped": 0}, "executed": []}
        summary = engine.summarize(execution, engine.diagnose(execution, None))
        self.assertEqual(summary["releaseReadiness"], "ready")

    def test_plan_repairs_from_diagnosis(self):
        analysis = {"findings": [{"classification": taxonomy.LOCATOR, "confidence": 0.8,
                                  "reason": "missing", "affectedTests": ["checkout"], "evidence": []}]}
        plans = engine.plan_repairs(engine.diagnose({"tests": {}}, analysis))
        self.assertEqual(len(plans), 1)
        self.assertTrue(plans[0]["repairable"])


if __name__ == "__main__":
    unittest.main()
