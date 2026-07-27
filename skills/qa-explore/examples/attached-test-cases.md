# Example: attached test cases drive functional loops

## Request

```text
/qa-explore https://staging.example.com/checkout
```

Attached: `checkout-cases.md` with three cases (guest path, invalid card, success path).

## Context

User is already logged out. Cases are Markdown with numbered steps and Expected lines.

## Expected behavior

1. Parse attachments into TC-1…TC-3 checklist.
2. Open checkout URL; execute TC-1…TC-3 before free explore.
3. On TC-2 fail: capture screenshot + DOM proof; link finding `EXP-1`.
4. Continue remaining cases and dimensions; include `testCases` coverage in the contract.

## Expected output

Coverage block inside `explore-result.json`:

```json
{
  "testCases": {
    "total": 3,
    "passed": 2,
    "failed": 1,
    "blocked": 0,
    "skipped": 0,
    "cases": [
      { "id": "TC-1", "title": "Guest can reach payment step", "status": "pass" },
      {
        "id": "TC-2",
        "title": "Invalid card shows inline error",
        "status": "fail",
        "findingId": "EXP-1"
      },
      { "id": "TC-3", "title": "Valid card reaches confirmation", "status": "pass" }
    ]
  },
  "findings": [
    {
      "id": "EXP-1",
      "severity": "high",
      "dimension": "functional",
      "title": "Invalid card submits without inline error",
      "repro": "1. Reach payment. 2. Enter 4000000000000002. 3. Submit.",
      "actual": "Spinner then generic toast; field not marked invalid.",
      "expected": "Inline error on the card field; no charge attempt.",
      "fixDirection": "Map gateway decline to field-level error state.",
      "status": "confirmed",
      "evidence": [
        {
          "type": "screenshot",
          "source": "qa-artifacts/explore-c7/screenshots/EXP-1-invalid-card.png"
        },
        {
          "type": "dom",
          "source": "evaluate:aria-invalid",
          "excerpt": "input[name=card] aria-invalid=false after submit"
        }
      ]
    }
  ]
}
```
