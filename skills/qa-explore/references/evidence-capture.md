# Evidence capture

Proof discipline for `/qa-explore`. Every finding needs at least one evidence item.

## File layout

```text
qa-artifacts/explore-<run-id>/
├── screenshots/
│   ├── EXP-1-filter-ignored.png
│   └── EXP-2-login-error.png
├── network/          # optional redacted HAR or JSON excerpts
├── explore-report.md
├── explore-report.html
└── explore-result.json
```

Name screenshots with the finding id when tied to a finding.

## Capture sequence (mandatory)

1. **Act** — perform the interaction.
2. **DOM-verify** — assert the expected state via evaluate / snapshot (visibility, text, attribute, request fired).
3. **Screenshot** — native browser screenshot to `screenshots/`.
4. **Verify the image** — open/read the PNG when the agent can; discard wrong-element captures and retry once.

Never report a UI bug from a screenshot alone without a DOM or network corroboration, unless the bug *is* visual and you state that limitation.

## Highlights

When calling out a control:

- Prefer a native screenshot of the viewport that includes the control.
- Optional: temporary red overlay (`border: 3px solid #E24B4A` on a relative ancestor). Remove overlays after capture.
- In-page html2canvas-style capture is a **fallback** only (WebGL often blanks); disclose when used.

## Evidence types

| Type | Use when |
| --- | --- |
| screenshot | Visible UI defect, layout, missing control |
| network | Failed/duplicate/missing-param/over-fetch API |
| console | Client exceptions, noisy retry storms |
| dom | State proof (text content, disabled, focus) |
| har | Session-level network archive (redacted) |
| db | Optional ground-truth query result (redacted) |

## Redaction

Strip tokens, cookies, passwords, session ids, and personal data from excerpts before writing files. Prefer shapes (`Authorization: Bearer ***`) over values.

## Minimum bar

A finding without a concrete `source` path or verifiable excerpt is incomplete — either gather proof or demote to an assumption / could-not-reproduce note, not a confirmed bug.
