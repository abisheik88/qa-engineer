# Example: reviewing a large automation suite

## Request

```text
/qa-review assess the health of our e2e suite
```

## Context

A Playwright suite of ~120 tests. Reading it shows: duplicated login through the UI in most specs, several page objects but locators also inline in tests, many `waitForTimeout` calls, and assertions that are mostly `toBeVisible`.

## Expected behavior

1. Survey the suite and read `.qa/context.md` (Playwright).
2. Assess dimensions against the knowledge base: fixtures (repeated UI login — an anti-pattern), duplication (inline locators alongside page objects), waiting (fixed sleeps), assertions (weak presence-only checks).
3. Score each dimension and derive an overall verdict; the pervasive sleeps and weak assertions weigh it down.
4. Recommend specific improvements, each citing a domain, ranked by impact.

## Expected output

`qa-artifacts/qa-review-1a2b.json`:

```json
{
  "contract": { "name": "qa-review/review-result", "version": "1.0.0" },
  "skill": { "name": "qa-review", "version": "0.1.0" },
  "generatedAt": "2026-07-19T11:00:00Z",
  "summary": "Adequate structure undermined by pervasive fixed waits and weak assertions. Score 62/100. The highest-impact fixes are replacing sleeps with web-first waits and strengthening presence-only assertions.",
  "classification": "needs-work",
  "qualityScore": 62,
  "evidence": [
    { "type": "file", "description": "Fixed sleeps throughout", "source": "e2e/checkout.spec.ts", "excerpt": "await page.waitForTimeout(3000)" },
    { "type": "file", "description": "UI login duplicated per spec", "source": "e2e/*.spec.ts" },
    { "type": "file", "description": "Inline locators alongside page objects", "source": "e2e/cart.spec.ts" }
  ],
  "dimensions": [
    { "name": "fixtures", "rating": "needs-work", "note": "Login is driven through the UI in most specs instead of a session fixture.", "domain": "fixtures" },
    { "name": "duplication", "rating": "needs-work", "note": "Locators appear inline in tests despite existing page objects.", "domain": "page-objects" },
    { "name": "assertions", "rating": "poor", "note": "Assertions are mostly visibility checks where values should be asserted.", "domain": "assertion-patterns" },
    { "name": "test-design", "rating": "needs-work", "note": "Fixed waits indicate synchronization by duration, not condition.", "domain": "waiting-strategies" },
    { "name": "architecture", "rating": "adequate", "note": "Page objects exist and the layout is conventional." }
  ],
  "recommendations": [
    { "action": "Replace waitForTimeout calls with web-first waits on the awaited condition.", "priority": "high", "domain": "waiting-strategies" },
    { "action": "Strengthen presence-only assertions to check the values that define correct behavior.", "priority": "high", "domain": "assertion-patterns" },
    { "action": "Introduce a session fixture and remove per-spec UI login.", "priority": "medium", "domain": "fixtures" }
  ],
  "metadata": {}
}
```
