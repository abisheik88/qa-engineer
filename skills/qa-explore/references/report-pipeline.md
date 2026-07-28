# Report pipeline

How `/qa-explore` turns findings into Markdown, HTML, and JSON.

## Artifact paths

For run id `R`:

- `qa-artifacts/explore-R/explore-report.md`
- `qa-artifacts/explore-R/explore-report.html`
- `qa-artifacts/explore-R/explore-result.json`
- `qa-artifacts/explore-R/screenshots/…`

## Order of production

`explore-result.json` is written **first** and validated; the Markdown and HTML are
renderings of it. Producing the prose first and the JSON afterwards is how the two
drift, and the reader gets the weaker one.

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
- Evidence: an image reference to the screenshot stored beside the report, such as screenshots/finding-01.png
## Performance
## Security summary
## Database validation  <!-- omit if not in scope -->
## Test case coverage   <!-- omit if none -->
## What works well
## Suggested fix order
## Changelog
```

Keep branding **neutral** — no org-specific colors or hosting assumptions. Local files are the product; optional publish is the user's choice.

## JSON

Write `explore-result.json` matching `contracts/explore-result.schema.json`. Validate before completion:

```bash
python3 <SKILL_DIR>/scripts/qa_tool.py analysis validate \
  qa-artifacts/explore-R/explore-result.json \
  <SKILL_DIR>/contracts/explore-result.schema.json
```

## HTML

Render it from the validated JSON. Do not write it by hand and do not write a
throwaway md→html script:

```bash
python3 <SKILL_DIR>/scripts/qa_tool.py analysis report-html \
  qa-artifacts/explore-R/explore-result.json \
  --out qa-artifacts/explore-R/explore-report.html
```

The renderer produces one self-contained file — no CDN, no external stylesheet, no
web font — with, for every finding: severity, the defect, **current behaviour**,
**expected behaviour**, reproduction, fix direction, and each evidence entry
(screenshots as `<img>`, everything else as a captioned excerpt). Severity ordering,
the summary counts, the test-case table, data-validation comparisons, fix order, and
the attribution footer come with it.

So the HTML is complete only insofar as the JSON is. A finding whose `expected` says
"should work" renders a card that says "should work". Write the fields for a reader
who has never seen the app:

| Field | Not this | This |
| --- | --- | --- |
| `actual` | "Login fails" | "Two identical `POST /graphql` requests are sent; the second returns 401 and the form clears" |
| `expected` | "Should not fail" | "One request per submit; the button is disabled while in flight" |
| `repro` | "Double-click login" | "1. Open /login  2. Enter valid credentials  3. Double-click **Sign in** within 300 ms  4. Watch the Network panel" |
| `fixDirection` | "Fix the handler" | "Disable the submit button on the first click and re-enable it in the request's finally block" |

Screenshots are referenced as paths relative to the HTML file (`screenshots/finding-01.png`),
so the run folder stays portable as a whole.

For an evidence excerpt that could carry a token or credential, run it through
`qa_tool.py analysis redact` before it goes into the JSON — the renderer escapes
markup, it does not redact secrets.

## Versioning

- `v1.0` initial report.
- Feedback rounds bump minor (`v1.1`, …): add measurements, evidence, changelog notes; never renumber finding ids.
- Recount severity totals after every add/remove.

## Conversation output

After writing files, reply with: verdict line, top 3–5 findings with ids, paths to MD/HTML/JSON, and offer iteration. Do not paste large base64 images into chat.
