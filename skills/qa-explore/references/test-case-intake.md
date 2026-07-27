# Test case intake

How `/qa-explore` turns attached or pasted cases into an executable checklist.

## Accepted forms

| Form | How to parse |
| --- | --- |
| Markdown / plain text | Numbered or bulleted steps; `###` case titles |
| CSV | Columns such as id, title, steps, expected |
| Spreadsheet (xlsx text / pasted cells) | Same as CSV once tabular text is available |
| PDF / doc text | Extract headings + numbered steps; note OCR/layout risk |
| Gherkin (`Given/When/Then`) | One scenario = one case |

If the attachment is unreadable, say so and ask for pasteable steps — do not invent cases.

## Checklist shape

Normalize to:

```text
TC-<n>: <title>
  Steps: 1…k
  Expected: <observable outcome>
  Priority: P0|P1|P2 (default P1 if unspecified)
```

Preserve the author's ids when present (`TC-Login-01`); otherwise assign `TC-1…`.

## Execution mapping

1. Order by priority (P0 first), then document order.
2. For each case: navigate as needed → perform steps → DOM-verify expected → mark `pass` | `fail` | `blocked` | `skipped`.
3. On `fail` or `blocked`: create or link a finding with severity from finding-taxonomy; attach screenshot proof.
4. After all cases, free-explore for gaps the cases did not cover.

## Coverage summary

Record in the contract:

- `total`, `passed`, `failed`, `blocked`, `skipped`
- list of case ids with status

Cases that cannot run due to login or environment blockers count as `blocked`, not `fail`.
