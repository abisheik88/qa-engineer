# Example: an accessibility audit

## Request

```text
/qa-audit run an accessibility audit of the checkout page
```

## Context

An axe-core scan of the checkout page is available, reporting: two form inputs without labels (serious), insufficient contrast on the secondary button (moderate), and the "Pay" button with no accessible name (serious). The keyboard-focus order has not been checked automatically.

## Expected behavior

1. Scope: accessibility, checkout page.
2. Consume the axe results as evidence; map each violation to WCAG and to a fix, ranked by impact.
3. Apply the domain's honesty rule: automated checks are a floor — flag that focus order and screen-reader comprehensibility need a manual check.
4. Report issues with severity, evidence, and remediation; recommend only.

## Expected output

`qa-artifacts/qa-audit-7g8h.json`:

```json
{
  "contract": { "name": "qa-audit/audit-result", "version": "1.0.0" },
  "skill": { "name": "qa-audit", "version": "0.1.0" },
  "generatedAt": "2026-07-19T12:00:00Z",
  "summary": "Accessibility audit of the checkout page: 3 automated violations (2 serious, 1 moderate). Automated checks are a floor — keyboard focus order and screen-reader comprehensibility still need a manual check.",
  "classification": "issues-found",
  "auditType": ["accessibility"],
  "evidence": [
    { "type": "report", "description": "axe-core scan results", "source": "axe-checkout.json", "excerpt": "2 serious, 1 moderate violations" }
  ],
  "issues": [
    { "category": "accessibility", "severity": "serious", "detail": "Two form inputs have no associated label.", "evidence": "axe rule: label", "remediation": "Associate a visible or aria label with each input.", "manualCheckNeeded": false },
    { "category": "accessibility", "severity": "serious", "detail": "The Pay button has no accessible name.", "evidence": "axe rule: button-name", "remediation": "Give the button text or an aria-label.", "manualCheckNeeded": false },
    { "category": "accessibility", "severity": "moderate", "detail": "Secondary button contrast is below AA.", "evidence": "axe rule: color-contrast", "remediation": "Raise the contrast ratio to at least 4.5:1.", "manualCheckNeeded": false }
  ],
  "recommendations": [
    { "action": "Fix the two serious violations (labels, button name) first.", "priority": "high" },
    { "action": "Manually verify keyboard focus order and screen-reader flow — not covered by the automated scan.", "priority": "medium" }
  ],
  "metadata": {}
}
```
