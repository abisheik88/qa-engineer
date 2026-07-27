# Test Data

How to produce and manage the data a test needs so it is valid, isolated, and self-cleaning. Consumed by generation and flaky analysis.

## Best practices

- **Best practice:** create data through factories or builders that produce valid entities with sensible defaults and per-test uniqueness, rather than hardcoded fixtures shared across tests.
- **Best practice:** set up data by the fastest reliable path — API or direct seeding for preconditions, UI only when the UI flow is what is under test.
- **Best practice:** each test owns its data and cleans up (or uses ephemeral data), so tests do not collide when run in parallel.
- **Recommendation:** make data unique per run (a suffix from a counter or timestamp) to avoid uniqueness-constraint collisions.

## Common failures

- Two tests using the same fixed record, colliding under parallelism.
- A uniqueness constraint violated because data was not made unique per run.
- Stale data from a previous run changing behavior — missing cleanup.

## Detection signals

- Duplicate-key or constraint-violation errors — a `test-data` classification.
- Tests that fail only under parallel execution — shared-data collision.
- Hardcoded shared identifiers reused across tests.

## Repair guidance

- Replace shared fixed data with a factory that yields unique valid entities.
- Add cleanup or switch to ephemeral data; set up preconditions via API rather than UI.
- **Anti-pattern to avoid during repair:** deleting the assertion that caught a data problem instead of fixing the data.

## Framework notes

- **Playwright:** create data via the `request` API context in fixtures before driving the UI; no data library needed for simple factories.
- **Selenium:** data setup through the app's API client in the test's language, or a seeding script; the binding's fixtures own cleanup.
- **Cypress:** `cy.request` for API setup, `cy.fixture` for static data, tasks for DB seeding.
- **WebdriverIO:** API setup in hooks; language-native factories.
- **Known limitation (all):** the pack does not manage a database; seeding beyond the app's API is project-specific and documented, not automated.

## Anti-patterns

- **Anti-pattern:** a shared "golden" record every test mutates — order dependence and parallel collisions.
- **Anti-pattern:** heavyweight data libraries pulled in for a handful of fields — a small factory is enough.

## Future extension

Contract-driven data generation from schemas, and email/OTP data flows for signup and 2FA, would extend this domain.
