"""Tests for the HTML report renderer.

The renderer exists because a hand-written report lost data the artifact already
carried. So the tests are written against that failure, not against the markup:

1. **Nothing required is dropped.** Every field the contract requires on a finding
   appears in the rendered page. This is asserted by reading the contract's own
   `required` list, so adding a required field to the schema fails these tests
   until the renderer renders it — the drift cannot come back quietly.
2. **The footer is present.** It was missing from the real report.
3. **It opens offline.** No stylesheet, script, font, or remote asset: a report is
   read from an email attachment.
4. **Untrusted text cannot become markup.** Findings quote DOM and console output
   from the application under test.
"""

import html
import json
import pathlib
import unittest

from qa_analysis import report_html

REPO = pathlib.Path(__file__).resolve().parents[4]
EXPLORE_SCHEMA = REPO / "skills/qa-explore/contracts/explore-result.schema.json"


def _finding(**overrides):
    finding = {
        "id": "EXP-1",
        "severity": "high",
        "dimension": "functional",
        "title": "Double-click on Login fires two auth requests",
        "repro": "1. Open /login  2. Enter credentials  3. Double-click Login",
        "actual": "Two identical POST requests are sent for one submit.",
        "expected": "One request per submit; the button is disabled while in flight.",
        "fixDirection": "Disable the control on click; re-enable when the request settles.",
        "status": "confirmed",
        "evidence": [{"type": "screenshot", "source": "screenshots/tc-16.png"}],
    }
    finding.update(overrides)
    return finding


def _explore(**overrides):
    result = {
        "contract": {"name": "qa-explore/explore-result", "version": "1.0.0"},
        "skill": {"name": "qa-explore", "version": "0.1.0"},
        "generatedAt": "2026-07-28T00:00:00Z",
        "url": "http://localhost:4201/login",
        "summary": "Login page QA: one high-severity defect.",
        "classification": "issues-found",
        "severityCounts": {"critical": 0, "high": 1, "medium": 0, "low": 0},
        "findings": [_finding()],
        "evidence": [
            {"type": "screenshot", "description": "Two requests", "source": "screenshots/tc-16.png"}
        ],
    }
    result.update(overrides)
    return result


class RequiredFieldTests(unittest.TestCase):
    """The contract's required finding fields must all reach the page."""

    def setUp(self):
        self.page = report_html.render(_explore())

    def test_every_required_finding_field_is_rendered(self):
        schema = json.loads(EXPLORE_SCHEMA.read_text(encoding="utf-8"))
        required = schema["properties"]["findings"]["items"]["required"]
        finding = _finding()
        self.assertIn("repro", required, "the contract no longer requires repro")
        for field in required:
            # Rendered structurally rather than as one string, and each is asserted
            # by its own test below: evidence as figures, severity/status/dimension
            # as words, repro as a step list.
            if field in ("evidence", "severity", "status", "dimension"):
                continue
            if field == "repro":
                for step in ("Open /login", "Enter credentials", "Double-click Login"):
                    self.assertIn(f"<li>{step}</li>", self.page, "a repro step was dropped")
                continue
            self.assertIn(
                html.escape(str(finding[field]), quote=True), self.page,
                f"the renderer dropped the required field {field!r}",
            )

    def test_current_and_expected_behaviour_are_labelled_for_a_reader(self):
        # The original report left the reader to infer what "correct" was.
        self.assertIn("Current behaviour", self.page)
        self.assertIn("Expected behaviour", self.page)
        self.assertLess(
            self.page.index("Current behaviour"), self.page.index("Reproduction"),
            "what is wrong now must come before how to reproduce it",
        )

    def test_severity_and_status_are_rendered_as_words_not_codes(self):
        self.assertIn("High", self.page)
        self.assertIn("Confirmed", self.page)

    def test_evidence_is_rendered_with_its_source(self):
        self.assertIn("screenshots/tc-16.png", self.page)
        self.assertIn("<img", self.page)

    def test_a_non_image_evidence_excerpt_is_shown_verbatim(self):
        page = report_html.render(_explore(findings=[_finding(evidence=[
            {"type": "console", "source": "console.log", "excerpt": "TypeError: x is undefined"}
        ])]))
        self.assertIn("TypeError: x is undefined", page)
        self.assertIn("Console output", page)


class AttributionTests(unittest.TestCase):
    def test_the_footer_is_present(self):
        page = report_html.render(_explore())
        self.assertIn("qa-pack-attribution", page)
        self.assertEqual(page.count("<footer"), 1)

    def test_the_footer_is_the_last_element_in_the_page(self):
        page = report_html.render(_explore())
        self.assertLess(page.index("</footer>"), page.index("</body>"))
        self.assertNotIn("<article", page[page.index("</footer>"):])


class SelfContainmentTests(unittest.TestCase):
    def test_no_external_request_is_made(self):
        page = report_html.render(_explore())
        for forbidden in ("<link", "<script", "@import", "https://fonts", "cdn."):
            self.assertNotIn(forbidden, page, f"the report reaches for {forbidden}")

    def test_the_only_remote_href_is_the_attribution_link(self):
        page = report_html.render(_explore())
        self.assertEqual(page.count("http://"), page.count("http://localhost:4201/login"))

    def test_the_document_is_complete(self):
        page = report_html.render(_explore())
        self.assertTrue(page.startswith("<!DOCTYPE html>"))
        self.assertTrue(page.rstrip().endswith("</html>"))
        self.assertIn("<style>", page)


class EscapingTests(unittest.TestCase):
    """Findings quote the application's own DOM and console output."""

    def test_markup_in_a_finding_cannot_become_markup(self):
        page = report_html.render(_explore(findings=[_finding(
            actual='<img src=x onerror="alert(1)">',
            title="</h3><script>alert(2)</script>",
        )]))
        self.assertNotIn("<script>", page)
        self.assertNotIn('onerror="alert(1)"', page)
        self.assertIn("&lt;script&gt;", page)

    def test_an_evidence_source_cannot_break_out_of_its_attribute(self):
        page = report_html.render(_explore(findings=[_finding(evidence=[
            {"type": "screenshot", "source": 'a.png" onload="alert(1)'}
        ])]))
        self.assertNotIn('onload="alert(1)"', page)


class StructureTests(unittest.TestCase):
    def test_findings_are_ordered_worst_first(self):
        page = report_html.render(_explore(
            severityCounts={"critical": 1, "high": 1, "medium": 1, "low": 1},
            findings=[
                _finding(id="EXP-4", severity="low", title="Low one"),
                _finding(id="EXP-1", severity="critical", title="Critical one"),
                _finding(id="EXP-3", severity="medium", title="Medium one"),
                _finding(id="EXP-2", severity="high", title="High one"),
            ],
        ))
        order = [page.index(t) for t in ("Critical one", "High one", "Medium one", "Low one")]
        self.assertEqual(order, sorted(order))

    def test_a_failing_case_links_to_the_finding_it_raised(self):
        page = report_html.render(_explore(testCases={
            "total": 2, "passed": 1, "failed": 1, "blocked": 0, "skipped": 0,
            "cases": [
                {"id": "TC-16", "title": "Double-click submit", "status": "fail", "findingId": "EXP-1"},
                {"id": "TC-2", "title": "Toggle works", "status": "pass"},
            ],
        }))
        self.assertIn('id="f-EXP-1"', page)
        self.assertIn('href="#f-EXP-1"', page)

    def test_cases_are_ordered_failures_first_then_naturally(self):
        page = report_html.render(_explore(testCases={
            "total": 3, "passed": 2, "failed": 1, "blocked": 0, "skipped": 0,
            "cases": [
                {"id": "TC-10", "title": "Tenth", "status": "pass"},
                {"id": "TC-2", "title": "Second", "status": "pass"},
                {"id": "TC-16", "title": "Sixteenth", "status": "fail"},
            ],
        }))
        order = [page.index(t) for t in ("Sixteenth", "Second", "Tenth")]
        self.assertEqual(order, sorted(order), "failures first, then TC-2 before TC-10")

    def test_numbered_repro_becomes_a_step_list(self):
        page = report_html.render(_explore())
        self.assertIn("<ol class=\"steps\">", page)
        self.assertIn("<li>Enter credentials</li>", page)

    def test_prose_repro_stays_prose(self):
        page = report_html.render(_explore(findings=[_finding(
            repro="Double-click the Login button while the first request is in flight."
        )]))
        self.assertNotIn('<ol class="steps">', page)
        self.assertIn("Double-click the Login button", page)

    def test_the_heading_is_short_and_the_summary_is_the_lead(self):
        # A five-line <h1> was the first attempt; the summary belongs in the body.
        page = report_html.render(_explore())
        heading = page.split("<h1>", 1)[1].split("</h1>", 1)[0]
        self.assertEqual(heading, "localhost:4201/login")
        self.assertIn('<p class="lead">Login page QA: one high-severity defect.</p>', page)

    def test_the_evidence_index_lists_every_entry_with_its_description(self):
        page = report_html.render(_explore())
        self.assertIn("Evidence index", page)
        self.assertIn("Two requests", page)

    def test_out_of_scope_db_validation_says_so_rather_than_vanishing(self):
        page = report_html.render(_explore(dbValidation={"inScope": False}))
        self.assertIn("Not in scope", page)

    def test_no_findings_renders_an_explicit_empty_state(self):
        page = report_html.render(_explore(
            classification="pass",
            severityCounts={"critical": 0, "high": 0, "medium": 0, "low": 0},
            findings=[],
        ))
        self.assertIn("No findings recorded", page)
        self.assertIn("No defects found", page)


class OrientationTests(unittest.TestCase):
    """A forwarded report must explain itself to someone who was not there."""

    def test_the_report_says_what_kind_of_document_it_is(self):
        page = report_html.render(_explore())
        self.assertIn("exploratory QA report", page)
        self.assertIn("About this report", page)

    def test_the_orientation_comes_before_the_first_finding(self):
        page = report_html.render(_explore())
        self.assertLess(page.index("About this report"), page.index("<h2>Findings</h2>"))

    def test_how_the_application_was_observed_is_stated_in_plain_words(self):
        page = report_html.render(_explore(browserAdapter="playwright-mcp"))
        self.assertIn("a real browser driven by Playwright", page)

    def test_an_unavailable_browser_is_not_dressed_up_as_a_real_one(self):
        page = report_html.render(_explore(browserAdapter="unavailable"))
        self.assertIn("no browser automation", page)
        self.assertNotIn("a real browser", page)

    def test_every_dimension_run_is_explained_not_just_named(self):
        page = report_html.render(_explore(dimensionsRun=["functional", "ux", "security"]))
        for plain in (
            "Does the feature do what it is supposed to do",
            "Whether the flow makes sense to a person using it",
            "where credentials and tokens are stored",
        ):
            self.assertIn(plain, page, "a dimension was named without being explained")

    def test_the_severity_legend_defines_every_level(self):
        page = report_html.render(_explore())
        for meaning in ("Blocks release", "Fix before release", "Fix soon", "Worth fixing"):
            self.assertIn(meaning, page)

    def test_declared_scope_is_rendered(self):
        page = report_html.render(_explore(scope={
            "objective": "Check whether a new user can sign in, and what happens when they cannot.",
            "covered": ["The sign-in form at /login and its password toggle"],
            "notCovered": ["Signing in successfully — a QA run must not enter real credentials"],
        }))
        self.assertIn("Check whether a new user can sign in", page)
        self.assertIn("The sign-in form at /login and its password toggle", page)
        self.assertIn("must not enter real credentials", page)
        self.assertIn("Not covered in this run", page)

    def test_an_unrun_dimension_is_reported_as_not_covered(self):
        page = report_html.render(_explore(dimensionsRun=["functional"]))
        self.assertIn("Not covered in this run", page)
        self.assertIn("was not examined", page)
        # And with its plain meaning, not only its jargon name.
        self.assertIn("whether the numbers and text on screen match", page)

    def test_a_blocked_case_is_named_as_something_that_could_not_be_run(self):
        page = report_html.render(_explore(testCases={
            "total": 1, "passed": 0, "failed": 0, "blocked": 1, "skipped": 0,
            "cases": [{"id": "TC-1", "title": "Valid credentials sign in", "status": "blocked"}],
        }))
        self.assertIn("Could not be run", page)
        self.assertIn("TC-1 (Valid credentials sign in)", page)

    def test_a_run_with_no_scope_still_explains_itself(self):
        # Older artifacts, and runs that skip the field, must not lose the section.
        page = report_html.render(_explore())
        self.assertIn("About this report", page)
        self.assertIn("How to read the findings", page)

    def test_scope_prose_is_escaped_like_everything_else(self):
        page = report_html.render(_explore(scope={"objective": "<script>alert(1)</script>"}))
        self.assertNotIn("<script>alert(1)</script>", page)


class ContractSelectionTests(unittest.TestCase):
    def test_an_unsupported_contract_is_refused_rather_than_half_rendered(self):
        with self.assertRaises(report_html.ReportError) as caught:
            report_html.render({"contract": {"name": "qa-run/execution-result", "version": "1.0.0"}})
        self.assertIn("qa-explore/explore-result", str(caught.exception))

    def test_supported_contracts_are_declared(self):
        self.assertEqual(
            report_html.supported_contracts(),
            ["qa-explore/explore-result", "qa-report/report-result"],
        )

    def test_a_report_result_renders_its_verdict_and_summaries(self):
        page = report_html.render({
            "contract": {"name": "qa-report/report-result", "version": "1.0.0"},
            "generatedAt": "2026-07-28T00:00:00Z",
            "summary": "One suite failed.",
            "releaseReadiness": {"verdict": "not-ready", "rationale": "A product defect blocks release."},
            "testSummary": {"total": 10, "passed": 9, "failed": 1, "skipped": 0},
            "summaries": {"executive": "Do not ship yet.", "engineering": "Fix the cart locator."},
            "failureSummary": [{"test": "checkout", "classification": "product-bug", "reason": "cart empty"}],
        })
        self.assertIn("Not ready", page)
        self.assertIn("Do not ship yet.", page)
        self.assertIn("Fix the cart locator.", page)
        self.assertIn("qa-pack-attribution", page)

    def test_a_missing_file_is_a_report_error_not_a_traceback(self):
        with self.assertRaises(report_html.ReportError):
            report_html.render_file(str(REPO / "no-such-artifact.json"))


class RealArtifactTests(unittest.TestCase):
    """The fixture used above must itself satisfy the contract.

    Otherwise these tests could pass against a shape qa-explore never produces.
    """

    def test_the_fixture_validates_against_the_explore_contract(self):
        from qa_analysis import contracts

        schema = contracts.load_schema(EXPLORE_SCHEMA)
        ok, errors = contracts.validate(_explore(), schema)
        self.assertTrue(ok, errors)


if __name__ == "__main__":
    unittest.main()
