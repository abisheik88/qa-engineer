# ADR-0013: The framework adapter boundary is permanent

- **Status:** Accepted
- **Date:** 2026-07-19

## Context

Since [ADR-0006](ADR-0006-execution-architecture.md) the pack has claimed that frameworks plug in behind an adapter boundary and that adding one changes only `shared/frameworks/`. [ADR-0010](ADR-0010-multi-framework-foundation.md) demonstrated it with a second framework (Selenium). A boundary demonstrated once could still be a coincidence; a boundary that holds across four independent frameworks, spanning execution, generation, and analysis, is a proven invariant worth committing to permanently — before the pack grows further and the cost of a leak rises.

## Decision

The framework adapter boundary is **permanent and closed**: all framework-specific logic lives in `shared/frameworks/<framework>/`, and no framework name appears in the logic of `qa-run`, `qa-generate`, `qa-debug`, `qa-fix`, `qa-report`, or any shared platform.

- **Four frameworks, one contract.** Playwright, Selenium, Cypress, and WebdriverIO each implement the [execution adapter contract](../../shared/execution/execution-contract.md), the [generation template categories](../../shared/generation/template-selection.md), and the [analysis](../../shared/analysis/README.md) shapes. Their normalization is proven identical by the cross-framework test: the same JUnit parser, the same result shape, the same taxonomy classification, for all four.
- **Adapters are thin.** Selenium, Cypress, and WebdriverIO analysis adapters are a few lines each, because they delegate to the shared parser. Thinness is the evidence that the specifics are genuinely behind the boundary, not leaking through it.
- **Adding or promoting a framework is adapter-only.** New frameworks add a `shared/frameworks/<framework>/` directory (adapter docs plus a thin `lib/`) and their template categories; promoting a framework from planning to live is flipping a skill guardrail, which requires no adapter change. Either way, the skills do not move.
- **This milestone changed no skill.** Completing Cypress and WebdriverIO left `qa-run`, `qa-generate`, `qa-debug`, `qa-fix`, and `qa-report` byte-for-byte unchanged, verified by hashing them before and after.

## Alternatives considered

- **Leave the boundary informal.** Rejected: as the pack grows, an informal boundary erodes — a framework special-case slips into a skill "just this once". Declaring it permanent makes such a slip a reviewable regression against this ADR, caught by the zero-change check and the cross-framework test.
- **Fully implement live execution/generation for all four now.** Rejected as out of scope for a boundary-proving milestone and as risking skill changes. The adapters are complete; live use is a guardrail flip, deliberately deferred so this milestone proves the boundary without touching the frozen skills. That the flip needs no adapter work is itself the proof.
- **A per-framework result shape.** Rejected — it would defeat the boundary. Identical normalized shapes across frameworks are what keep the diagnostic and reporting skills framework-blind; divergent shapes would push framework handling up into the skills.

## Consequences

- The pack supports four frameworks with framework-blind skills; the diagnostic and reporting layers work across all of them because they consume normalized output, not native output.
- The boundary is now a committed invariant: any change that forces a framework specific into a skill or a shared platform is a regression, and the cross-framework test plus the skill zero-change check exist to catch it.
- Remaining framework work is bounded and local: live execution/generation for the three adapter-complete frameworks (a guardrail flip), and new frameworks (Robot, Appium) as new adapter directories.
- Framework directories carry code (thin analysis adapters), not only knowledge; the test runner and CI account for every framework's `lib/`.
