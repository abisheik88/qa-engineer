# Selenium: Artifacts

Where Selenium writes what it produces, and how each output maps to the pack's [common artifact model](../../analysis/artifact-discovery.md). The mapping is what lets the framework-agnostic analyzers read Selenium output without knowing it is Selenium — only the locations differ from Playwright.

## What Selenium produces and where

Locations vary by build tool; discovery globs the conventional paths:

| Selenium output | Conventional location | Normalized `type` |
| --- | --- | --- |
| JUnit XML (Maven surefire) | `target/surefire-reports/*.xml` | `junit` |
| JUnit XML (Gradle) | `build/test-results/test/*.xml` | `junit` |
| JUnit XML (pytest) | the `--junitxml` output path | `junit` |
| Screenshots | project-configured, often `test-output/` or `screenshots/` | `screenshot` |
| Driver / browser logs | project-configured log path | `log` |
| Console output | the run's streams | `stdout`, `stderr` |

Selenium has no trace or HAR equivalent by default, so those artifact types are simply absent for Selenium runs — recorded as not-produced, never fabricated.

## Mapping rules

- **Type is normalized; framework is provenance.** Each artifact is recorded with its normalized `type`, its real `location`, `framework: selenium`, a timestamp, and ownership — the same model Playwright uses.
- **JUnit is the shared spine.** Because Selenium's results are JUnit, the framework-agnostic JUnit analyzer normalizes them directly. The Selenium analysis adapter (`lib/selenium_analysis.py`) does little more than point at the JUnit file and call the shared parser.
- **Absence is data.** A Selenium run produces no trace; the analysis layer records that the artifact type is unavailable for Selenium rather than reporting a missing file as an error.

## For the analysis layer

Every Selenium artifact is described in the common model, so the analyzers read `type: junit` and `location`, not "Selenium's surefire layout". That indirection is exactly what makes the diagnostic skills of a later milestone framework-blind: they will consume Selenium findings identically to Playwright findings, because both arrive in the shared shape.
