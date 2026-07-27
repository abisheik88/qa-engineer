# ADR-0010: The multi-framework foundation, proven by Selenium

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

Since [ADR-0006](ADR-0006-execution-architecture.md), the pack has claimed that frameworks plug in behind adapters and that adding one requires no change to the skills above it. [ADR-0008](ADR-0008-generation-architecture.md) made the same claim for generation, and [ADR-0009](ADR-0009-analysis-platform.md) for analysis. But a boundary is only real once a second implementation crosses it. With one framework (Playwright), "framework-agnostic" was an assertion; the abstractions could have quietly encoded Playwright's assumptions without anyone noticing.

This milestone had to convert the claim into a demonstrated fact, and to do it before diagnostic skills are built on top — because if the boundary leaks, it is far cheaper to discover now than after `qa-debug`, `qa-fix`, and `qa-report` have been written against it.

## Decision

Selenium is implemented as the second framework, and the success criterion is made concrete and testable: **adding Selenium changes only `shared/frameworks/`; `qa-run` and `qa-generate` are byte-for-byte unchanged.**

- **All Selenium specifics live in `shared/frameworks/selenium/.`** Detection, execution planning, generation planning, artifact mapping, conventions, and a thin analysis adapter. No Selenium code or knowledge exists anywhere else.
- **Selenium reuses the shared contracts and core.** Its normalization is the framework-agnostic JUnit parser; its failure classification is the shared taxonomy; its execution and generation follow the shared adapter and template-category contracts. The Selenium analysis adapter is a few lines because the contract and the parsing are shared.
- **The skills do not change.** `qa-run` and `qa-generate` name no framework in their logic; they ask the adapter and follow a framework-agnostic flow. Selenium slots into that flow untouched.
- **A cross-framework test proves identical contracts.** A Playwright JUnit fixture and a Selenium JUnit fixture, run through the shared parser, produce identical normalized shapes and identical taxonomy classifications. Only the artifact location and the classnames differ.
- **Selenium is a foundation, not a full framework yet.** Detection, planning, mapping, and normalization are delivered; live execution and generation flip on in a later milestone. No diagnostic skills are built for any framework this milestone.

Robot Framework and Appium are recorded as planning-only: recognized, never targeted.

## Alternatives considered

- **Keep asserting the boundary without a second framework.** Rejected: an unexercised abstraction is a hypothesis. The whole value of the milestone is converting the multi-framework claim from hope to evidence before skills depend on it.
- **Fully implement Selenium execution and generation now.** Rejected as out of scope and premature: proving the *contracts* hold needs detection, mapping, and normalization, not live browser driving. Flipping execution on is cheap once the foundation is proven, and doing it later keeps this milestone focused on infrastructure.
- **A shared parser with framework-specific result shapes.** Rejected: it would defeat the purpose. The point is that Selenium and Playwright produce the *same* shape, so the diagnostic skills are framework-blind. Different shapes would push per-framework handling up into the skills.

## Consequences

- The multi-framework architecture is proven, not asserted: a second framework crossed every boundary — execution, generation, analysis — and the skills did not move. The zero-change claim is verified by hashing `qa-run` and `qa-generate` before and after.
- Adding the remaining frameworks (Cypress, WebdriverIO) is now a known, bounded task: fill the same adapter modules and template categories, reuse the shared core. Flipping Selenium execution and generation on is likewise bounded.
- The framework directories now carry code (thin analysis adapters), not only knowledge. The test runner and CI account for framework libs alongside the core.
- The boundary is load-bearing and demonstrated; a future change that forces a framework specific into a skill is a regression against this ADR, and the cross-framework test exists to catch it.
