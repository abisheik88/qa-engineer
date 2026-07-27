# Framework Compatibility Matrix

The detailed, per-capability view of where each automation framework stands. The
**overall support level** for each framework (the last column) is defined
canonically in the [capability matrix](../capability-matrix.md) — this document
is the elaboration, not a second source of truth, and CI
([`check-capability-matrix`](../../scripts/check-capability-matrix.mjs)) fails if
the two disagree. Agent compatibility (which AI agents load the skills) is
separate and lives in [COMPATIBILITY.md](../../COMPATIBILITY.md).

## Two vocabularies, kept distinct

The **overall support level** uses the canonical taxonomy from the
[capability matrix](../capability-matrix.md): **Production**, **Beta**,
**Experimental**, **Planning**.

The **per-capability cells** below describe how far one capability is built for
one framework — a finer-grained view that rolls up into the overall level:

- **Full** — the capability works end to end for this framework today.
- **Adapter-complete** — the adapter implements the capability and its output is
  proven identical to Playwright's (by the cross-framework test); the only thing
  gating *live* use is a skill guardrail whose flip needs no adapter change.
- **Planning** — the adapter documents the approach; no implementation yet.
- **Detect-only** — the framework is recognized but never acted on.
- **—** — not applicable.

## The matrix

| Framework | Detection | Execution | Generation | Artifact mapping | Normalization | Analysis | Diagnostics | Reporting | Support level |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Playwright | Full | Full | Full | Full | Full | Full (trace, report, HAR, JUnit) | Full | Full | **Production** |
| Selenium | Full | Adapter-complete | Adapter-complete | Full | Full (JUnit) | Full (JUnit) | Full | Full | **Beta** |
| Cypress | Full | Adapter-complete | Adapter-complete | Full | Full (JUnit) | Full (JUnit) | Full | Full | **Beta** |
| WebdriverIO | Full | Adapter-complete | Adapter-complete | Full | Full (JUnit) | Full (JUnit) | Full | Full | **Beta** |
| Robot Framework | Planning | — | — | — | — | — | — | — | **Planning** |
| Appium (mobile) | Planning | — | — | — | — | — | — | — | **Planning** |

Selenium, Cypress, and WebdriverIO are **Beta**, not Production: their adapters
are complete and their normalization is proven, but `qa-run` and `qa-generate`
gate *live* execution and generation to Playwright (see the [known gaps](#known-gaps)).
Only Playwright executes and generates live today.

Diagnostics and reporting are "Full" for all four Beta/Production frameworks
because they are framework-agnostic by construction: the
[diagnostic engine](../../shared/diagnostics/README.md) consumes the *normalized*
result and findings, so once a framework normalizes (which all four do), it
debugs and reports identically to Playwright.

## Known gaps

- **Live non-Playwright execution and generation.** Selenium, Cypress, and WebdriverIO are adapter-complete, but `qa-run` and `qa-generate` currently gate live execution/generation to Playwright. Flipping that gate is the sole remaining step and requires no adapter change — the proof that the boundary is permanent (see [ADR-0013](../architecture/ADR-0013-framework-boundary.md)).
- **Deep, framework-native artifacts.** Only Playwright has a rich trace and native HAR; the others normalize through JUnit and their own screenshots/videos/logs. Analysis depth therefore varies: trace forensics is Playwright-only today.
- **API and WebSocket depth on driver frameworks.** Selenium and WebdriverIO have no native API/WebSocket primitives; API testing pairs them with an HTTP client (see the rest/graphql/websocket domains).
- **Robot Framework and Appium** are detect-only/planning; mobile is explicitly deferred.

## Example projects

A **runnable Playwright example** ships today at
[examples/getting-started/](../../examples/getting-started/README.md): a hermetic
app with the full support → install → generate → run → debug → report workflow and
a contract-validated run result. Per-framework demo repositories for Selenium,
Cypress, and WebdriverIO wait on those frameworks moving from Beta to live
execution, and are tracked with the evaluation harness (Milestone 10). Until then,
each skill's `examples/` directory carries worked scenarios (a failed login, a
locator break, a flaky test, a GraphQL review, an accessibility audit) with their
expected contract outputs.

## How this changes

Adding or promoting a framework is an adapter-only change under [ADR-0013](../architecture/ADR-0013-framework-boundary.md); this matrix and the cross-framework tests are updated in the same pull request, so the matrix never overstates support.
