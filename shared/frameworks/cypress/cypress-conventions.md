# Cypress: Conventions

The structural conventions the pack reads to locate, select, and generate Cypress tests.

## Layout

| Concern | Convention |
| --- | --- |
| E2E specs | `cypress/e2e/**/*.cy.{ts,js}` |
| Component specs | `cypress/component/**/*.cy.{ts,js}` |
| Support / commands | `cypress/support/` (`e2e.ts`, `commands.ts`) |
| Fixtures | `cypress/fixtures/` |
| Config | `cypress.config.{ts,js}` at the root |

The authoritative test directory and glob come from `.qa/context.md`, confirmed against the config's `specPattern`.

## Selection surface

- Spec globs via `--spec`.
- Tags via the `@cypress/grep` plugin (`--env grep=@smoke`), where the project uses it.
- The e2e/component distinction selects the runner mode.

Tag-based and smoke strategies rely on the project's grep/tagging convention; when a strategy depends on a convention the project lacks, the platform stops and explains rather than running an empty selection.

## Waiting and assertions

The conventions the pack cares about most for Cypress:

- **Retry-able assertions.** `.should()` retries the query and assertion together — a **framework requirement** to lean on instead of `cy.wait(ms)`.
- **Intercept aliases.** Wait on `cy.intercept` aliases for network, not durations.
- **Custom commands.** Shared behavior lives in `cypress/support/commands`; the pack reads these as the reuse surface (the page-object analogue).

## Boundary

This documents conventions the platform reads and generation follows; deeper "how to write excellent Cypress" guidance belongs with the generation and review skills that need it.
