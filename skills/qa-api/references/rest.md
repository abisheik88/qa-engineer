<!-- synced-from: shared/domains/rest.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# REST API Testing

How to test REST APIs well — the quality bar the API skill reviews against. Recommendations, not code changes.

## Best practices

- **Best practice:** assert the status code *and* the response shape (schema), not just a 200 — a 200 with a malformed body is a failure the status alone misses.
- **Best practice:** cover the negative and edge cases explicitly — 4xx for bad input, auth failures, not-found, and boundary values — not only the happy path.
- **Recommendation:** validate the response against a schema (OpenAPI/JSON Schema) so contract drift is caught; assert error *shape* for failures, not just that an error occurred.
- **Best practice:** make requests idempotent where the method promises it, and verify idempotency for PUT/DELETE; ensure test setup/teardown does not depend on prior test state.

## Common failures

- Tests that assert only the status code and miss a broken payload.
- Only happy-path coverage; error handling and edge cases untested.
- Flaky API tests from real dependencies on unstable upstreams or shared data.

## Detection signals

- Assertions on `status` with no body/schema assertion.
- A test suite with no negative cases (no 4xx expectations).
- Hardcoded shared records causing collisions (see the test-data domain).

## Repair guidance

- Add schema validation and value assertions alongside the status check.
- Add negative and boundary cases; assert error response shape.
- **Recommendation only:** the API skill proposes these as findings; it does not rewrite the API tests.

## Framework notes

- **Playwright:** the `request` context tests APIs directly and shares auth state with UI tests — strong for mixed UI+API suites.
- **Selenium:** Selenium drives browsers, not APIs; API tests use the language's HTTP client (REST Assured, requests) alongside — a **known limitation** to note when a Selenium project also needs API coverage.
- **Cypress:** `cy.request` for API calls; `cy.intercept` to stub or assert network.
- **WebdriverIO:** pair with an HTTP client; not an API tool itself.

## Anti-patterns

- **Anti-pattern:** status-only assertions — a passing test over a broken response.
- **Anti-pattern:** testing through the UI what a direct API test would cover faster and more reliably.

## Future extension

Contract testing (Pact/OpenAPI drift detection) and pagination/caching/rate-limit coverage would deepen this domain.
