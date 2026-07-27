<!-- synced-from: shared/domains/fixtures.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# Fixtures

How to provide setup, shared state, and authenticated sessions to tests without repetition or coupling. Consumed by generation and review.

## Best practices

- **Best practice:** provide dependencies through fixtures, not ad-hoc setup in each test or sprawling `beforeEach` blocks — fixtures compose, declare their dependencies, and scope their teardown.
- **Best practice:** reuse an authenticated session via stored state rather than logging in through the UI in every test; log in once, save the session, and inject it. This is faster and removes a large flake source.
- **Recommendation:** scope a fixture to the narrowest lifetime that is correct (per-test for isolation; per-worker only for genuinely expensive, read-only setup).
- **Best practice:** each test is independent — no ordering dependency, no shared mutable state between tests.

## Common failures

- Repeated UI login in every test — slow, and a single point of flakiness.
- Shared mutable state leaking between tests, so a failure in one corrupts another and order matters.
- Teardown that does not run on failure, leaking resources or data into later tests.

## Detection signals

- A login flow duplicated across many tests instead of an auth fixture.
- Tests that pass in isolation but fail in a suite, or depend on run order — shared-state coupling.
- Global mutable variables set in one test and read in another.

## Repair guidance

- Introduce or reuse an authenticated fixture; remove per-test UI logins.
- Isolate state: give each test its own data and context; make teardown run on every exit path.
- **Repair rule:** reuse the existing fixture; add a new one only for genuinely new shared state — never a parallel auth flow.

## Framework notes

- **Playwright:** `test.extend` fixtures with automatic teardown; `storageState` for session reuse; projects for setup dependencies — a strong **framework** model.
- **Selenium:** setup via the binding's lifecycle (JUnit `@BeforeEach`, pytest fixtures/conftest); session reuse is manual (persist and load cookies).
- **Cypress:** `cy.session` caches and restores sessions across tests — a **framework requirement** to use for auth; fixtures for data.
- **WebdriverIO:** hooks in the config plus helper modules; session reuse is manual.

## Anti-patterns

- **Anti-pattern:** logging in through the UI in every test — turn it into a session fixture.
- **Anti-pattern:** a shared fixture that mutates global state other tests read — reintroduces order dependence.

## Future extension

Multi-role and multi-tenant session fixtures, and OTP/email-based auth flows, would extend this domain (see the authentication domain).
