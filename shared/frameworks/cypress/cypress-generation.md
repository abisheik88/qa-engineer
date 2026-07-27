# Cypress: Generation Planning

How Cypress fills the shared generation template categories, as a plan. `qa-generate` still generates Playwright only; this documents how Cypress generation would work so it plugs in without changing the skill.

## Template categories, in Cypress

| Category | Cypress realization |
| --- | --- |
| Configuration | `cypress.config.ts`: e2e and/or component setup, base URL, reporters, retries, video |
| Page object | Cypress favors custom commands and app actions over classic POM; both are supported (a **trade-off** — POM for familiarity, commands for Cypress-native ergonomics) |
| Fixture | `cy.session` for auth reuse; `cy.fixture` for static data |
| API helper | `cy.request` for setup and API assertions; `cy.intercept` for stubbing |
| Test data | Factories plus `cy.fixture`; `cy.task` for DB seeding |
| Utility | Custom commands in `cypress/support/commands` |
| Example test | A spec using commands/app actions with retry-able `.should()` assertions |
| Environment | `cypress.env.json` / env vars — names only, never secrets |
| README | How to run and extend the Cypress suite |

## Conventions Cypress generation follows

- **Retry-able assertions.** Generated code uses `.should()` (which retries) rather than fixed `cy.wait(ms)` — the waiting-strategies discipline in Cypress terms.
- **Intercept over sleep.** Wait on `cy.intercept` aliases, not durations.
- **cy.session for auth.** A **framework requirement** to use for login reuse.

## Why no change to qa-generate

The template categories are framework-agnostic; Cypress fills them like Playwright. When generation flips on for Cypress, `qa-generate` runs unchanged — it will find Cypress templates where it finds Playwright templates today.
