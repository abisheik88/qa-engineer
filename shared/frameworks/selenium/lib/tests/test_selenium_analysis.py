"""Tests for the Selenium analysis adapter."""

import pathlib
import unittest

import selenium_analysis as se
from qa_analysis import taxonomy

REPO = pathlib.Path(__file__).resolve().parents[5]
SELENIUM_JUNIT = REPO / "shared/analysis/lib/tests/fixtures/selenium-junit.xml"


class SeleniumAdapterTests(unittest.TestCase):
    def test_normalizes_via_shared_parser(self):
        result = se.normalize(str(SELENIUM_JUNIT))
        self.assertEqual(result["tests"], {"total": 2, "passed": 1, "failed": 1, "skipped": 0})
        self.assertEqual(set(result.keys()), {"tests", "executed"})

    def test_classifies_no_such_element_as_locator(self):
        cls, _, _ = se.classify_failure("NoSuchElementException: no such element: Unable to locate element")
        self.assertEqual(cls, taxonomy.LOCATOR)


if __name__ == "__main__":
    unittest.main()
