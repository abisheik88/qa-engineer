"""Cross-framework compatibility: Playwright, Selenium, Cypress, and WebdriverIO
all produce identical contracts through the shared analysis core. Only the
adapter (artifact location, classnames, message wording) differs; the parser,
the normalized shape, and the taxonomy are shared.

This is the concrete proof of the multi-framework boundary: the four frameworks'
analysis adapters are thin, and their output is indistinguishable in shape.
"""

import pathlib
import unittest

from qa_analysis import junit, taxonomy

import selenium_analysis
import cypress_analysis
import webdriverio_analysis

FIXTURES = pathlib.Path(__file__).resolve().parent / "fixtures"
FRAMEWORKS = ["playwright", "selenium", "cypress", "wdio"]


class CrossFrameworkTests(unittest.TestCase):
    def test_identical_normalized_shape(self):
        results = {fw: junit.parse_junit(str(FIXTURES / f"{fw}-junit.xml")) for fw in FRAMEWORKS}
        shapes = {fw: set(r.keys()) for fw, r in results.items()}
        # Every framework yields the same top-level and counts shape.
        self.assertEqual(len({frozenset(s) for s in shapes.values()}), 1)
        for r in results.values():
            self.assertEqual(set(r["tests"].keys()), {"total", "passed", "failed", "skipped"})
            self.assertEqual(r["tests"], {"total": 2, "passed": 1, "failed": 1, "skipped": 0})

    def test_same_taxonomy_across_frameworks(self):
        # A locator failure classifies identically regardless of framework wording.
        for fw in FRAMEWORKS:
            r = junit.parse_junit(str(FIXTURES / f"{fw}-junit.xml"))
            msg = next(e["message"] for e in r["executed"] if e["status"] == "failed")
            self.assertEqual(taxonomy.classify(msg)[0], taxonomy.LOCATOR, fw)

    def test_thin_adapters_delegate_to_shared_parser(self):
        # Selenium, Cypress, and WebdriverIO adapters normalize via the shared
        # parser and produce the same shape — proving the adapters are thin.
        adapters = {
            "selenium": selenium_analysis,
            "cypress": cypress_analysis,
            "webdriverio": webdriverio_analysis,
        }
        fixtures = {"selenium": "selenium", "cypress": "cypress", "webdriverio": "wdio"}
        for name, adapter in adapters.items():
            result = adapter.normalize(str(FIXTURES / f"{fixtures[name]}-junit.xml"))
            self.assertEqual(set(result.keys()), {"tests", "executed"})
            self.assertEqual(result["tests"]["failed"], 1)
            self.assertEqual(adapter.FRAMEWORK, name)


if __name__ == "__main__":
    unittest.main()
