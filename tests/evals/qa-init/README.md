# Eval cases: qa-init

Cases that verify [qa-init](../../../skills/qa-init/README.md) detects a stack correctly and writes a conformant `.qa/context.md`. Each case pairs a fixture repository (in [fixtures/](../fixtures/README.md)) with the profile it should produce (in [expected/](../expected/README.md)).

> **Status:** deterministic golden + adversarial cases are implemented as `*.case.json` in this directory and gate CI. The table below is the fuller matrix; the fixture-driven rows await the live-agent runner.

## Planned cases

| Case | Fixture | Deterministic assertion |
| --- | --- | --- |
| Playwright + TypeScript | single-package Playwright/pnpm repo | `testFramework.e2e: playwright`, `packageManager: pnpm`, `language.primary: typescript` |
| Selenium + Java (Maven) | Maven repo with the Selenium dependency | `language.primary: java`, `testFramework.e2e: selenium`, `packageManager: maven` |
| Cypress + Cucumber | Cypress repo with `.feature` files | `testFramework.e2e: cypress`, `testFramework.bdd: cucumber` |
| Monorepo | workspace with two packaged apps | `repository.monorepo: true`; each package profiled |
| Sparse repo | minimal repo, few signals | Undetectable fields are `null`; `confidence: low`; gaps named |

## What is checked

- **Frontmatter accuracy:** each asserted field matches the fixture's real stack.
- **Honest gaps:** undetectable facts are `null` and appear in `## Assumptions and gaps` — a fabricated detection fails the case.
- **Contract conformance:** the output matches the [context contract](../../../docs/architecture/context-contract.md) structure.
- **Human-notes preservation:** a case with a pre-existing `## Human notes` section asserts it survives regeneration.

Rubric (advisory): is the `## Summary` an accurate, useful description of the project in QA terms?
