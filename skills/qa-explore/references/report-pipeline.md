# Report pipeline

How `/qa-explore` turns findings into a JSON artifact and every rendering of it.

## The one rule

**You produce structured data. The pack produces every document.**

The JSON is written first, validated, and then rendered. HTML, Markdown, SARIF, JUnit,
and CSV are all produced *from* it by the engine. **You never write HTML, CSS, or any
styling** — there is no fallback that allows it.

```text
  explore-result.json  ──validate──►  artifacts verify  ──►  report-html
        (source of truth)              (does the evidence      report-export
                                        actually exist?)        (md/sarif/junit/csv)
```

That is not a style preference. Producing prose first and JSON afterwards is how the
first live run shipped a report whose findings each had `actual`, `expected`, and
`fixDirection` in the artifact and one flattened sentence in the HTML. The renderer
cannot drop a field it is required to render; a person retyping can drop four.

## Why you have no say in how it looks

A qa-engineer report must be the same document whoever produced it — Claude Code,
Cursor, Codex, Gemini, or an agent that does not exist yet. That is only true if no
producer can influence presentation, so the contract gives you no way to: there is no
field for a colour, a class, a font, or a template, and `additionalProperties: false`
means you cannot add one.

Record which agent you are in `metadata.producer` when you use the canonical schema. It
is displayed in the appendix and nothing branches on it.

If `report-html` is unreachable, **stop and say the engine is missing**. Do not
hand-write a substitute — an improvised report is the failure this design removes.

## Which schema to write

| Situation | Contract |
| --- | --- |
| A `/qa-explore` run in this pack | `qa-explore/explore-result` (`contracts/explore-result.schema.json`) |
| Any other producer, or a new integration | `qa-engineer/qa-report` schema 2.0 |

Fetch the canonical schema when you need it:

```bash
node <SKILL_DIR>/scripts/qa-tool.mjs analysis report-schema --out qa-report.schema.json
node <SKILL_DIR>/scripts/qa-tool.mjs analysis report-versions   # schema/theme/renderer
```

Both render through the same code to the same document. The canonical form groups
fields by audience (`metadata`, `summary`, `coverage`, `issues`, `artifacts`,
`performance`, `security`, `recommendations`); the exploratory form is flat. Nothing is
lost either way.

## Artifact paths

For run id `R`, everything lives in one folder so the whole thing moves as a unit:

```text
qa-artifacts/explore-R/
├── explore-result.json     the artifact — written first, validated, source of truth
├── explore-report.html     rendered
├── explore-report.md       rendered
├── screenshots/            proof images
├── network/                request captures
├── console/                console logs
└── dom/                    DOM snapshots
```

## Register every artifact

Write an `artifacts[]` entry for every file the run produces, and point evidence at it
by `artifactId`:

```json
{
  "artifacts": [
    {
      "id": "shot-login-dupe",
      "kind": "screenshot",
      "path": "screenshots/login-duplicate.png",
      "label": "Two auth requests for one submit",
      "capturedAt": "2026-07-29T09:02:11Z"
    }
  ],
  "findings": [
    {
      "id": "EXP-1",
      "evidence": [
        { "type": "screenshot", "artifactId": "shot-login-dupe",
          "caption": "The stored session blob in DevTools" }
      ]
    }
  ]
}
```

Why the indirection is worth it: the path then exists in exactly one place. Two
findings citing the same screenshot cannot disagree about where it is, the renderer
knows its size and type, and a typo produces a *named missing artifact* rather than a
broken image.

### Paths are relative to the result JSON

`screenshots/login-duplicate.png`, not `qa-artifacts/explore-R/screenshots/…` and not
an absolute path. The resolver will still find a project-root-relative path by walking
up from the run folder — but it is a fallback for a mistake, not the contract.

### Before/after pairs

Set `compares` on the *after* image and both render side by side under one caption:

```json
{ "id": "shot-holiday-after", "kind": "screenshot",
  "path": "screenshots/holiday-after.png", "compares": "shot-holiday-before" }
```

## Verify the evidence before rendering

```bash
node <SKILL_DIR>/scripts/qa-tool.mjs artifacts verify \
  qa-artifacts/explore-R/explore-result.json
```

Exit `0` means every file a finding points at is on disk and non-empty. Exit `1` lists
what is missing and why. **Run this before rendering and before declaring the run
complete.** A zero-byte screenshot counts as missing, because a failed capture renders
exactly as badly as an absent one.

If something is genuinely gone, do not delete the evidence entry to make the check
pass. Leave it: the report states the absence, names the file, and gives the reason —
which is honest, and tells whoever re-runs the pass what to fix.

## Write the report for a reader who has never seen the product

The report is forwarded. A founder, a designer, and the developer who owns one finding
will each open it without the conversation that produced it.

- **Name things, do not point at them.** "the Sign in button on /login", not "the
  button". A reader cannot see your screen.
- **No unexplained jargon.** IDOR, CLS, and *soft assertion* need a clause of
  explanation or a plainer word.
- **State the consequence.** Say that a duplicate request can trip rate limiting and
  charge twice — a reader who does not know the product cannot infer it.

The renderer supplies the standing furniture: what an exploratory QA pass is, what each
dimension means, what the severity labels claim, what could not be run, the severity
legend, and the artifact index. You supply what only this run knows.

## The fields that carry the report

| Field | What good looks like |
| --- | --- |
| `actual` | "Two identical `POST /graphql` requests are sent; the second returns 401 and the form clears" — not "Login fails" |
| `expected` | "One request per submit; the button is disabled while in flight" — not "Should not fail" |
| `repro` / `steps` | Numbered, retypable, starting from a URL — not "Double-click login" |
| `fixDirection` | "Disable submit on the first click and re-enable it in the request's finally block" — not "Fix the handler" |
| `businessImpact` | What it costs in money, trust, compliance, or support load. Not a restatement of the defect |
| `rootCause` | Only when the run actually established one. `chain` is the causal steps in order |
| `regressionRisk` | The level, plus what QA should re-run once it is fixed |

`businessImpact` and `rootCause` are what turn "button not working" into something a
manager can prioritise and an engineer can start on. Write them when the run supports
them, and leave them out when it does not — an invented root cause is worse than none.

## Scope: what you did, and what you left alone

| Field | What goes in it |
| --- | --- |
| `objective` | One or two sentences: which feature you exercised, what you were establishing |
| `covered` | The concrete things you touched — screens, controls, flows, request paths |
| `notCovered` | Every boundary of the run, **each with its reason** |

`notCovered` protects the reader. A login report that does not say "signing in
successfully was never tested, because a QA run must not enter real credentials"
invites the conclusion that login works. State:

- what needed access or credentials you did not have, and why you did not ask
- what a development environment cannot tell you (security headers, bundle size, real
  latency) and where it must be re-checked
- what would have caused damage to test (rate limits, lockout, destructive actions)
- what was in scope but blocked, naming the case id

Blocked cases and unrun dimensions are added by the renderer. Write only the boundaries
it cannot know.

## The executive block

Fill `executive` on any run a non-engineer will read. It is the only part a CEO reads.

```json
{
  "executive": {
    "verdict": "do-not-ship",
    "headline": "Two security findings block release; everything else is fixable within a day.",
    "health": "The console is functionally sound. The blockers are exposure, not feature gaps.",
    "risks": ["The session token is in localStorage, readable by any XSS on the origin."],
    "recommendedAction": "Fix the two security findings, then re-run this pass.",
    "estimatedFixHours": { "low": 6, "high": 8 },
    "confidence": 0.86
  }
}
```

`verdict` must agree with the findings. A `ship` verdict over a critical finding is a
contradiction the reader will catch, and it costs the whole report its credibility.
When the run did not establish enough to judge, say `insufficient-data`.

`confidence` is about *this run*, not about the product: how much of what is reported
was reproduced rather than observed once.

## Scores

Only report a score for something the run measured. There is no accessibility score
without an accessibility pass. The renderer derives `overall` from the severity counts
using a published formula and labels it as derived; everything else must be real.

## Rendering

**The bundle is the canonical output.** It is a folder on the user's disk that contains
the entire report and nothing outside it.

```bash
node <SKILL_DIR>/scripts/qa-tool.mjs analysis report-bundle \
  qa-artifacts/explore-R/explore-result.json \
  --out qa-artifacts/explore-R/report --zip
```

```text
qa-artifacts/explore-R/report/
├── index.html          open this in any browser, offline
├── report.json         the artifact it was rendered from
├── report.md           the same content for tickets
├── manifest.json       every file, with its SHA-256
└── assets/
    ├── css/report.css
    ├── js/report.js
    └── screenshots/ videos/ traces/ network/ dom/ console/ logs/
```

Every link is verified to resolve inside the folder *after* it is written; a reference
that escapes fails the command rather than shipping a report with a hole in it. `--zip`
also emits `report.zip` — one file to send a stakeholder.

Point the user at `index.html`. **Never** make a hosted preview the primary output: a
platform URL expires, and a QA report has to still open in six months. If you publish
one as a convenience, say plainly that it is a convenience and that the folder is the
real deliverable.

### Single-file and other formats

```bash
# One HTML file with images inlined — for a lone email attachment
node <SKILL_DIR>/scripts/qa-tool.mjs analysis report-html \
  qa-artifacts/explore-R/explore-result.json --embed \
  --out qa-artifacts/explore-R/explore-report.html

# Markdown on its own
node <SKILL_DIR>/scripts/qa-tool.mjs analysis report-export \
  qa-artifacts/explore-R/explore-result.json \
  --format markdown --out qa-artifacts/explore-R/explore-report.md
```

Add `--embed` to inline every image as a data URI. Use it when the report will be
mailed or uploaded on its own, without the folder beside it. It costs about a third
more bytes than the images.

### Modes

`--mode` selects the audience. All four share one model and one stylesheet, so they
cannot disagree about a number and an embedded report looks identical to a standalone
one.

| Mode | Sections | Use it for |
| --- | --- | --- |
| `full` | everything | the default; the canonical artifact |
| `executive` | overview, summary, coverage, recommendations, appendix | a report going to leadership or a client |
| `developer` | overview, findings, performance, API, security, a11y, console, screenshots, artifacts | the engineer doing the work |
| `artifact` | everything, without `<html>`/`<head>`/`<body>` | embedding in a host page — Claude Artifacts, a wiki, a dashboard |

### Other formats

| Format | For |
| --- | --- |
| `sarif` | GitHub's Security tab, and any code-scanning viewer |
| `junit` | A CI dashboard, beside the unit tests |
| `csv` | The spreadsheet a QA lead already tracks the release in |
| `json` | The artifact itself, re-emitted with sorted keys for a clean diff |
| `bundle` | A manifest of every file a shareable archive must contain, with hashes |

There is no PDF exporter, deliberately: the HTML report has a print stylesheet that
forces every finding open, drops the navigation and the glass, and prints links with
their targets. **Print → Save as PDF** produces a better document than a bundled PDF
library would, with nothing to install.

## Versioning

- `v1.0` initial report.
- Feedback rounds bump minor (`v1.1`, …): add measurements, evidence, changelog notes.
- **Never renumber finding ids.** A ticket already cites `EXP-3`.
- Recount `severityCounts` after every add or remove.

## Redaction

For any excerpt that could carry a token or a credential:

```bash
node <SKILL_DIR>/scripts/qa-tool.mjs analysis redact <file>
```

The renderer escapes markup; it does not redact secrets. Redact before the text enters
the JSON, not after.

## Conversation output

After writing the files, reply with: the verdict line, the top three to five findings
with their ids, the paths to the HTML/MD/JSON, and an offer to iterate. Do not paste
base64 images into chat.
