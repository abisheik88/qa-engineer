# WebdriverIO: Artifacts

Where WebdriverIO writes what it produces, and how each maps to the pack's common artifact model.

## What WebdriverIO produces and where

| WebdriverIO output | Conventional location | Normalized `type` |
| --- | --- | --- |
| JUnit XML (`@wdio/junit-reporter`) | the reporter's `outputDir` | `junit` |
| Screenshots | the configured screenshot path (often `./screenshots`) | `screenshot` |
| Driver / session logs | the configured `outputDir` logs | `log` |
| Allure results (if the Allure reporter is used) | `allure-results/` | `attachment` |
| Console output | the run's streams | `stdout`, `stderr` |

WebdriverIO has no Playwright-style trace or native HAR by default; those types are absent for its runs — recorded as not-produced, never fabricated.

## Mapping rules

- **Type is normalized; framework is provenance.** Each artifact records its normalized `type`, real `location`, `framework: webdriverio`, timestamp, and ownership.
- **JUnit is the shared spine.** `lib/webdriverio_analysis.py` points at the JUnit report and calls the shared parser — the Selenium/Cypress pattern.
- **Absence is data.** No trace/HAR is recorded as unavailable, not as an error.

## For the analysis layer

Every artifact is described in the common model, so the analyzers read normalized types, not WebdriverIO's layout — keeping the diagnostic skills framework-blind across all four supported frameworks.
