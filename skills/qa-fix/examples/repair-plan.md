# Example: a repair plan for a broken locator

Consumes the [locator-break debug result](../../qa-debug/examples/locator-break.md) and produces a plan — described, not applied.

## Request

```text
/qa-fix plan the fix for the cart locator break
```

## Context

The debug result classified the failure `locator-failure`: the redesign renamed the "Cart" button to "Basket", so `getByRole('button', name: 'Cart')` no longer resolves. Affected file: `e2e/cart.spec.ts` (or its page object).

## Expected behavior

1. Consume the debug result; the cause is `locator-failure` — test-side and repairable.
2. The engine's repair planner produces a `locator-update` plan: describe updating the locator to the renamed element; do not write the code.
3. State that any eventual edit is gated by the diff guard (status `not-run` — no diff drafted yet), that permission is required, and how to roll back.
4. Present the plan for approval; change nothing.

## Expected output

`qa-artifacts/qa-fix-6b2e.json`:

```json
{
  "contract": { "name": "qa-fix/fix-result", "version": "1.0.0" },
  "skill": { "name": "qa-fix", "version": "0.1.0" },
  "generatedAt": "2026-07-19T10:00:00Z",
  "summary": "Repair plan for the cart locator break: update the locator for the renamed 'Basket' button. This is a described plan — no code has been changed, and approval is required before any edit.",
  "classification": "repairable",
  "confidence": 0.8,
  "evidence": [
    { "type": "debug-result", "description": "Diagnosis being repaired", "source": "qa-artifacts/qa-debug-5c9d.json", "excerpt": "classification: locator-failure; button renamed 'Cart' to 'Basket'" }
  ],
  "repairPlan": {
    "candidateType": "locator-update",
    "proposedChanges": [
      "Update the cart-button locator to target the renamed element (the accessible name changed from 'Cart' to 'Basket'), keeping the role-based query."
    ],
    "affectedFiles": ["e2e/cart.spec.ts"],
    "risk": "low"
  },
  "permissionRequired": true,
  "rollbackStrategy": "No source is changed without approval; revert the proposed edit to roll back.",
  "diffGuardReview": {
    "status": "not-run",
    "note": "No diff has been drafted; when an edit is drafted, the diff guard will reject any removed assertion, added skip, forced pass, or timeout inflation before the plan is declared safe."
  },
  "recommendations": [
    { "action": "Approve the locator update, then re-run the cart test with /qa-run.", "priority": "high", "command": "/qa-run" }
  ],
  "metadata": {}
}
```
