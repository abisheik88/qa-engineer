# Cypress: Artifacts

Where Cypress writes what it produces, and how each maps to the pack's common artifact model. The mapping lets the framework-agnostic analyzers read Cypress output without knowing it is Cypress.

## What Cypress produces and where

| Cypress output | Conventional location | Normalized `type` |
| --- | --- | --- |
| JUnit XML (with a JUnit reporter) | the reporter's configured path (e.g. `results/*.xml`) | `junit` |
| Videos | `cypress/videos/` | `video` |
| Screenshots (on failure) | `cypress/screenshots/` | `screenshot` |
| Mocha JSON (with a JSON reporter) | the reporter's path | `attachment` (a normalization source) |
| Console output | the run's streams | `stdout`, `stderr` |

Cypress has no Playwright-style trace or a native HAR; those artifact types are simply absent for Cypress runs — recorded as not-produced, never fabricated.

## Mapping rules

- **Type is normalized; framework is provenance.** Each artifact records its normalized `type`, real `location`, `framework: cypress`, timestamp, and ownership.
- **JUnit is the shared spine.** With a JUnit reporter configured, `lib/cypress_analysis.py` points at the report and calls the shared parser — the same path Selenium uses.
- **Absence is data.** No trace/HAR for Cypress is recorded as unavailable, not as an error.

## For the analysis layer

Every artifact is described in the common model, so the analyzers read `type: junit`/`video`/`screenshot`, not "Cypress's `cypress/` layout". That indirection is what keeps the diagnostic skills framework-blind across Cypress, Selenium, and Playwright alike.
