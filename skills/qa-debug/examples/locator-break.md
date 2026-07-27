# Example: a broken locator (test-side)

A test-side failure — the one class that legitimately routes to `/qa-fix`. The app is fine; a locator no longer matches after a UI change.

## Request

```text
/qa-debug why did the cart test break after the redesign
```

## Context

`cart > shows item count` failed. The analysis result classified it `locator-failure` (confidence 0.8): the trace shows `waiting for locator getByRole('button', name: 'Cart')` timing out, and a DOM snapshot where the button is now labeled "Basket". No network or console errors.

## Expected behavior

1. Gather results; the decisive signal is the unresolved locator plus the renamed element in the snapshot.
2. The engine classifies `locator-failure`, owner "test-author", severity medium, high testing impact, low business impact → P2.
3. Verify: no server error, no console error — this is test-side, not a product bug.
4. Recommend `/qa-fix` to update the locator; this is the path where a repair is appropriate.

## Expected output

`qa-artifacts/qa-debug-5c9d.json`:

```json
{
  "contract": { "name": "qa-debug/debug-result", "version": "1.0.0" },
  "skill": { "name": "qa-debug", "version": "0.1.0" },
  "generatedAt": "2026-07-19T09:30:00Z",
  "summary": "The cart test failed because its locator for the 'Cart' button no longer matches — the redesign renamed it to 'Basket'. This is test-side; update the locator.",
  "classification": "locator-failure",
  "confidence": 0.8,
  "evidence": [
    { "type": "trace", "description": "Locator never resolved", "source": "trace.zip", "excerpt": "waiting for locator getByRole('button', name: 'Cart')" },
    { "type": "trace", "description": "Element present under a new name", "source": "trace.zip", "excerpt": "button labeled 'Basket' in the DOM snapshot" }
  ],
  "rootCause": {
    "classification": "locator-failure",
    "confidence": 0.8,
    "reason": "The awaited locator did not resolve because the target button was renamed 'Cart' to 'Basket'.",
    "ownership": "test-author",
    "recommendation": "Inspect the current DOM and update the locator to target the same element."
  },
  "priority": {
    "severity": "medium", "priority": "P2",
    "businessImpact": "low", "technicalImpact": "low", "testingImpact": "high",
    "confidence": 0.8, "owner": "test-author", "estimatedEffort": "low"
  },
  "timeline": [
    { "order": 0, "phase": "execution-start", "detail": "Run started", "source": "execution-result" },
    { "order": 1, "phase": "failure", "detail": "Test failed: shows item count", "source": "e2e/cart.spec.ts" }
  ],
  "recommendations": [
    { "action": "Update the cart-button locator to match the renamed element.", "priority": "P2", "owner": "test-author", "command": "/qa-fix" }
  ],
  "metadata": {}
}
```
