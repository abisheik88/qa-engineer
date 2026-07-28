# Getting started — a runnable walkthrough

A tiny, hermetic Playwright app you can actually run, paired with the exact
QA Engineer Pack commands that support it end to end: **support → install →
generate → run → debug → report**. Every command below is real, and the
expected outputs are shown (and, where the pack emits a contract, validated
against that contract).

> **How the pack runs.** The `/qa-*` commands are Agent Skills — you type them to
> an AI coding agent (Claude Code, Codex, Cursor, …) that has the pack installed.
> The agent does the QA reasoning and writes machine-readable artifacts. The
> Playwright test run itself (`npx playwright test`) is ordinary tooling you can
> run by hand — which is what makes this example verifiable rather than narrated.

## What is in this folder

| Path | What it is |
| --- | --- |
| `app/index.html` | The system under test: a sign-in form and dashboard, no backend |
| `server.mjs` | A zero-dependency static server (Playwright starts it automatically) |
| `tests/login.spec.ts` | The suite `/qa-generate` produces — testid locators, web-first assertions |
| `playwright.config.ts` | Minimal config: JSON reporter, trace on first retry, local `webServer` |
| `qa-context.example.md` | What `/qa-init` writes to `.qa/context.md` for this project |
| `expected-outputs/execution-result.json` | The `/qa-run` result contract for the passing smoke run |

## Prerequisites

- **Node.js 18+** — to run the app and Playwright.
- **Python 3.8+** — only if you want to run the pack's analyzers locally (standard library only, nothing to install).
- An **AI coding agent with the pack installed** — for the `/qa-*` steps. The Playwright steps work without one.

## Framework support, honestly

This example uses **Playwright**, which is the pack's only **Production** framework
— it executes and generates live. Selenium, Cypress, and WebdriverIO are **Beta**
(adapter-complete, but live execution and generation are gated). See the
[capability matrix](../../docs/capability-matrix.md) for the full picture, so this
walkthrough never implies more than the pack delivers.

## 1. Support and install

Install the pack's skills into this project so your agent can discover them. From
the repository root:

```bash
npm run qa -- --yes --project examples/getting-started
```

This copies the skills into the agent discovery paths and writes a
`qa-lock.json` with a hash per file. Verify at any time:

```bash
npm run qa -- verify --project examples/getting-started
npm run qa -- doctor --project examples/getting-started
npm run qa -- self-test --project examples/getting-started
```

`doctor` prints a JSON report of detected agents, Python availability, and
install targets. (The lockfile and copied skills are git-ignored here — they are
consumer-side artifacts.)

## 2. Understand the project

```text
/qa-init
```

The agent scans the repo and writes `.qa/context.md`. For this project it detects
Playwright + TypeScript with high confidence — see
[`qa-context.example.md`](qa-context.example.md) for the exact profile it
produces.

## 3. Generate

```text
/qa-generate a smoke test for the sign-in form at http://localhost:3000
```

Because the context says Playwright, `/qa-generate` produces a Playwright + TS
spec with `data-testid` locators and web-first assertions — no hard waits, one
behavior per test. The result is [`tests/login.spec.ts`](tests/login.spec.ts),
already committed here so you can run it immediately.

## 4. Run

Install dependencies and the Chromium browser, then run the smoke suite:

```bash
cd examples/getting-started
npm install
npx playwright install chromium
npx playwright test --grep @smoke
```

Playwright starts `server.mjs`, runs the two tests against
`http://localhost:3000`, and writes `test-results/results.json`.

Through your agent, the same run is `/qa-run smoke`, which normalizes the reporter
into the execution-result contract. The expected passing result is
[`expected-outputs/execution-result.json`](expected-outputs/execution-result.json)
— it conforms to
[`qa-run/execution-result`](../../skills/qa-run/contracts/execution-result.schema.json)
(you can check it with the pack's validator):

```text
classification: passed
tests: { total: 2, passed: 2, failed: 0, skipped: 0 }
exitCode: 0
```

## 5. Debug (introduce a failure)

To see triage, break the app: in `app/index.html`, change the welcome text from
`Welcome back` to `Welcome`. Re-run `npx playwright test` — the first test now
fails on the `toHaveText` assertion.

```text
/qa-debug the login smoke test failed
```

`/qa-debug` reads the run artifacts and produces an evidence-backed
classification (here: `test-bug` — the assertion expects text the app no longer
renders — versus `product-bug` if the app were genuinely wrong), with a timeline
and a ranked recommendation. It proposes **no** code changes. See the worked
diagnoses in [`skills/qa-debug/examples/`](../../skills/qa-debug/examples/).

## 6. Fix and report

```text
/qa-fix
/qa-report
```

`/qa-fix` turns the diagnosis into a **repair plan** — the exact change, affected
files, risk, and a diff-guard review — without editing code itself (see
[`skills/qa-fix/examples/repair-plan.md`](../../skills/qa-fix/examples/repair-plan.md)).
`/qa-report` aggregates the run and diagnosis into a release-readiness verdict
(see [`skills/qa-report/examples/release-report.md`](../../skills/qa-report/examples/release-report.md)).

## Cleaning up

```bash
rm -rf node_modules test-results playwright-report
```

Everything the run generates (`node_modules/`, `test-results/`,
`playwright-report/`, `.qa/`, `qa-artifacts/`, `qa-lock.json`) is git-ignored, so
the example stays pristine in version control.
