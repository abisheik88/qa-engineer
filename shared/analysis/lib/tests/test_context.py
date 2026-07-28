"""Tests for deterministic `.qa/context.md` parsing.

The project context is the one artifact every skill reads. Its contract is a JSON
Schema, but before this parser existed nothing could check a real
`.qa/context.md` against it — CI validated a hand-written JSON fixture instead.
These tests hold the parser to the file the pack actually generates (the qa-init
template) and to the documented subset boundaries.
"""

import json
import pathlib
import unittest

from qa_analysis import contracts
from qa_analysis.context import MalformedContext, parse, parse_file, parse_frontmatter

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[3]
FIXTURES = HERE / "fixtures"
SCHEMA = contracts.load_schema(REPO / "shared/analysis/schemas/context.schema.json")
TEMPLATE = REPO / "skills/qa-init/templates/context.md"


class TemplateTests(unittest.TestCase):
    """The parser must handle the exact file qa-init writes."""

    def test_the_qa_init_template_parses_with_full_structure(self):
        result = parse(TEMPLATE.read_text(encoding="utf-8"))
        context = result["context"]
        # Nesting is preserved — not flattened into the root.
        self.assertEqual(context["repository"]["root"], ".")
        self.assertIs(context["repository"]["monorepo"], False)
        self.assertEqual(context["repository"]["packages"], [])
        self.assertEqual(context["testFramework"], {"unit": None, "e2e": None, "bdd": None})
        self.assertEqual(context["browserAutomation"], {"tool": None, "mcp": False})
        self.assertEqual(context["runtime"], {})
        self.assertEqual(context["schemaVersion"], 1)

    def test_the_template_carries_every_required_contract_field(self):
        context = parse(TEMPLATE.read_text(encoding="utf-8"))["context"]
        for field in SCHEMA["required"]:
            self.assertIn(field, context, f"template omits required field {field}")

    def test_the_template_is_a_template_not_a_valid_context(self):
        # Placeholders are deliberately invalid; a generated file replaces them.
        result = parse(TEMPLATE.read_text(encoding="utf-8"), schema=SCHEMA)
        self.assertFalse(result["valid"])


class ValidContextTests(unittest.TestCase):
    def setUp(self):
        self.result = parse_file(FIXTURES / "valid-context.md", schema=SCHEMA)

    def test_a_generated_context_validates_against_the_contract(self):
        self.assertTrue(self.result["valid"], self.result["errors"])

    def test_scalars_are_typed_not_left_as_strings(self):
        context = self.result["context"]
        self.assertEqual(context["schemaVersion"], 1)
        self.assertIs(context["existingAutomation"], True)
        self.assertIs(context["repository"]["monorepo"], False)
        self.assertIsNone(context["buildTool"])
        self.assertIsNone(context["testFramework"]["unit"])

    def test_block_sequences_parse_into_lists(self):
        context = self.result["context"]
        self.assertEqual(context["language"]["others"], ["javascript"])
        self.assertEqual(context["apiStyles"], ["rest"])
        self.assertEqual(context["ci"]["workflows"], [".github/workflows/ci.yml"])
        self.assertEqual(context["conventions"]["configFiles"], ["playwright.config.ts"])

    def test_trailing_comments_are_stripped_from_values(self):
        self.assertEqual(self.result["context"]["testFramework"]["e2e"], "playwright")

    def test_the_body_is_returned_separately(self):
        self.assertIn("# QA Project Context", self.result["body"])
        self.assertNotIn("schemaVersion", self.result["body"])

    def test_the_parsed_result_matches_the_json_fixture(self):
        """The Markdown and JSON fixtures describe the same project, so the
        parser's output must equal the JSON the contract was tested with."""
        with open(FIXTURES / "valid-context.json", "r", encoding="utf-8") as handle:
            expected = json.load(handle)
        self.assertEqual(self.result["context"], expected)


class InvalidContextTests(unittest.TestCase):
    def test_a_context_that_breaks_the_contract_is_reported_not_raised(self):
        text = (
            "---\n"
            "schemaVersion: 1\n"
            'generatedBy: "qa-init@0.1.0"\n'
            'generatedAt: "not-a-date"\n'
            "repository:\n  root: \".\"\n  monorepo: false\n  packages: []\n"
            "language:\n  primary: \"typescript\"\n"
            "packageManager: \"pnpm\"\n"
            "testFramework:\n  unit: null\n  e2e: null\n  bdd: null\n"
            "browserAutomation:\n  tool: null\n  mcp: false\n"
            "apiStyles: []\n"
            "ci:\n  provider: null\n  workflows: []\n"
            "conventions:\n  testDir: null\n  specGlob: null\n  configFiles: []\n"
            'confidence: "high"\n'
            "---\n\nbody\n"
        )
        result = parse(text, schema=SCHEMA)
        self.assertFalse(result["valid"])
        self.assertTrue(any("date-time" in e for e in result["errors"]), result["errors"])

    def test_an_unknown_package_manager_is_rejected_by_the_contract(self):
        text = FIXTURES.joinpath("valid-context.md").read_text(encoding="utf-8")
        result = parse(text.replace('packageManager: "pnpm"', 'packageManager: "bun"'), schema=SCHEMA)
        self.assertFalse(result["valid"])


class SubsetBoundaryTests(unittest.TestCase):
    """Everything outside the documented subset must fail loudly rather than be
    silently misread — a parser that guesses is worse than one that refuses."""

    def test_missing_frontmatter_raises(self):
        with self.assertRaises(MalformedContext):
            parse("# Just a document\n")

    def test_unterminated_frontmatter_raises(self):
        with self.assertRaises(MalformedContext):
            parse("---\nschemaVersion: 1\n")

    def test_block_scalars_are_rejected(self):
        with self.assertRaises(MalformedContext):
            parse_frontmatter("notes: |\n  a folded value\n")

    def test_non_empty_flow_collections_are_rejected(self):
        with self.assertRaises(MalformedContext):
            parse_frontmatter('apiStyles: ["rest", "graphql"]\n')

    def test_anchors_are_rejected(self):
        with self.assertRaises(MalformedContext):
            parse_frontmatter("base: &anchor\n")

    def test_tab_indentation_is_rejected(self):
        with self.assertRaises(MalformedContext):
            parse_frontmatter("repository:\n\troot: \".\"\n")

    def test_a_line_that_is_neither_key_nor_item_is_rejected(self):
        with self.assertRaises(MalformedContext):
            parse_frontmatter("just some prose\n")

    def test_empty_flow_collections_are_supported(self):
        parsed = parse_frontmatter("a: []\nb: {}\n")
        self.assertEqual(parsed, {"a": [], "b": {}})

    def test_comment_only_and_blank_lines_are_ignored(self):
        parsed = parse_frontmatter("# a comment\n\nkey: 1\n")
        self.assertEqual(parsed, {"key": 1})

    def test_a_hash_inside_a_quoted_value_is_not_a_comment(self):
        parsed = parse_frontmatter('specGlob: "e2e/**/*#tag.spec.ts"\n')
        self.assertEqual(parsed["specGlob"], "e2e/**/*#tag.spec.ts")

    def test_sequence_at_the_key_indent_then_a_following_key(self):
        parsed = parse_frontmatter("packages:\n- a\n- b\nnext: 1\n")
        self.assertEqual(parsed, {"packages": ["a", "b"], "next": 1})

    def test_a_key_with_no_value_and_no_block_is_null(self):
        parsed = parse_frontmatter("buildTool:\nconfidence: \"high\"\n")
        self.assertEqual(parsed, {"buildTool": None, "confidence": "high"})

    def test_unreadable_file_raises_malformed_context(self):
        with self.assertRaises(MalformedContext):
            parse_file(FIXTURES / "does-not-exist.md")

    def test_a_mapping_key_sharing_indent_with_a_sequence_entry_is_rejected(self):
        """YAML rejects this document; the parser used to reinterpret it.

            list:
              - one
              key: inside a sequence

        PyYAML: "expected <block end>, but found '?'". This parser closed the
        sequence and put `key` in the ROOT mapping — two levels out from where it
        was written — yielding {"list": ["one"], "key": "..."} from a file no
        generator could have meant. A silent reinterpretation of an invalid file is
        the failure mode this module exists to avoid.
        """
        with self.assertRaises(MalformedContext) as caught:
            parse_frontmatter("list:\n  - one\n  key: inside a sequence\n")
        self.assertIn("matches no open block", str(caught.exception))

    def test_a_line_indented_past_every_open_block_is_rejected(self):
        with self.assertRaises(MalformedContext):
            parse_frontmatter("a: 1\n    b: 2\n")

    def test_legitimate_dedent_back_to_an_outer_block_still_parses(self):
        # The invariant must not reject the ordinary shape it sits next to.
        parsed = parse_frontmatter(
            "language:\n  primary: \"ts\"\n  others:\n    - \"js\"\nruntime:\n  node: \"20.x\"\n"
        )
        self.assertEqual(
            parsed,
            {"language": {"primary": "ts", "others": ["js"]}, "runtime": {"node": "20.x"}},
        )


if __name__ == "__main__":
    unittest.main()
