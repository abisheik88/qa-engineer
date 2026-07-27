<!-- synced-from: shared/domains/authentication.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# Authentication

How tests establish and reuse an authenticated identity. Consumed by generation and API testing. Authentication is *who you are*; authorization (a separate domain) is *what you may do*.

## Best practices

- **Best practice:** authenticate once and reuse the session across tests via stored state, rather than logging in through the UI per test — faster and far less flaky (see the fixtures domain).
- **Best practice:** obtain the session by the cheapest reliable path — a programmatic login (API request that returns a token or sets cookies) is preferable to driving the login form, except in the tests that specifically verify login.
- **Recommendation:** keep credentials in environment variables referenced by name; never hardcode them, and never commit them.
- **Recommendation:** model distinct roles as distinct sessions/fixtures so a test runs as the right identity.

## Common failures

- Every test logging in through the UI — slow and a shared flake point.
- A 401 mid-test because the token expired and was not refreshed.
- Credentials hardcoded or committed — a security and maintenance failure.

## Detection signals

- A 401 or "invalid credentials"/"not authenticated" — an `authentication` classification.
- A UI login flow repeated across many tests.
- Literal credential values in test code or config.

## Repair guidance

- Introduce a session fixture (programmatic login + stored state); remove per-test UI logins.
- Handle token refresh or re-authentication before expiry in long runs.
- **Repair rule:** fix the test's credentials or setup; never weaken the app's authentication check to pass a test.

## Framework notes

- **Playwright:** `storageState` persists cookies/local storage; a setup project logs in once and every test reuses it — the recommended **framework** pattern.
- **Selenium:** persist and re-inject cookies, or seed a session token; manual but straightforward.
- **Cypress:** `cy.session` caches login across tests — a **framework requirement** to use for auth.
- **WebdriverIO:** cookie/localStorage persistence via the driver.

## Anti-patterns

- **Anti-pattern:** UI login in every test — replace with a session fixture.
- **Anti-pattern:** sharing one long-lived logged-in session that tests mutate — reintroduces coupling; scope sessions per role, isolate mutable state.

## Future extension

MFA/OTP and email-link authentication flows, and multi-tenant session handling, are the natural extensions (they touch the test-data domain).
