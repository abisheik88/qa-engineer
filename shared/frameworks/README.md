# shared/frameworks/

Framework-specific expertise, loaded by skills when the project profile detects the framework — this is why "expert modes" are not commands: the expertise arrives automatically where it applies.

## Canonical registry

**[registry.json](registry.json)** is the single source of truth for framework identity, support level, live execution/generation gates, detection signals, and per-capability cells. Documentation matrices, the installer detector (`packages/installer/lib/detect/frameworks.mjs`), and CI (`scripts/check-framework-registry.mjs`) all derive from it. Do not duplicate framework lists elsewhere.

## Catalog

One subdirectory per framework, so each can hold several focused modules rather than one monolith. Files within a subdirectory carry the framework prefix (`playwright-execution.md`) so their basenames stay unique when the sync engine flattens them into a skill's `references/`.

| Section | Scope | Status |
| --- | --- | --- |
| [playwright/](playwright/README.md) | Execution, generation, and analysis adapters: discovery, execution and normalization, artifacts, conventions, generation, trace/report analyzers | Execution (M4), generation (M5), analysis (M6) |
| [selenium/](selenium/README.md) | Detection, execution/generation planning, artifact mapping, conventions, thin analysis adapter | Adapter complete (Milestone 6) |
| [cypress/](cypress/README.md) | Detection, execution/generation planning, artifact mapping, conventions, thin analysis adapter | Adapter complete (Milestone 8) |
| [webdriverio/](webdriverio/README.md) | Detection, execution/generation planning, artifact mapping, conventions, thin analysis adapter | Adapter complete (Milestone 8) |
| `cucumber/` | Step definition discipline, world/context management, framework bindings — the BDD *runtime*; Gherkin *style* is a domain concern | Planned |

Each framework's modules implement the shared contracts — the [execution adapter contract](../execution/execution-contract.md), the [generation template categories](../generation/template-selection.md), and the [analysis](../analysis/README.md) shapes. Playwright is the reference; Selenium, Cypress, and WebdriverIO each crossed the boundary with zero changes to any skill, proven by the cross-framework test. The boundary is now permanent ([ADR-0013](../../docs/architecture/ADR-0013-framework-boundary.md)). Framework directories carry a `lib/` of thin, framework-specific analysis code that reuses the analysis core; the per-framework support levels are in the [framework matrix](../../docs/compatibility/framework-matrix.md).

## What belongs here

- How a domain rule is applied in this framework ("the locator hierarchy, in Playwright API terms"), cross-referencing the domain module rather than restating it.
- Framework version differences that change agent behavior, stated with the versions they apply to.
- Known traps: APIs that look equivalent but aren't, defaults that cause flakiness.

What does not: comparisons ("X is better than Y") and judgment that holds everywhere — the first is not the pack's job, the second belongs in [domains/](../domains/README.md).

Module format: [templates/knowledge-module-template.md](../../templates/knowledge-module-template.md). Engine rules: [shared/README.md](../README.md).
