# Finding taxonomy

Severity, dimensions, and stable IDs for `/qa-explore` findings.

## Stable IDs

- Format: `EXP-<n>` starting at 1 for the run (or a product prefix the user requests, e.g. `DASH-1`, kept stable thereafter).
- Never reuse or renumber. Removals leave gaps; note removals in the report changelog.
- User-numbered feedback maps to the same numbers when possible.

## Dimensions

| Dimension | Scope |
| --- | --- |
| functional | Behavior, flows, attached cases |
| api | Live API replay / network classification |
| performance | Timing, payloads, long tasks |
| security | Client-observable security hygiene |
| ui | Visual consistency, layout, design bugs |
| ux | Clarity, feedback, cognitive load, empty states |
| data | UI vs API/DB contradictions (when validated) |

## Severity

| Level | Meaning |
| --- | --- |
| critical | Data-trust failure, security exposure of secrets/PII, or page dead with no recovery |
| high | Broken primary feature, misleading metrics, severe authz smell, multi-MB blocking payload |
| medium | Secondary breakage, filter not propagated, inconsistent states, notable a11y/UX gaps |
| low | Copy, casing, minor spacing, console noise without user impact |

## Finding fields (required)

- `id`, `severity`, `dimension`, `title`
- `repro` — numbered steps
- `actual`, `expected`
- `fixDirection` — concrete recommendation (not "investigate")
- `evidence` — ≥1 item with type + source
- `status` — `confirmed` | `validated-user-report` | `could-not-reproduce` | `partial`

## What works well

List 3–7 solid behaviors. A report that is only negative is less actionable and less trusted.

## Fix order

Rank confirmed findings by severity, then user impact, then effort hint when obvious. Cross-reference ids only.
