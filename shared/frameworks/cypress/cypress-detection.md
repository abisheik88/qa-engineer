# Cypress: Detection

How a Cypress project is recognized. The fact is recorded in `.qa/context.md` by qa-init; this documents the signals and selection.

## Signals

| Signal | Evidence |
| --- | --- |
| Config | `cypress.config.{ts,js,mjs}` at the project root |
| Dependency | `cypress` in `package.json` |
| Layout | a `cypress/` directory with `e2e/` and/or `component/` subfolders |

The dependency and config are authoritative; a `cypress/` folder alone is corroborating, not decisive.

## Selection and conflict

Selection follows the shared rules (execution framework-detection, generation framework-selection): explicit intent, then the recorded framework, then monorepo scope, then a single clarifying question. A project running both Cypress (component) and Playwright (e2e) is a conflict resolved by scope or intent, never guessed.

## Component vs e2e

Cypress runs both end-to-end and component tests, configured separately in `cypress.config`. Detection records which are present, because they have different runners and artifact locations (see cypress-conventions).

## Status

Cypress is a **planned** framework for live execution and generation: detected and adapter-complete, with analysis reused from the shared JUnit parser. Live execution/generation is gated by the skills' current guardrails, whose flip needs no adapter change.
