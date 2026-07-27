<!-- synced-from: shared/domains/graphql.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# GraphQL API Testing

How to test GraphQL APIs, where the transport is uniform (usually 200 POST) but the semantics live in the body. Recommendations only.

## Best practices

- **Best practice:** assert on the `data` and `errors` fields, never on the HTTP status alone — GraphQL commonly returns 200 with a populated `errors` array, so a status-only check passes a failed query.
- **Best practice:** test the error shape explicitly (a resolver error, a validation error) and assert partial-data semantics where the schema allows partial results.
- **Recommendation:** validate responses against the schema (introspection or a checked-in SDL) to catch drift; assert only the fields the test cares about to avoid brittleness.
- **Recommendation:** watch for N+1 and over-fetching in tests that exercise nested queries, and cover authorization at the field level where the schema enforces it.

## Common failures

- Treating a 200 as success while `errors` is non-empty — the most common GraphQL testing mistake.
- Asserting the entire response object, so any schema addition breaks the test.
- Missing coverage of resolver errors and field-level authorization.

## Detection signals

- Assertions on HTTP status without inspecting `errors`/`data`.
- Whole-response snapshot assertions on GraphQL payloads.
- No negative cases for resolver or validation errors.

## Repair guidance

- Assert `errors` is absent (or of the expected shape) and that `data` matches the queried fields.
- Narrow assertions to the fields under test.
- **Recommendation only:** the API skill surfaces these; it does not rewrite queries or tests.

## Framework notes

- **Playwright / Cypress:** GraphQL is just a POST; use the request/intercept APIs, asserting the parsed body's `data`/`errors`.
- **Selenium / WebdriverIO:** via the language's HTTP client — **known limitation:** browser drivers add nothing for GraphQL; treat it as API testing alongside the UI suite.
- **Framework requirement (all):** the assertion logic keys on the JSON body, so the shared analysis JUnit/HAR normalization applies unchanged — GraphQL needs no special adapter.

## Anti-patterns

- **Anti-pattern:** `expect(status).toBe(200)` as the GraphQL success check — ignores `errors`.
- **Anti-pattern:** asserting internal resolver implementation rather than the contract the client sees.

## Future extension

Schema-diff-based contract testing and automatic N+1 detection from traced resolver calls would extend this domain.
