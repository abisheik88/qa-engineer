# Example: a release-readiness report

Aggregates a run with one product bug and one locator break into a verdict. The release-blocking product bug makes the verdict `not-ready`.

## Request

```text
/qa-report summarize the run and tell me if we can ship
```

## Context

The execution result: 12 tests, 10 passed, 2 failed. Two debug results exist — the [product bug](../../qa-debug/examples/successful-debug.md) (`application-bug`, P1) and the [locator break](../../qa-debug/examples/locator-break.md) (`locator-failure`, P2).

## Expected behavior

1. Gather the execution result and both debug results.
2. The engine's summarize step computes totals, the by-classification breakdown, and the verdict: an `application-bug` is release-blocking, so `not-ready`.
3. Write the executive summary (not shippable, one blocker) and the engineering summary (the two findings in priority order).
4. Fill the test, failure, and risk sections; coverage is unavailable (no coverage data), and that is stated.
5. Render Markdown, HTML-ready, and JSON; present the Markdown.

## Expected output

`qa-artifacts/qa-report-2d5f.json`:

```json
{
  "contract": { "name": "qa-report/report-result", "version": "1.0.0" },
  "skill": { "name": "qa-report", "version": "0.1.0" },
  "generatedAt": "2026-07-19T10:30:00Z",
  "summary": "12 tests, 10 passed, 2 failed. Not shippable: a payment product bug (P1) is release-blocking; a cart locator break (P2) is test-side.",
  "classification": "not-ready",
  "evidence": [
    { "type": "execution-result", "description": "Run outcomes", "source": "qa-artifacts/qa-run-result-9c2e.json", "excerpt": "10 passed, 2 failed" },
    { "type": "debug-result", "description": "Payment failure diagnosis", "source": "qa-artifacts/qa-debug-8a1c.json", "excerpt": "application-bug (P1)" },
    { "type": "debug-result", "description": "Cart failure diagnosis", "source": "qa-artifacts/qa-debug-5c9d.json", "excerpt": "locator-failure (P2)" }
  ],
  "summaries": {
    "executive": "The build is not ready to ship. Of 12 tests, 10 passed. One failure is a payment product defect (server 500) that blocks release; the other is a test-side locator break from the redesign and does not block.",
    "engineering": "P1 application-bug: POST /api/pay returns 500 (owner: product) — file a bug. P2 locator-failure: cart button renamed 'Cart'->'Basket' (owner: test-author) — update the locator via /qa-fix."
  },
  "testSummary": { "total": 12, "passed": 10, "failed": 2, "skipped": 0, "flaky": 0 },
  "failureSummary": [
    { "test": "checkout > completes a purchase", "classification": "application-bug", "reason": "POST /api/pay returned 500", "owner": "product", "recommendation": "File a product bug; do not modify the test." },
    { "test": "cart > shows item count", "classification": "locator-failure", "reason": "Cart button renamed to 'Basket'", "owner": "test-author", "recommendation": "Update the locator via /qa-fix." }
  ],
  "coverageSummary": { "available": false, "note": "No coverage data was collected for this run." },
  "riskSummary": [
    { "classification": "application-bug", "impact": "high", "note": "Payment path broken; release-blocking." }
  ],
  "releaseReadiness": {
    "verdict": "not-ready",
    "rationale": "A release-blocking application-bug is present; readiness cannot be granted until it is resolved."
  },
  "recommendations": [
    { "action": "File and fix the payment 500 before release.", "priority": "P1", "owner": "product" },
    { "action": "Update the cart locator.", "priority": "P2", "owner": "test-author", "command": "/qa-fix" }
  ],
  "formats": { "markdown": true, "htmlReady": true, "json": true },
  "trendMetadata": {
    "totals": { "total": 12, "passed": 10, "failed": 2 },
    "byClassification": { "application-bug": 1, "locator-failure": 1 },
    "verdict": "not-ready"
  },
  "metadata": {}
}
```
