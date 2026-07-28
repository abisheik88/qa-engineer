"""Unit tests for the framework-agnostic analysis core."""

import json
import os
import pathlib
import tempfile
import unittest
import zipfile

from qa_analysis import redaction, junit, har, discovery, contracts, diff_guard, taxonomy
from qa_analysis.evidence import Evidence, Finding
from qa_analysis.junit import MalformedArtifact

HERE = pathlib.Path(__file__).resolve()
FIXTURES = HERE.parent / "fixtures"
ANALYSIS = HERE.parents[2]           # shared/analysis
REPO = HERE.parents[4]               # repository root
CONTEXT_SCHEMA = ANALYSIS / "schemas" / "context.schema.json"
EXEC_SCHEMA = REPO / "skills" / "qa-run" / "contracts" / "execution-result.schema.json"


class RedactionTests(unittest.TestCase):
    def test_masks_secrets_and_pii(self):
        text = (
            "Authorization: Bearer eyJabc123.def456.ghi789\n"
            "contact qa@example.com\n"
            "GET https://api.example.com/pay?token=SECRETVALUE12345\n"
            "password = hunter2secret\n"
        )
        out = redaction.redact_text(text)
        for leaked in ("eyJabc123.def456.ghi789", "qa@example.com", "SECRETVALUE12345", "hunter2secret"):
            self.assertNotIn(leaked, out)
        self.assertIn("REDACTED", out)

    def test_leaves_ordinary_text_untouched(self):
        text = "The checkout test failed after clicking the Pay button twice."
        self.assertEqual(redaction.redact_text(text), text)

    def test_detect_secrets_reports_without_values(self):
        found = redaction.detect_secrets("Authorization: Bearer eyJa.bbb.ccc")
        self.assertTrue(found)
        for item in found:
            self.assertIn("type", item)
            self.assertNotIn("value", item)

    def test_redact_headers_masks_sensitive(self):
        headers = [{"name": "Authorization", "value": "Bearer secret"}, {"name": "Accept", "value": "text/html"}]
        out = redaction.redact_headers(headers)
        self.assertEqual(out[0]["value"], "[REDACTED:header]")
        self.assertEqual(out[1]["value"], "text/html")

    def test_crlf_line_endings_survive_redaction(self):
        """Redaction masks a value; it must not rewrite the document around it.

        `.+$` under re.MULTILINE swallows the carriage return, so every redacted
        header line in a CRLF artifact — the normal case for a Windows runner log
        or a raw HTTP capture — came back with an LF ending and the file ended up
        with mixed endings. Found by the Node port's parity corpus, where
        JavaScript preserved the CR and Python did not.
        """
        text = "GET /pay\r\nAuthorization: Bearer abc123\r\nCookie: sid=xyz\r\nbody\r\n"
        out = redaction.redact_text(text)
        self.assertEqual(out.count("\r\n"), text.count("\r\n"))
        # And no LF was left without its CR — that is the corruption itself.
        self.assertEqual(out.count("\n"), out.count("\r\n"))
        self.assertIn("Authorization: [REDACTED:auth-header]\r\n", out)
        self.assertIn("Cookie: [REDACTED:cookie-header]\r\n", out)
        self.assertNotIn("abc123", out)
        self.assertNotIn("sid=xyz", out)

    def test_an_indented_header_is_still_masked(self):
        # Horizontal indentation is common in pretty-printed captures.
        out = redaction.redact_text("  Authorization: Bearer abc123\n\tCookie: a=1\n")
        self.assertNotIn("abc123", out)
        self.assertIn("  Authorization: [REDACTED:auth-header]", out)
        self.assertIn("\tCookie: [REDACTED:cookie-header]", out)


class JUnitTests(unittest.TestCase):
    def test_parses_playwright_junit(self):
        result = junit.parse_junit(str(FIXTURES / "playwright-junit.xml"))
        self.assertEqual(result["tests"], {"total": 2, "passed": 1, "failed": 1, "skipped": 0})
        failed = [e for e in result["executed"] if e["status"] == "failed"]
        self.assertEqual(len(failed), 1)
        self.assertEqual(failed[0]["title"], "completes a purchase")

    def test_malformed_raises(self):
        with tempfile.NamedTemporaryFile("w", suffix=".xml", delete=False) as handle:
            handle.write("<testsuites><not-closed>")
            bad = handle.name
        try:
            with self.assertRaises(MalformedArtifact):
                junit.parse_junit(bad)
        finally:
            os.unlink(bad)

    def _parse(self, xml):
        with tempfile.NamedTemporaryFile("w", suffix=".xml", delete=False) as handle:
            handle.write(xml)
            path = handle.name
        try:
            return junit.parse_junit(path)
        finally:
            os.unlink(path)

    def test_unreadable_duration_raises_the_documented_error(self):
        """A non-numeric `time` used to escape as a bare ValueError.

        Found by the Node port's parity corpus. The CLI catches MalformedArtifact
        and exits 2 with {error, detail}; a ValueError sailed past it and reached
        the caller as a Python traceback and exit 1 — which a skill's fallback
        logic has no way to recognize.
        """
        for value in ("not-a-number", "nan", "inf", "1.2.3", "5s"):
            with self.assertRaises(MalformedArtifact, msg=value):
                self._parse(f'<testsuite><testcase name="a" time="{value}"/></testsuite>')

    def test_absent_or_empty_duration_is_zero(self):
        # Plenty of runners omit it; that is not a malformed document.
        for xml in ('<testsuite><testcase name="a"/></testsuite>',
                    '<testsuite><testcase name="a" time=""/></testsuite>'):
            self.assertEqual(self._parse(xml)["executed"][0]["durationMs"], 0)

    def test_seconds_become_whole_milliseconds(self):
        result = self._parse('<testsuite><testcase name="a" time="1.5"/></testsuite>')
        self.assertEqual(result["executed"][0]["durationMs"], 1500)


class HarTests(unittest.TestCase):
    def test_parses_and_flags(self):
        result = har.parse_har(str(FIXTURES / "sample.har"))
        self.assertEqual(len(result["entries"]), 2)
        self.assertEqual(len(result["failures"]), 1)
        self.assertEqual(result["failures"][0]["status"], 500)
        self.assertEqual(len(result["slow"]), 1)

    def test_redacts_everything_sensitive(self):
        blob = json.dumps(har.parse_har(str(FIXTURES / "sample.har")))
        for leaked in ("SECRETTOKEN12345", "eyJabc123", "session=abc123def"):
            self.assertNotIn(leaked, blob)

    def test_malformed_raises(self):
        with self.assertRaises(MalformedArtifact):
            har.parse_har(str(FIXTURES / "malformed.har"))


class DiscoveryTests(unittest.TestCase):
    def test_classifies_present_partial_corrupted(self):
        with tempfile.TemporaryDirectory() as root:
            with open(os.path.join(root, "results.xml"), "w") as fh:
                fh.write("<testsuites/>")
            open(os.path.join(root, "empty.har"), "w").close()          # size 0 -> partial
            with open(os.path.join(root, "trace.zip"), "w") as fh:
                fh.write("not a zip")                                    # -> corrupted
            result = discovery.discover(root=root)
            present = {a.type for a in result["present"]}
            self.assertIn("junit", present)
            self.assertTrue(any(a.type == "har" for a in result["partial"]))
            self.assertTrue(any(a.type == "trace" for a in result["corrupted"]))

    def test_explicit_missing_reported(self):
        result = discovery.discover(explicit=["does/not/exist.xml"])
        self.assertEqual(result["missing"], ["does/not/exist.xml"])


class ContractTests(unittest.TestCase):
    def test_valid_execution_result_passes(self):
        instance = json.loads((FIXTURES / "valid-execution-result.json").read_text())
        schema = contracts.load_schema(str(EXEC_SCHEMA))
        ok, errors = contracts.validate(instance, schema)
        self.assertTrue(ok, errors)

    def test_invalid_execution_result_fails(self):
        instance = json.loads((FIXTURES / "invalid-execution-result.json").read_text())
        schema = contracts.load_schema(str(EXEC_SCHEMA))
        ok, errors = contracts.validate(instance, schema)
        self.assertFalse(ok)
        self.assertTrue(any("classification" in e for e in errors))
        self.assertTrue(any("evidence" in e for e in errors))

    def test_context_schema_valid_and_invalid(self):
        schema = contracts.load_schema(str(CONTEXT_SCHEMA))
        good = json.loads((FIXTURES / "valid-context.json").read_text())
        ok, errors = contracts.validate(good, schema)
        self.assertTrue(ok, errors)
        bad = json.loads((FIXTURES / "invalid-context.json").read_text())
        ok, errors = contracts.validate(bad, schema)
        self.assertFalse(ok)


class DiffGuardTests(unittest.TestCase):
    def _rules(self, fixture):
        issues = diff_guard.check_diff((FIXTURES / fixture).read_text())
        return {i["rule"] for i in issues}, issues

    def _highs(self, issues):
        return [i for i in issues if i["severity"] == "high"]

    def test_safe_diff_has_no_high_severity(self):
        issues = diff_guard.check_diff((FIXTURES / "safe.diff").read_text())
        self.assertFalse(self._highs(issues), issues)

    def test_unsafe_diff_flags_expected_rules(self):
        rules, issues = self._rules("unsafe.diff")
        self.assertIn("removed-assertion", rules)
        self.assertIn("added-skip-or-only", rules)
        self.assertIn("timeout-inflation", rules)
        self.assertTrue(self._highs(issues))
        for issue in issues:
            self.assertTrue(issue["why"])  # every flag explains itself

    def test_removed_wait_is_reachable(self):
        """The rule was previously unreachable: its own pattern matched
        `expect(`, which the assertion guard excluded."""
        rules, _ = self._rules("unsafe.diff")
        self.assertIn("removed-wait", rules)

    # --- job 2: a real repair must not read as an unsafe change --------------

    def test_locator_repair_keeping_the_assertion_is_not_high_severity(self):
        """`/qa-fix`'s primary job rewrites an assertion line to heal a locator.
        Flagging that `high` trains everyone to override the guard."""
        rules, issues = self._rules("locator-improvement.diff")
        self.assertFalse(self._highs(issues), issues)
        self.assertIn("assertion-modified", rules)
        self.assertNotIn("removed-assertion", rules)

    def test_an_identical_re_added_assertion_is_not_flagged(self):
        diff = (
            "--- a/e2e/a.spec.ts\n+++ b/e2e/a.spec.ts\n@@ -1,2 +1,2 @@\n"
            "-  await expect(page.locator('#total')).toHaveText('42');\n"
            "+  await expect(page.locator('#total')).toHaveText('42');\n"
        )
        issues = diff_guard.check_diff(diff)
        self.assertEqual([i for i in issues if i["rule"].startswith(("removed", "weakened"))], [])

    # --- job 1: every way a suite is made to lie -----------------------------

    def test_weakened_assertion_is_high(self):
        rules, issues = self._rules("assertion-weakened.diff")
        self.assertIn("weakened-assertion", rules)
        self.assertTrue(self._highs(issues))

    def test_assertion_that_drops_its_expected_value_is_high(self):
        rules, issues = self._rules("assertion-value-dropped.diff")
        self.assertIn("weakened-assertion", rules)
        self.assertTrue(self._highs(issues))

    def test_conditional_early_return_is_high(self):
        rules, issues = self._rules("conditional-skip.diff")
        self.assertIn("conditional-skip", rules)
        self.assertTrue(self._highs(issues))

    def test_forced_pass_command_is_high(self):
        rules, issues = self._rules("forced-pass-command.diff")
        self.assertIn("forced-pass-command", rules)
        self.assertTrue(self._highs(issues))

    def test_suite_exclusion_is_high(self):
        rules, issues = self._rules("suite-exclusion.diff")
        self.assertIn("suite-exclusion", rules)
        self.assertTrue(self._highs(issues))

    def test_deleted_test_file_is_high_regardless_of_size(self):
        """A seven-line spec file sits under the mass-deletion threshold, so
        deletion must be detected as deletion."""
        rules, issues = self._rules("test-file-deleted.diff")
        self.assertIn("test-file-deleted", rules)
        self.assertTrue(self._highs(issues))

    def test_swallowed_failure_is_high(self):
        rules, issues = self._rules("swallowed-failure.diff")
        self.assertIn("swallowed-failure", rules)
        self.assertTrue(self._highs(issues))

    def test_soft_assertion_replacing_a_hard_one_is_a_weakening(self):
        diff = (
            "--- a/e2e/a.spec.ts\n+++ b/e2e/a.spec.ts\n@@ -1,2 +1,2 @@\n"
            "-  await expect(page.locator('#total')).toHaveText('42');\n"
            "+  await expect.soft(page.locator('#total')).toHaveText('42');\n"
        )
        rules = {i["rule"] for i in diff_guard.check_diff(diff)}
        self.assertIn("weakened-assertion", rules)

    def test_returning_a_value_is_not_an_early_return(self):
        """`return page.click(...)` is ordinary code, not a skip in disguise."""
        diff = (
            "--- a/e2e/a.spec.ts\n+++ b/e2e/a.spec.ts\n@@ -1,1 +1,2 @@\n"
            "+  return page.getByRole('button', { name: 'Pay' }).click();\n"
        )
        rules = {i["rule"] for i in diff_guard.check_diff(diff)}
        self.assertNotIn("conditional-skip", rules)

    def test_fixme_and_only_markers_are_caught(self):
        for marker in ("test.fixme();", "test.only('a', async () => {});", "@Disabled"):
            diff = f"--- a/e2e/a.spec.ts\n+++ b/e2e/a.spec.ts\n@@ -1,1 +1,2 @@\n+  {marker}\n"
            rules = {i["rule"] for i in diff_guard.check_diff(diff)}
            self.assertIn("added-skip-or-only", rules, marker)

    def test_every_issue_names_a_rule_severity_file_and_reason(self):
        for fixture in (
            "unsafe.diff", "assertion-weakened.diff", "conditional-skip.diff",
            "forced-pass-command.diff", "suite-exclusion.diff",
            "test-file-deleted.diff", "swallowed-failure.diff",
        ):
            _, issues = self._rules(fixture)
            for issue in issues:
                self.assertEqual(
                    set(issue), {"rule", "severity", "file", "why", "sample"}, fixture,
                )
                self.assertIn(issue["severity"], ("high", "medium", "low"))
                self.assertTrue(issue["file"])
                self.assertTrue(issue["why"])


class RealRunnerMessageTests(unittest.TestCase):
    """Classification pinned to real, captured runner output.

    Every string below was copied from an actual `npx playwright test` run
    against examples/getting-started, not written from memory. They exist because
    Playwright prints a timeout budget in *every* assertion failure, which made a
    naive timeout rule swallow both locator and assertion failures — and told the
    reader to raise a timeout, the one action that cannot help.
    """

    # Element does not exist. Note "element(s)" — the parenthesis is why an
    # `element .*not found` pattern missed this for real output.
    MISSING_ELEMENT = (
        "Error: expect(locator).toHaveText(expected) failed\n"
        "\n"
        "Locator: getByTestId('welcome-missing')\n"
        "Expected: \"Welcome back\"\n"
        "Timeout: 5000ms\n"
        "Error: element(s) not found\n"
        "\n"
        "Call log:\n"
        "  - Expect \"toHaveText\" with timeout 5000ms\n"
        "  - waiting for getByTestId('welcome-missing')\n"
    )

    # Element exists; the text differs. Both messages contain "waiting for
    # getByTestId(...)", so that phrase alone cannot discriminate them.
    TEXT_MISMATCH = (
        "Error: expect(locator).toHaveText(expected) failed\n"
        "\n"
        "Locator:  getByTestId('welcome')\n"
        "Expected: \"Totally different text\"\n"
        "Received: \"Welcome back\"\n"
        "Timeout:  5000ms\n"
        "\n"
        "Call log:\n"
        "  - Expect \"toHaveText\" with timeout 5000ms\n"
        "  - waiting for getByTestId('welcome')\n"
        "    14 x locator resolved to <h1 data-testid=\"welcome\">Welcome back</h1>\n"
    )

    def test_missing_element_is_a_locator_failure_not_a_timeout(self):
        classification, confidence, _ = taxonomy.classify(self.MISSING_ELEMENT)
        self.assertEqual(classification, taxonomy.LOCATOR)
        self.assertGreaterEqual(confidence, 0.8)

    def test_value_mismatch_is_an_assertion_failure_not_a_timeout(self):
        classification, confidence, _ = taxonomy.classify(self.TEXT_MISMATCH)
        self.assertEqual(classification, taxonomy.ASSERTION)
        self.assertGreaterEqual(confidence, 0.8)

    def test_the_two_messages_are_not_conflated(self):
        """They share the locator expression and the timeout line, so a rule that
        keys on either one alone would classify both identically."""
        for shared in ("waiting for getByTestId(", "Timeout"):
            self.assertIn(shared, self.MISSING_ELEMENT)
            self.assertIn(shared, self.TEXT_MISMATCH)
        self.assertNotEqual(
            taxonomy.classify(self.MISSING_ELEMENT)[0],
            taxonomy.classify(self.TEXT_MISMATCH)[0],
        )

    def test_a_genuine_timeout_is_still_a_timeout(self):
        """Neither an element-not-found nor an expected/received comparison."""
        genuine = "page.goto: Timeout 30000ms exceeded.\nCall log:\n  - navigating to \"/slow\"\n"
        self.assertEqual(taxonomy.classify(genuine)[0], taxonomy.TIMEOUT)

    def test_selenium_missing_element_phrasing(self):
        selenium = (
            'no such element: Unable to locate element: '
            '{"method":"css selector","selector":"#cart-button"}'
        )
        self.assertEqual(taxonomy.classify(selenium)[0], taxonomy.LOCATOR)

    def test_the_classification_drives_a_different_owner_and_action(self):
        """The point of getting this right: the three classes lead to three
        different next actions, so conflating them misroutes the work."""
        seen = {
            taxonomy.classify(self.MISSING_ELEMENT)[0],
            taxonomy.classify(self.TEXT_MISMATCH)[0],
            taxonomy.classify("page.goto: Timeout 30000ms exceeded.")[0],
        }
        self.assertEqual(seen, {taxonomy.LOCATOR, taxonomy.ASSERTION, taxonomy.TIMEOUT})


class TaxonomyTests(unittest.TestCase):
    def test_http_status_wins(self):
        self.assertEqual(taxonomy.classify("something", http_status=401)[0], taxonomy.AUTH)
        self.assertEqual(taxonomy.classify("something", http_status=403)[0], taxonomy.AUTHORIZATION)

    def test_locator_before_timeout(self):
        cls, _, _ = taxonomy.classify("Timeout 30000ms exceeded waiting for locator getByRole")
        self.assertEqual(cls, taxonomy.LOCATOR)

    def test_unknown_when_no_rule_matches(self):
        cls, conf, _ = taxonomy.classify("a wild unclassifiable message")
        self.assertEqual(cls, taxonomy.UNKNOWN)
        self.assertLess(conf, 0.5)


class EvidenceModelTests(unittest.TestCase):
    def test_finding_shape_and_redaction(self):
        finding = Finding(
            classification=taxonomy.NETWORK,
            reason="500 on POST /api/pay",
            artifact="trace.zip",
            location="test-results/checkout/trace.zip",
            confidence=0.9,
            evidence=[Evidence("network", "server error", "POST /api/pay", "Authorization: Bearer eyJa.b.c")],
            affected_tests=["completes a purchase"],
        )
        data = finding.to_dict()
        self.assertEqual(data["classification"], "network")
        self.assertIn("affectedTests", data)
        self.assertNotIn("eyJa.b.c", json.dumps(data))  # excerpt redacted

    def test_bad_evidence_type_rejected(self):
        with self.assertRaises(ValueError):
            Evidence("not-a-type", "d", "s")


if __name__ == "__main__":
    unittest.main()
