# Report pipeline

How `/qa-explore` turns findings into Markdown, HTML, and JSON.

## Artifact paths

For run id `R`:

- `qa-artifacts/explore-R/explore-report.md`
- `qa-artifacts/explore-R/explore-report.html`
- `qa-artifacts/explore-R/explore-result.json`
- `qa-artifacts/explore-R/screenshots/…`

## Write for a reader who has never seen the product

The report is forwarded. A founder, a designer, and the developer who owns one
finding will each open it without the conversation that produced it, and often
without knowing what the feature does. Write for that reader:

- **Name things, do not point at them.** "the Sign in button on /login", not "the
  button". A reader cannot see your screen.
- **No unexplained jargon.** IDOR, CLS, and *soft assertion* need a clause of
  explanation or a plainer word.
- **State the consequence.** A reader who does not know the product cannot infer
  why a duplicate request matters; say that it can trip rate limiting and charge
  twice.

The renderer supplies the standing furniture — what an exploratory QA pass is, what
each dimension means, what the severity labels mean, and what could not be run. You
supply what only this run knows: the `scope` block below, and findings whose
`actual` and `expected` read as complete sentences.

## Scope: what you did, and what you left alone

Fill `scope` on every run. It is what makes the report legible to someone who was
not there, and without it the report opens on a wall of findings.

| Field | What goes in it |
| --- | --- |
| `objective` | One or two sentences: which feature you exercised and what you were trying to establish. Written for someone who does not know the app. |
| `covered` | The concrete things you actually touched — screens, controls, flows, request paths. Not dimension names: the renderer already explains those. |
| `notCovered` | Every boundary of the run, **each with its reason**. A boundary without a reason reads as an omission. |

`notCovered` is the field that protects the reader. A login report that does not say
"signing in successfully was never tested, because a QA run must not enter real
credentials" invites the conclusion that login works. State the boundary:

- what needed access or credentials you did not have, and why you did not ask
- what a local or development environment cannot tell you (security headers, bundle
  size, real latency) and where it must be re-checked
- what would have caused damage to test (rate limits, lockout, destructive actions)
- what was in scope but blocked, naming the case id

Blocked cases and unrun dimensions are added by the renderer from the artifact — do
not repeat them. Write the boundaries only it cannot know.

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
node <SKILL_DIR>/scripts/qa-tool.mjs analysis validate \
  qa-artifacts/explore-R/explore-result.json \
  <SKILL_DIR>/contracts/explore-result.schema.json
```

## HTML

Render it from the validated JSON. Do not write it by hand and do not write a
throwaway md→html script:

```bash
node <SKILL_DIR>/scripts/qa-tool.mjs analysis report-html \
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
`qa-tool.mjs analysis redact` before it goes into the JSON — the renderer escapes
markup, it does not redact secrets.

## Versioning

- `v1.0` initial report.
- Feedback rounds bump minor (`v1.1`, …): add measurements, evidence, changelog notes; never renumber finding ids.
- Recount severity totals after every add/remove.

## Conversation output

After writing files, reply with: verdict line, top 3–5 findings with ids, paths to MD/HTML/JSON, and offer iteration. Do not paste large base64 images into chat.
