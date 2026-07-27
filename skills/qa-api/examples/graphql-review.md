# Example: assessing GraphQL test coverage

## Request

```text
/qa-api assess our GraphQL API tests
```

## Context

A GraphQL test suite. Reading it shows tests assert `expect(response.status).toBe(200)` and check `data`, but none assert the `errors` field, and there are no resolver-error or field-authorization cases.

## Expected behavior

1. Scope: GraphQL, from the request and `.qa/context.md`.
2. Assess against the GraphQL knowledge: the suite makes the classic mistake of treating HTTP 200 as success while never checking `errors`; negative and authorization cases are missing.
3. Flag each gap with a severity and a recommendation grounded in the domain.
4. Report; recommend only.

## Expected output

`qa-artifacts/qa-api-5e6f.json`:

```json
{
  "contract": { "name": "qa-api/api-result", "version": "1.0.0" },
  "skill": { "name": "qa-api", "version": "0.1.0" },
  "generatedAt": "2026-07-19T11:40:00Z",
  "summary": "Adequate happy-path GraphQL coverage with a critical gap: tests assert HTTP 200 but never check the errors field, so failed queries pass. Resolver-error and field-authorization cases are missing.",
  "classification": "needs-work",
  "protocol": ["graphql"],
  "evidence": [
    { "type": "file", "description": "Success checked by HTTP status only", "source": "api/search.test.ts", "excerpt": "expect(res.status).toBe(200)" },
    { "type": "file", "description": "No assertion on the errors field", "source": "api/*.test.ts" }
  ],
  "findings": [
    { "area": "error-handling", "severity": "high", "note": "A GraphQL 200 can carry errors; tests never assert errors is absent or of the expected shape.", "recommendation": "Assert the errors field, not just HTTP 200." },
    { "area": "authorization", "severity": "medium", "note": "No field-level authorization cases.", "recommendation": "Add cases for unauthorized field access." },
    { "area": "schema", "severity": "low", "note": "Responses are not validated against the schema.", "recommendation": "Validate responses against the checked-in SDL." }
  ],
  "metadata": {}
}
```
