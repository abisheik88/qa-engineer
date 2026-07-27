# Example: finding with screenshot proof (severity required)

## Request

```text
/qa-explore https://app.example.com/settings/profile — check mobile layout
```

## Context

Desktop explore already done; user asks for a mobile spot-check at 375px width.

## Expected behavior

1. Resize viewport to 375px; reload settings/profile.
2. DOM-verify overlapping controls or horizontal overflow if present.
3. Capture a native screenshot after verify.
4. File a UI finding with severity and screenshot `source` — never a finding without proof.

## Expected output

Finding fragment:

```json
{
  "id": "EXP-4",
  "severity": "medium",
  "dimension": "ui",
  "title": "Save button clipped under sticky header at 375px",
  "repro": "1. Open Profile at 375px width. 2. Scroll to Save.",
  "actual": "Primary Save control is covered by the sticky header; not clickable.",
  "expected": "Save remains reachable or the header yields space on small viewports.",
  "fixDirection": "Adjust sticky header offset or move actions into the safe area.",
  "status": "confirmed",
  "evidence": [
    {
      "type": "screenshot",
      "source": "qa-artifacts/explore-m375/screenshots/EXP-4-save-clipped.png",
      "excerpt": "375px viewport; Save under header"
    },
    {
      "type": "dom",
      "source": "elementsFromPoint",
      "excerpt": "top element at Save coords is header, not button"
    }
  ]
}
```

A finding that only says "looks broken on mobile" with no `evidence` entry is invalid for this skill.
