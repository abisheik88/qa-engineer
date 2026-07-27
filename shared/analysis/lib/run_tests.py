#!/usr/bin/env python3
"""Run the analysis toolkit's unit tests.

Adds the analysis core and each framework's analysis lib to the path, then
discovers and runs every test under the toolkit and the framework adapters.
CI runs: python shared/analysis/lib/run_tests.py
"""

import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]

_LIB_DIRS = [
    ROOT / "shared/analysis/lib",
    ROOT / "shared/diagnostics/lib",
    ROOT / "shared/frameworks/playwright/lib",
    ROOT / "shared/frameworks/selenium/lib",
    ROOT / "shared/frameworks/cypress/lib",
    ROOT / "shared/frameworks/webdriverio/lib",
]
for lib in _LIB_DIRS:
    if lib.exists():
        sys.path.insert(0, str(lib))

_TEST_DIRS = [
    ROOT / "shared/analysis/lib/tests",
    ROOT / "shared/diagnostics/lib/tests",
    ROOT / "shared/frameworks/playwright/lib/tests",
    ROOT / "shared/frameworks/selenium/lib/tests",
]


def build_suite():
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    for directory in _TEST_DIRS:
        if directory.exists():
            suite.addTests(loader.discover(str(directory), top_level_dir=str(directory)))
    return suite


if __name__ == "__main__":
    result = unittest.TextTestRunner(verbosity=2).run(build_suite())
    sys.exit(0 if result.wasSuccessful() else 1)
