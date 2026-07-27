# Example: a network timeout

Shows honest confidence when the signal is suggestive but not conclusive, and the distinction between a network cause and a bare timeout.

## Request

```text
/qa-debug the dashboard test times out intermittently
```

## Context

`dashboard > loads widgets` failed. The analysis result cites a HAR entry `GET /api/widgets` with status 0 (no response) after 30s, and the test's error "Timeout 30000ms exceeded". The word "intermittently" suggests it does not always fail, but there is only one run's evidence.

## Expected behavior

1. Gather results; the status-0 request is the strongest signal — the call never completed.
2. The engine classifies `network` (a no-response request outranks the generic timeout message), owner "backend-or-infrastructure". Because only one run is available, confidence is moderate and the report says a second run would confirm whether it is intermittent (possible `flaky`).
3. Verify: this is not a locator or assertion problem; the evidence points at the request, not the test.
4. Recommend checking the widgets service; note that repeated runs would distinguish a hard network failure from flakiness.

## Expected output

`qa-artifacts/qa-debug-7e4a.json`:

```json
{
  "contract": { "name": "qa-debug/debug-result", "version": "1.0.0" },
  "skill": { "name": "qa-debug", "version": "0.1.0" },
  "generatedAt": "2026-07-19T09:40:00Z",
  "summary": "The dashboard test timed out because GET /api/widgets never responded (status 0) within 30s — a network/service failure. With one run, whether it is intermittent is unconfirmed; a repeat run would tell.",
  "classification": "network",
  "confidence": 0.7,
  "evidence": [
    { "type": "har", "description": "Widgets request never completed", "source": "session.har", "excerpt": "GET /api/widgets -> status 0 after 30000ms" },
    { "type": "junit", "description": "Test-level timeout", "source": "results.xml", "excerpt": "Timeout 30000ms exceeded" }
  ],
  "rootCause": {
    "classification": "network",
    "confidence": 0.7,
    "reason": "The widgets request returned no response within the timeout, pointing at the service rather than the test.",
    "ownership": "backend-or-infrastructure",
    "recommendation": "Check the upstream service and the request; retry only if the failure is genuinely transient."
  },
  "priority": {
    "severity": "high", "priority": "P1",
    "businessImpact": "high", "technicalImpact": "high", "testingImpact": "medium",
    "confidence": 0.7, "owner": "backend-or-infrastructure", "estimatedEffort": "high"
  },
  "timeline": [
    { "order": 0, "phase": "execution-start", "detail": "Run started", "source": "execution-result" },
    { "order": 1, "phase": "request", "detail": "GET /api/widgets issued", "source": "session.har" },
    { "order": 2, "phase": "failure", "detail": "Test failed: loads widgets (timeout)", "source": "e2e/dashboard.spec.ts" }
  ],
  "recommendations": [
    { "action": "Investigate the widgets service; it returned no response in 30s.", "priority": "P1", "owner": "backend-or-infrastructure" },
    { "action": "Re-run to confirm whether the failure is intermittent (possible flaky) or consistent.", "priority": "P2", "owner": "test-author" }
  ],
  "metadata": {}
}
```
