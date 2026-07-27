"""Tests for report attribution.

Three properties matter, and each is a way the footer could quietly go wrong:

1. **It renders exactly once, identically.** A footer typed by a model drifts; a
   footer appended twice looks broken. Snapshots pin the bytes.
2. **It is safe in HTML.** The footer is embedded in a document a person opens, so
   the link needs `rel="noopener noreferrer"`, and every interpolated value is
   escaped even though the metadata is repository-owned today.
3. **It never reaches a machine-readable artifact.** Appending prose to a contract
   artifact corrupts an interface. That boundary is asserted here and enforced
   repository-wide by scripts/check-branding.mjs.
"""

import json
import pathlib
import re
import unittest

from qa_analysis import branding

REPO = pathlib.Path(__file__).resolve().parents[4]


class MetadataTests(unittest.TestCase):
    def test_metadata_carries_every_required_field(self):
        data = branding.metadata()
        for key in ("projectName", "tagline", "author", "website",
                    "attributionPrefix", "authorPrefix"):
            self.assertTrue(data.get(key), f"missing or empty: {key}")

    def test_website_is_an_http_url(self):
        self.assertRegex(branding.metadata()["website"], r"^https?://")

    def test_metadata_lives_beside_the_renderer_so_it_travels_with_the_bundle(self):
        beside = pathlib.Path(branding.__file__).resolve().parent / "branding.json"
        self.assertTrue(beside.is_file(), "branding.json must sit inside the package")


class TextFooterTests(unittest.TestCase):
    def test_snapshot(self):
        expected = (
            "------------------------------------------------------------\n"
            "               Powered by QA Automation Pack\n"
            "       AI-First Deterministic QA Engineering Platform\n"
            "              Designed & Developed by Abisheik\n"
            "                    https://abisheik.dev\n"
            "------------------------------------------------------------\n"
        )
        self.assertEqual(branding.footer_text(), expected)

    def test_url_appears_in_full_for_pdf_writers_without_hyperlink_support(self):
        self.assertIn("https://abisheik.dev", branding.footer_text())

    def test_pdf_format_is_the_text_renderer(self):
        self.assertEqual(branding.footer("pdf"), branding.footer_text())

    def test_width_is_configurable_without_breaking_the_frame(self):
        rendered = branding.footer_text(width=40).splitlines()
        self.assertEqual(rendered[0], "-" * 40)
        self.assertEqual(rendered[-1], "-" * 40)


class MarkdownFooterTests(unittest.TestCase):
    def test_snapshot(self):
        expected = (
            "---\n"
            "\n"
            "<sub>Powered by **QA Automation Pack** — "
            "AI-First Deterministic QA Engineering Platform<br>\n"
            "Designed & Developed by [Abisheik](https://abisheik.dev)</sub>\n"
        )
        self.assertEqual(branding.footer_markdown(), expected)

    def test_author_is_a_link(self):
        self.assertIn("[Abisheik](https://abisheik.dev)", branding.footer_markdown())

    def test_separator_precedes_the_attribution(self):
        self.assertTrue(branding.footer_markdown().startswith("---\n"))


class HtmlFooterTests(unittest.TestCase):
    def setUp(self):
        self.rendered = branding.footer_html()

    def test_is_a_single_footer_element(self):
        self.assertEqual(self.rendered.count("<footer"), 1)
        self.assertEqual(self.rendered.count("</footer>"), 1)

    def test_link_opens_in_a_new_tab_safely(self):
        self.assertIn('target="_blank"', self.rendered)
        self.assertIn('rel="noopener noreferrer"', self.rendered)

    def test_link_points_at_the_author_site(self):
        self.assertIn('href="https://abisheik.dev"', self.rendered)

    def test_styling_is_inline_muted_small_and_centered(self):
        for expected in ("text-align:center", "font-size:0.75rem", "border-top", "color:#6b7280"):
            self.assertIn(expected, self.rendered)

    def test_is_self_contained_with_no_external_requests(self):
        # A report must render offline: no stylesheet, script, or remote asset.
        for forbidden in ("<link", "<script", "@import", "url("):
            self.assertNotIn(forbidden, self.rendered)

    def test_ampersand_in_the_metadata_is_escaped(self):
        # "Designed & Developed by" must not emit a bare ampersand.
        self.assertIn("Designed &amp; Developed by", self.rendered)
        self.assertNotIn("Designed & Developed", self.rendered)

    def test_class_name_is_escaped(self):
        rendered = branding.footer_html(class_name='x" onload="alert(1)')
        self.assertNotIn('onload="alert(1)"', rendered)
        self.assertIn("&quot;", rendered)

    def test_carries_the_project_name_and_tagline(self):
        self.assertIn("QA Automation Pack", self.rendered)
        self.assertIn("AI-First Deterministic QA Engineering Platform", self.rendered)


class AppendTests(unittest.TestCase):
    def test_appending_adds_the_footer(self):
        out = branding.append_to("# Report\n\nAll green.\n", fmt="markdown")
        self.assertIn("Powered by **QA Automation Pack**", out)
        self.assertTrue(out.startswith("# Report"))

    def test_appending_twice_does_not_duplicate(self):
        once = branding.append_to("# Report\n", fmt="markdown")
        twice = branding.append_to(once, fmt="markdown")
        self.assertEqual(once, twice)
        self.assertEqual(twice.count("Powered by"), 1)

    def test_html_append_is_also_idempotent(self):
        once = branding.append_to("<h1>Report</h1>\n", fmt="html")
        self.assertEqual(once.count("<footer"), 1)
        self.assertEqual(branding.append_to(once, fmt="html").count("<footer"), 1)


class FormatSelectionTests(unittest.TestCase):
    def test_every_declared_format_renders(self):
        for fmt in branding.FORMATS:
            self.assertTrue(branding.footer(fmt).strip(), fmt)

    def test_unknown_format_raises_rather_than_guessing(self):
        with self.assertRaises(branding.BrandingError):
            branding.footer("docx")

    def test_aliases_resolve(self):
        self.assertEqual(branding.footer("md"), branding.footer_markdown())
        self.assertEqual(branding.footer("txt"), branding.footer_text())


class BoundaryTests(unittest.TestCase):
    """Attribution must never reach something a program parses."""

    def test_no_contract_schema_mentions_branding(self):
        for path in sorted(REPO.glob("skills/*/contracts/*.schema.json")):
            text = path.read_text(encoding="utf-8")
            for token in ("Powered by", "abisheik.dev", "qa-pack-attribution"):
                self.assertNotIn(token, text, f"{path} carries a branding string")

    def test_no_committed_json_artifact_carries_the_footer(self):
        roots = [REPO / "tests/evals", REPO / "examples", REPO / "shared"]
        checked = 0
        for root in roots:
            for path in sorted(root.rglob("*.json")):
                if "node_modules" in path.parts or path.name == "branding.json":
                    continue
                text = path.read_text(encoding="utf-8")
                checked += 1
                self.assertNotIn("Powered by", text, f"{path} carries the footer")
                self.assertNotIn("abisheik.dev", text, f"{path} carries the footer")
        self.assertGreater(checked, 10, "expected to scan the committed JSON artifacts")

    def test_the_example_app_under_test_is_not_branded(self):
        # The system under test is the user's application, not our report.
        app = REPO / "examples/getting-started/app/index.html"
        text = app.read_text(encoding="utf-8")
        self.assertNotIn("Powered by", text)
        self.assertNotIn("abisheik.dev", text)


class SingleSourceTests(unittest.TestCase):
    def test_the_renderer_hardcodes_no_branding_copy(self):
        """Every string a reader sees comes from branding.json, so a wording
        change is one edit. The module may name the fields, not their values."""
        source = pathlib.Path(branding.__file__).read_text(encoding="utf-8")
        data = json.loads((pathlib.Path(branding.__file__).parent / "branding.json").read_text())
        code = source.split('"""', 2)[-1]  # skip the module docstring
        for field in ("projectName", "tagline", "author", "website"):
            self.assertNotIn(
                data[field], code,
                f"branding.py hardcodes the value of {field}; it must read it from branding.json",
            )

    def test_rendered_output_uses_every_metadata_field(self):
        data = branding.metadata()
        text = branding.footer_text()
        for field in ("projectName", "tagline", "author", "website"):
            self.assertIn(data[field], text, f"{field} is not rendered")

    def test_changing_the_metadata_changes_every_format(self):
        """The one-file-edit promise, exercised rather than asserted."""
        path = pathlib.Path(branding.__file__).parent / "branding.json"
        original = path.read_text(encoding="utf-8")
        try:
            edited = json.loads(original)
            edited["tagline"] = "A Different Tagline For This Test"
            path.write_text(json.dumps(edited, indent=2) + "\n", encoding="utf-8")
            for fmt in branding.FORMATS:
                self.assertIn("A Different Tagline For This Test", branding.footer(fmt), fmt)
        finally:
            path.write_text(original, encoding="utf-8")
        # And it is restored, so the snapshots above still hold.
        self.assertIn("AI-First Deterministic QA Engineering Platform", branding.footer_text())


if __name__ == "__main__":
    unittest.main()
