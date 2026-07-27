# Report pipeline

How `/qa-explore` turns findings into Markdown, HTML, and JSON.

## Artifact paths

For run id `R`:

- `qa-artifacts/explore-R/explore-report.md`
- `qa-artifacts/explore-R/explore-report.html`
- `qa-artifacts/explore-R/explore-result.json`
- `qa-artifacts/explore-R/screenshots/…`

## Markdown structure

```markdown
# <Feature or URL> QA Report

| Field | Value |
| --- | --- |
| URL | … |
| Date | … |
| Tester | AI-assisted QA (qa-explore) |
| Adapter | … |
| Verdict | N critical, N high, … — <one line> |
| Version | v1.0 |

## Evidence index
| File | Shows | Findings |

## Executive summary
## Findings
### EXP-1 · critical — title
- Repro / Actual / Expected / Fix
- Evidence: ![](screenshots/…)
## Performance
## Security summary
## Database validation  <!-- omit if not in scope -->
## Test case coverage   <!-- omit if none -->
## What works well
## Suggested fix order
## Changelog
```

Keep branding **neutral** — no org-specific colors or hosting assumptions. Local files are the product; optional publish is the user's choice.

## HTML

Produce a self-contained HTML summary:

- Simple readable typography; high-contrast text; no dependency on external CSS CDNs required for core reading.
- Prefer inlining small screenshots as data URIs when practical; otherwise relative links to `screenshots/` beside the HTML file.
- Include the same sections as Markdown.

A short standard-library Python or Node snippet written into the run folder is fine for md→html; do not require DeJoule or labs hosting.

## JSON

Write `explore-result.json` matching `contracts/explore-result.schema.json`. Validate before completion.

## Versioning

- `v1.0` initial report.
- Feedback rounds bump minor (`v1.1`, …): add measurements, evidence, changelog notes; never renumber finding ids.
- Recount severity totals after every add/remove.

## Conversation output

After writing files, reply with: verdict line, top 3–5 findings with ids, paths to MD/HTML/JSON, and offer iteration. Do not paste large base64 images into chat.
