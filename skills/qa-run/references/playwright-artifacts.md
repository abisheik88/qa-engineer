<!-- synced-from: shared/frameworks/playwright/playwright-artifacts.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# Playwright: Artifacts

Where Playwright writes what it produces, and how each output maps to the pack's common artifact model (defined by the shared artifact-collector module). Collection locates these in place and describes them in the normalized model; it does not move or rewrite them.

## What Playwright produces and where

| Playwright output | Default location | Normalized `type` |
| --- | --- | --- |
| JSON reporter result | The path set on `--reporter=json` | `junit` is a separate report; the JSON result is captured as an `attachment` and is the normalization source |
| JUnit XML (when configured) | The reporter's configured output path | `junit` |
| HTML report | `playwright-report/` | `html-report` |
| Trace | `test-results/<test>/trace.zip` | `trace` |
| Video | `test-results/<test>/video.webm` | `video` |
| Screenshot | `test-results/<test>/*.png` | `screenshot` |
| Standard output and error | The run's console streams | `stdout`, `stderr` |

Console and network logs captured inside a trace are not separate files; they live within the `trace` artifact and are extracted by the analysis layer of a later milestone, not by execution.

## Mapping rules

- **Type is normalized; location and framework are provenance.** Each artifact is recorded with its normalized `type`, its real `location`, `framework: playwright`, a `timestamp`, `ownership: qa-run`, and a `testRef` when it belongs to a specific test.
- **Test-scoped artifacts carry their test.** Traces, videos, and screenshots under `test-results/` map to the test whose directory they sit in, so an analyzer can tie evidence to an outcome.
- **The evidence plan decides presence.** Whether a trace or video exists depends on the flags the strategy chose (for example, `--trace=on-first-retry` produces a trace only for a retried failure). A planned-but-absent artifact is recorded as expected-but-absent, not dropped.
- **Redact text at the boundary.** `stdout`, `stderr`, and any excerpts are redacted for credentials as they are described, per the artifact-collector rules.

## For the analysis layer

Every artifact above is described in the common model, so the future trace and HAR analyzers read `type: trace` and `location`, not "Playwright's `test-results` layout". That indirection is the point: the analyzers this milestone deliberately does not build will consume these artifacts without knowing Playwright produced them.
