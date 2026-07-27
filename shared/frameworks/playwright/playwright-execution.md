# Playwright: Execution

How the Playwright adapter builds the command, launches the run, and normalizes the result. This is the reference implementation of the adapter contract's detect, build, launch, and normalize responsibilities. It is what makes `qa-run` actually execute Playwright — the agent runs these commands through its shell.

## Detect and confirm

Playwright is runnable when `@playwright/test` resolves and a config or the default applies (see the project-discovery module). Confirm the browsers are installed; if a run fails to launch because a browser binary is missing, that is an `errored` result whose evidence names the missing browser and the install command (`playwright install`), never a silent skip.

## Build the command

Start from the package-manager invocation (`pnpm exec playwright test`, `npx playwright test`, or `yarn playwright test`) and add, in order:

| Concern | Playwright flag |
| --- | --- |
| Machine-readable result | `--reporter=json` (alongside any human reporter), written to a known path |
| Scope — tag | `--grep <pattern>` |
| Scope — path or directory | a positional path filter |
| Scope — named files | the file paths as positional arguments |
| Scope — project or browser | `--project=<name>` |
| Display | `--headed` only on explicit request; headless is the default (no flag) |
| Evidence — trace | `--trace=on-first-retry` by default, `on` when the strategy asks |
| Evidence — video / screenshot | `--video` and `--screenshot` at the strategy's level |

The full command is recorded verbatim. Secrets are never interpolated; environment variables are referenced by name and resolved at run time (see the environment-detection module).

## Launch and run

The agent runs the built command through its shell, under the run's wall-clock timeout, following the browser lifecycle: headless by default, bounded test-level retries via `--retries` to observe flakiness, cleanup on every exit path, and honest handling of a hang or crash as `errored` rather than as a test failure.

## Normalize the result

Playwright's JSON reporter is the source of the normalized result — not the console output. Map it against the shared report-normalization target:

| Normalized field | Playwright JSON reporter source |
| --- | --- |
| `tests.total/passed/failed/skipped` | The suite's aggregated outcomes |
| `tests.flaky` | Tests with status `flaky` (passed on retry) |
| `executed[]` | Each spec's title, file, `status`, duration, and retry count |
| `execution.durationMs` | The report's `stats.duration` |
| `execution.exitCode` | The runner process exit code |
| `classification` | The status rules: all passed → `passed`; any failed → `failed`; run could not complete → `errored`; empty selection → `no-tests-run` |

If the JSON report is absent or unparseable, the result is `errored` — Playwright's counts are never reconstructed from human output. If the exit code and the report disagree, the result is `errored` and the discrepancy is the evidence.

## Supported paths this milestone

Local execution, headed and headless, on Chromium, Firefox, and WebKit, with config discovery, project selection, and environment variables. Remote and grid execution, sharding, and containerized browsers are later adapter extensions — the command-build, launch, and normalize shape above does not change when they arrive.
