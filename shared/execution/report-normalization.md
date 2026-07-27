# Report Normalization

How a framework's raw run output becomes the pack's normalized execution result — the framework-independent record every later skill reads. Normalization is where "Playwright ran and here is its JSON" becomes "a run happened, here is its status, its counts, its per-test outcomes, and its artifacts", in a shape that does not mention Playwright.

## The principle

Normalize from the machine-readable reporter, never from human output. The command builder always adds a machine-readable reporter for exactly this reason: counts and outcomes come from structured data, not from scraping console text. Reading a structured reporter is deterministic; inferring results from prose is a guess, and guessing about whether tests passed is the one thing this pack must never do.

Where a fully deterministic normalizer script does not yet exist, the agent performs the mapping by reading the reporter's structured output directly — not by interpreting human logs. A bundled normalizer that does this without an agent in the loop is a candidate hardening for a later milestone; the mapping it would implement is specified here.

## The mapping

Each framework adapter states where its reporter output lands and how its fields map to the normalized result. Every adapter maps to the same target fields:

| Normalized field | Sourced from the reporter |
| --- | --- |
| `classification` (status) | Overall outcome — see the status rules below |
| `tests.total/passed/failed/skipped/flaky` | The reporter's per-test outcomes, counted |
| `executed[]` | Each test's title, file, status, duration, and retry count |
| `execution.durationMs` | The reporter's run duration |
| `execution.exitCode` | The runner's process exit code |
| `artifacts[]` | The artifacts the collector located, in the common model |
| `evidence[]` | The reporter file and key observations that justify the status |

## Status rules

The status is computed from the outcome, not chosen by feel:

| Status | Condition |
| --- | --- |
| `passed` | The run completed and every executed test passed |
| `failed` | The run completed and at least one test failed |
| `errored` | The run could not complete: config error, launch failure, or timeout |
| `no-tests-run` | The selection matched no tests |
| `blocked` | The run was not attempted: unsupported framework, missing context, or a strategy dependency absent |

`flaky` is a per-test outcome (passed only on retry), not a run status; a run with flaky tests that ultimately passed is `passed`, with the flaky count recorded and surfaced.

## Rules

- **Exit code and reporter must agree, or say so.** If the process exit code and the reporter disagree (a crash after tests reported), the result is `errored` and the discrepancy is the evidence — never resolved by preferring the convenient one.
- **No reporter, no counts.** If the machine-readable reporter is missing or unreadable, the status is `errored`; the run's counts are not reconstructed from human output.
- **Every status carries evidence.** The result names the reporter file and the observations behind the status, satisfying the pack's evidence discipline.
- **Framework name is provenance, not logic.** The normalized result records which framework ran, but nothing downstream branches on it; that is the whole point of normalizing.

## Extension

A new framework adds only its own reporter location and field mapping. The target shape, the status rules, and the evidence requirement are fixed here and shared by every framework, so the normalized result means the same thing no matter what produced it — the commitment the pack's architecture decision on the normalized result makes.
