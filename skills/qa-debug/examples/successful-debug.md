# Example: a clean diagnosis that points at the product

The ideal outcome — a confident, evidence-backed root cause. Here the evidence points at the application, so the recommendation is to file a bug and leave the test alone.

## Request

```text
/qa-debug the checkout spec failed in the last run
```

## Context

The execution result shows `checkout > completes a purchase` failed. The analysis result classified it `application-bug` (confidence 0.9), citing a HAR entry with `POST /api/pay → 500` and a console `TypeError`. A trace was collected.

## Expected behavior

1. Gather the execution and analysis results and the trace.
2. Run the engine: the analysis classification (`application-bug`) is trusted; the timeline is reconstructed from the trace and network evidence; priority is P1 (high severity, high business impact, release-blocking).
3. Verify: the 500 and the console error directly support a product fault, meeting the high bar for `application-bug`.
4. Report and recommend filing a bug — explicitly **not** `/qa-fix`, because the test correctly caught a real defect.

## Expected output

`qa-artifacts/qa-debug-8a1c.json`:

```json
{
  "contract": { "name": "qa-debug/debug-result", "version": "1.0.0" },
  "skill": { "name": "qa-debug", "version": "0.1.0" },
  "generatedAt": "2026-07-19T09:10:00Z",
  "summary": "The checkout purchase test failed because POST /api/pay returned 500 and the UI threw a TypeError. This is a product defect, not a test problem — file a bug; do not modify the test.",
  "classification": "application-bug",
  "confidence": 0.9,
  "evidence": [
    { "type": "network", "description": "Payment request failed server-side", "source": "session.har", "excerpt": "POST /api/pay -> 500" },
    { "type": "console", "description": "UI error after the failed request", "source": "trace.zip", "excerpt": "TypeError: Cannot read properties of null" }
  ],
  "rootCause": {
    "classification": "application-bug",
    "confidence": 0.9,
    "reason": "A server-side 500 on the payment request preceded the UI failure; the test correctly caught a real defect.",
    "ownership": "product",
    "recommendation": "File a bug against the product; do NOT modify the test to pass."
  },
  "priority": {
    "severity": "high", "priority": "P1",
    "businessImpact": "high", "technicalImpact": "high", "testingImpact": "low",
    "confidence": 0.9, "owner": "product", "estimatedEffort": "external"
  },
  "timeline": [
    { "order": 0, "phase": "execution-start", "detail": "Run started", "source": "execution-result", "timestamp": "2026-07-19T09:00:00Z" },
    { "order": 1, "phase": "response", "detail": "POST /api/pay returned 500", "source": "session.har" },
    { "order": 2, "phase": "console-error", "detail": "TypeError in the UI", "source": "trace.zip" },
    { "order": 3, "phase": "failure", "detail": "Test failed: completes a purchase", "source": "e2e/checkout.spec.ts" },
    { "order": 4, "phase": "execution-finish", "detail": "Run finished", "source": "execution-result", "timestamp": "2026-07-19T09:00:30Z" }
  ],
  "recommendations": [
    { "action": "File a product bug for the 500 on POST /api/pay; do not change the test.", "priority": "P1", "owner": "product" }
  ],
  "metadata": {}
}
```
