# QA Automation Pack

> Teach your AI coding assistant to work like a senior QA engineer — and stop it from telling you tests pass when they don't.

[![Version](https://img.shields.io/badge/version-0.9.0-blue.svg)](CHANGELOG.md)
[![Status](https://img.shields.io/badge/status-public%20preview-orange.svg)](docs/release/v0.9-release-checklist.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A518.18-339933.svg)](#step-1--check-your-prerequisites)
[![Python](https://img.shields.io/badge/python-%E2%89%A53.8-3776AB.svg)](#step-1--check-your-prerequisites)
[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-spec--native-6E56CF.svg)](https://agentskills.io)
[![Tests](https://img.shields.io/badge/tests-235%20passing-success.svg)](#how-this-is-verified)

<!-- On publication, add the live workflow badge:
     [![CI](https://github.com/<org>/qa-engineer/actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)
     It is omitted today because an unpublished repository renders it as a broken image. -->

**This page is everything you need.** Install, first run, every command, and what to do when something breaks — no other document required.

---

## Contents

1. [What this is, in plain language](#what-this-is-in-plain-language)
2. [Is this for me?](#is-this-for-me)
3. [Step 1 — Check your prerequisites](#step-1--check-your-prerequisites)
4. [Step 2 — Install it](#step-2--install-it)
5. [Step 3 — Confirm it worked](#step-3--confirm-it-worked)
6. [Step 4 — Your first real task](#step-4--your-first-real-task)
7. [What got installed](#what-got-installed)
8. [All twelve commands](#all-twelve-commands)
9. [Common tasks](#common-tasks)
10. [When something goes wrong](#when-something-goes-wrong)
11. [Updating and uninstalling](#updating-and-uninstalling)
12. [How it works](#how-it-works)
13. [What it does *not* do](#what-it-does-not-do)
14. [How this is verified](#how-this-is-verified)
15. [Going deeper](#going-deeper)
16. [Contributing, support, licence](#contributing)

---

## What this is, in plain language

If you use an **AI coding assistant** — Claude Code, Cursor, GitHub Copilot, Codex CLI, and others — you have probably asked it to write or fix tests. It usually tries. It also, fairly often:

- writes brittle tests that break next week,
- "fixes" a failing test by **deleting the assertion** or adding `skip`,
- and then tells you everything passes.

That last one is the dangerous part. A green test suite that checks nothing is worse than a red one, because you stop looking.

**This project installs twelve QA skills into your project** that your AI assistant reads and follows. Think of it as handing your assistant a senior QA engineer's playbook, plus a set of tools it must actually run — so its answers come from real measurements instead of guesses.

<details>
<summary><b>New to this? Three terms explained</b></summary>

- **AI coding assistant / agent** — a tool where you chat with an AI inside your codebase, and it can read and edit files. Claude Code, Cursor, and GitHub Copilot are examples.
- **Skill** — a Markdown file with instructions your assistant reads when a task matches. It's like a checklist the AI follows. This project installs twelve of them into a folder in your project.
- **Slash command** — how you trigger a skill: you type `/qa-run` in your assistant's chat. If your assistant doesn't support slash commands, plain English works too ("run my tests and report the result").

You do not need to learn a new language, framework, or config file. You install once and then talk to your assistant normally.

</details>

## Is this for me?

**Yes, if:** you have a project with tests (or want some), you use an AI coding assistant, and you would like its QA work to be trustworthy.

**Probably not, if:** you don't use an AI assistant for coding — the skills are instructions *for the assistant*, so without one there is nothing to read them.

**Works best with Playwright** today. Selenium, Cypress, and WebdriverIO are detected and their results are understood, but running and generating tests live is currently Playwright-only. See [framework support](#framework-support).

## Step 1 — Check your prerequisites

You need two things. Run these two commands to check — copy and paste them exactly:

```bash
node --version
python3 --version
```

You want **Node 18.18 or newer** and **Python 3.8 or newer**. If both print a version number that is high enough, skip ahead to [Step 2](#step-2--install-it).

<details>
<summary><b>"command not found" — how to install Node.js</b></summary>

Node.js gives you the `npx` command used to install this pack.

- **macOS** — `brew install node` (needs [Homebrew](https://brew.sh)), or download from [nodejs.org](https://nodejs.org).
- **Windows** — download the LTS installer from [nodejs.org](https://nodejs.org) and run it.
- **Linux** — `sudo apt install nodejs npm` (Debian/Ubuntu), or use [nvm](https://github.com/nvm-sh/nvm).

Then re-run `node --version`. Take the **LTS** version if offered a choice.

</details>

<details>
<summary><b>"command not found" — how to install Python</b></summary>

Python runs the analysis tools that read your test results. It uses only Python's built-in library — there is nothing extra to install, no `pip install` step.

- **macOS** — `brew install python3`, or download from [python.org](https://python.org).
- **Windows** — install from [python.org](https://python.org) and **tick "Add Python to PATH"** during setup. Then use `python --version` if `python3` is not found.
- **Linux** — `sudo apt install python3` (Debian/Ubuntu).

**Can you skip Python?** Yes, but you shouldn't. Without it the skills fall back to the AI reading files by eye, and they will mark their results *degraded* to tell you so. The whole point of this project is that the numbers come from tools, not guesses.

</details>

You also need **an AI coding assistant** open on your project — Claude Code, Cursor, GitHub Copilot, Codex CLI, OpenCode, Gemini CLI, Antigravity, or Kimi.

## Step 2 — Install it

Open a terminal, go to **your own project folder** (the one with your code in it, not this repository), and run:

```bash
npx qa-engineer --yes --project .
```

That's the whole installation. Line by line:

| Part | Meaning |
| --- | --- |
| `npx` | Comes with Node. Downloads and runs a tool without installing it permanently. |
| `qa-engineer` | The name of this package. |
| `--yes` | Don't ask me questions, just use sensible defaults. |
| `--project .` | Install into the current folder (`.` means "here"). |

> **First time you run `npx`,** it may ask `Need to install the following packages … Ok to proceed? (y)`. That is npm asking permission to download the package. Type `y` and press Enter.

You should see something like this:

```text
› project: /Users/you/my-app
› agents: agent-skills
› skills: 13
› ██████████████████ 100%  Configuration complete
✓ installed 335 file(s); lockfile /Users/you/my-app/qa-lock.json
```

<details>
<summary><b>Not published to npm yet — install from a local copy</b></summary>

This is a public preview and the package is not on the npm registry yet, so the command above will not find it. Until it is published, install from a clone:

```bash
git clone <this-repo-url>
cd qa-engineer
npm install
npm run qa -- --yes --project /path/to/your-app
```

Replace `/path/to/your-app` with the full path to your project. Everything else in this README works the same; just use `npm run qa -- <command>` wherever it says `npx qa-engineer <command>`.

</details>

## Step 3 — Confirm it worked

```bash
npx qa-engineer self-test --project .
```

Real output from a healthy install:

```text
✓ [PASS] lockfile: qa-lock.json present (335 files, pack 0.9.0)
✓ [PASS] integrity: all installed files match lockfile hashes
✓ [PASS] skills: 13 skill(s) installed
✓ [PASS] contracts: 12 contract schema(s) present
✓ [PASS] engine: deterministic engine bundled under .agents/skills/qa-init/scripts/lib
✓ [PASS] python-imports: Python imports OK (python3 Python 3.12.3)
✓ [PASS] node: Node v24.18.0
✓ self-test PASSED
```

Every line `[PASS]`? You're done installing. If anything says `[FAIL]`, jump to [When something goes wrong](#when-something-goes-wrong).

## Step 4 — Your first real task

Now switch from the terminal to **your AI assistant**, opened on the same project.

**Type this in the chat:**

```text
/qa-init
```

> If your assistant doesn't recognise slash commands, type this instead:
> *"Analyse this repository and set up the QA context file."*

The assistant will read your `package.json`, your test config, and your folder layout, then write a file called `.qa/context.md` describing your project — which test framework you use, where your tests live, how they run. Every other command reads that file, so this one comes first.

**Then run your tests:**

```text
/qa-run
```

The assistant runs your test suite, and — this is the part that matters — reads the results **with a tool rather than by eye**, then writes a report to `qa-artifacts/execution-result.json`. Here's a real one:

```json
{
  "classification": "passed",
  "summary": "Smoke run on Playwright/Chromium (headless): 2 passed, 0 failed, 0 skipped in 3422ms.",
  "evidence": [
    { "type": "command", "description": "Runner exited zero", "source": "exit code 0" },
    { "type": "report", "description": "Playwright JSON reporter, normalized",
      "source": "test-results/results.json", "excerpt": "{\"expected\": 2, \"unexpected\": 0}" }
  ],
  "tests": { "total": 2, "passed": 2, "failed": 0, "skipped": 0, "flaky": 0 }
}
```

Notice `evidence`. Every claim points at where it came from. And if the assistant tried to write `"passed"` while the test runner had actually failed, **the file would be rejected as invalid** — that rule is built into the format, not just requested politely.

**If something failed:**

```text
/qa-debug
```

You get a diagnosis with a cause, an owner, and a next step:

```json
{
  "classification": "assertion-failure",
  "rootCause": {
    "ownership": "test-author-or-product",
    "recommendation": "Confirm whether the app or the expectation is wrong; fix whichever is genuinely incorrect."
  }
}
```

That's the core loop: **`/qa-init` once, then `/qa-run` and `/qa-debug` whenever you need them.**

## What got installed

Four things appeared in your project:

```text
your-app/
├── .agents/skills/      ← the twelve skills your assistant reads (plus one demo)
│   ├── qa-run/
│   ├── qa-debug/
│   └── …
├── .claude/skills/      ← same files again, only if you use Claude Code
├── qa-lock.json         ← a list of every installed file and its checksum
└── (later) .qa/context.md and qa-artifacts/   ← created when you run the commands
```

**Nothing else was touched.** Your source code, your tests, and your config are untouched by installation. `qa-lock.json` records exactly what was written so `uninstall` can remove precisely that and nothing more.

Worth adding to your `.gitignore` if you don't want the artifacts committed:

```gitignore
qa-artifacts/
.qa/backups/
```

Most teams **do** commit `.agents/skills/` and `qa-lock.json`, so everyone on the team gets the same skills.

## All twelve commands

Type these in your AI assistant's chat, not the terminal.

| Command | What it does | Changes your files? |
| --- | --- | --- |
| `/qa-init` | Looks at your project and writes `.qa/context.md`. **Run this first.** | Writes `.qa/context.md` |
| `/qa-run` | Runs your test suite and reports a verified result | Writes to `qa-artifacts/` |
| `/qa-debug` | Works out *why* a test failed and who should fix it | Writes to `qa-artifacts/` |
| `/qa-fix` | Plans a safe repair for a failure. Explains the change; **you** apply it | No |
| `/qa-generate` | Writes new tests, page objects, and fixtures | **Yes** — new files; existing files only with your permission |
| `/qa-review` | Reviews your test code and suggests improvements | No |
| `/qa-flaky` | Finds tests that pass and fail randomly, and explains why | No |
| `/qa-api` | Checks REST, GraphQL, and WebSocket behaviour | No |
| `/qa-audit` | Audits a page for accessibility, performance, security, visual issues | No |
| `/qa-report` | Rolls everything up into a summary and a "ready to ship?" verdict | Writes to `qa-artifacts/` |
| `/qa-explore` | Explores a live URL in a browser and reports bugs with screenshots | Writes to `qa-artifacts/` |
| `/qa` | Not sure which to use? Describe your problem and this picks one | No |

**Only `/qa-generate` writes test code.** It adds new files freely and asks before changing anything you already have. `/qa-fix` deliberately writes nothing — it hands you a reviewed plan, because a repair you didn't see is a repair you can't trust.

## Common tasks

**"Run my tests and tell me honestly if they passed"**
`/qa-run`

**"This test keeps failing and I don't know why"**
`/qa-run` then `/qa-debug`

**"I have no tests at all — write me some"**
`/qa-init` then `/qa-generate write tests for the login page`

**"Is this branch safe to ship?"**
`/qa-run` then `/qa-report` — you get a `ready`, `ready-with-risks`, `not-ready`, or `insufficient-data` verdict, and it cannot say `ready` while any test is failing.

**"This test passes sometimes and fails other times"**
`/qa-flaky`

**"Review the tests in my pull request"**
`/qa-review the tests in src/checkout/`

**"Check my staging site for problems"**
`/qa-explore https://staging.example.com`

## When something goes wrong

Start here. It fixes most problems:

```bash
npx qa-engineer doctor --project .
```

`doctor` checks your environment and your install and prints a hint for anything it finds. Items marked `warn` with an "optional" hint are fine to ignore.

### The commands don't appear in my assistant

1. **Are you in the right folder?** Run `ls .agents/skills` in your project — you should see `qa-run`, `qa-debug`, and the rest. If not, the install went somewhere else; re-run it with `--project .` from the correct folder.
2. **Restart your assistant.** Most only look for new skills at startup.
3. **Try plain English.** Instead of `/qa-run`, ask *"run my tests and report the result"*. Slash-command support varies by assistant; the skills work either way.
4. **Check your assistant reads the standard path.** Most read `.agents/skills/`. Claude Code uses `.claude/skills/`, which the installer also writes when it detects Claude. To force it: `npx qa-engineer install --agent claude-code --yes --project .`

### "refusing to overwrite N file(s) not owned by a previous install"

You already have a file where the pack wants to write one. It will not silently overwrite your work. Either move your file, or overwrite deliberately:

```bash
npx qa-engineer install --yes --force --project .
```

`--force` backs everything up to `.qa/backups/<timestamp>/` first.

### A skill says the engine is missing, or results are "degraded"

The Python tools aren't reachable. Fix in this order:

```bash
python3 --version                          # is Python installed at all?
npx qa-engineer repair --project .         # reinstall the bundled tools
npx qa-engineer doctor --project .         # should now say "bundled engine runs cleanly"
```

"Degraded" is not a bug — it is the skill telling you it could not run a tool and therefore trusts its own answer less. That's the honest behaviour.

### `verify` says files drifted

Someone edited an installed skill file. Restore them:

```bash
npx qa-engineer repair --project .
```

If the edit was deliberate, note that `update` will overwrite it again — keep customisations outside `.agents/skills/`.

### The assistant claims tests passed but they didn't

That is the exact failure this project exists to prevent, and it has three defences: the skill instructions, the result format that rejects `passed` alongside a failing test run, and the diff guard that blocks "fixes" which delete assertions. If you see it happen anyway, **please report it** — a concrete example is the most valuable bug report this project can receive. Include which assistant and model you used.

### Still stuck

```bash
npx qa-engineer doctor --project . --json
```

Open an issue and paste that output. It answers most questions before they're asked.

## Updating and uninstalling

```bash
npx qa-engineer update --project .      # refresh to the current version
npx qa-engineer verify --project .      # check nothing was corrupted
npx qa-engineer uninstall --project .   # remove everything it installed
```

`uninstall` removes exactly the files listed in `qa-lock.json`, backs each one up first, and leaves everything else alone. If you edited an installed file it stops and tells you rather than destroying your change; `--force` proceeds anyway. Add `--dry-run` to any command to see what it *would* do without doing it.

## How it works

The core idea in one line: **tools produce the facts, the AI explains them.**

```text
  You type /qa-run in your assistant
              │
              ▼
  ┌───────────────────────────────────┐
  │  The skill (a Markdown checklist) │  tells the assistant what to do,
  │  .agents/skills/qa-run/SKILL.md   │  in what order, and what it may not claim
  └───────────────────────────────────┘
              │
              ▼
  ┌───────────────────────────────────┐
  │  Your test runner                 │  npx playwright test …
  └───────────────────────────────────┘
              │  raw output, exit code
              ▼
  ┌───────────────────────────────────┐
  │  Bundled Python tools             │  count the results, classify the failure,
  │  (installed inside the skill)     │  redact secrets — no guessing
  └───────────────────────────────────┘
              │  facts
              ▼
  ┌───────────────────────────────────┐
  │  A checked result file            │  qa-artifacts/execution-result.json
  │  qa-artifacts/*.json              │  rejected if the claim contradicts the numbers
  └───────────────────────────────────┘
              │
              ▼
  The assistant explains it to you in plain language
```

Why it matters: the assistant never counts your test results itself. A tested parser does. And the result file has rules baked in — `"passed"` requires a zero exit code *and* zero failing tests — so a dishonest summary isn't merely discouraged, it's **invalid**.

Deeper detail: **[ARCHITECTURE.md](ARCHITECTURE.md)**.

### Framework support

| Framework | Detected | Runs your tests | Writes new tests | Understands results |
| --- | --- | --- | --- | --- |
| **Playwright** | Yes | **Yes** | **Yes** | Full |
| Selenium | Yes | Not yet | Not yet | Yes |
| Cypress | Yes | Not yet | Not yet | Yes |
| WebdriverIO | Yes | Not yet | Not yet | Yes |

"Not yet" means exactly that: the support is written and tested, but running and generating live is deliberately limited to Playwright until there's real proof behind the others. Debugging, reporting, and flake detection work for all four.

### Assistant support

Claude Code, Cursor, OpenAI Codex CLI, OpenCode, Gemini CLI, GitHub Copilot, Antigravity, Kimi, and any other assistant that reads the [Agent Skills](https://agentskills.io) standard. The installer detects which you use; when it can't tell, it says so and installs to the shared path that all of them read.

## What it does *not* do

Stated plainly, so nothing surprises you:

- **It is not a test runner.** It drives Playwright; it doesn't replace it.
- **It doesn't run your tests in CI by itself.** The skills need an AI assistant to read them. The installer works fine in CI, and `verify` makes a good pipeline check.
- **It can't stop an assistant that ignores it.** The defences make dishonest answers *fail loudly* rather than pass quietly — they can't force a model to read the skill.
- **It has not been benchmarked across AI models.** The tooling is thoroughly tested (235 automated tests). How faithfully each assistant follows the skills is measured for one model, in one session, and [documented as such](docs/release/v1-excellence-audit.md). If you need a published accuracy number before adopting a tool, this one doesn't have it yet.
- **It sends nothing anywhere.** No telemetry, no network calls, no accounts.
- **It is version 0.9.0** — a public preview. Solid and heavily tested, still pre-1.0.

## How this is verified

Everything below is reproducible from a clone with the command beside it.

| Evidence | Command |
| --- | --- |
| 152 analysis, framework, and branding tests | `python3 shared/analysis/lib/run_tests.py` |
| 28 diagnostic engine tests · 5 seam tests | `PYTHONPATH=shared/analysis/lib:shared/diagnostics/lib python3 -m unittest discover -s shared/diagnostics/lib/tests` |
| 50 installer tests — including security and repeated-use stress | `npm test` |
| 21 evaluation cases, including deliberately dishonest outputs the scorer must reject | `npm run validate:evals` |
| 4 real AI-produced results, scored | `python3 tests/evals/run_live.py --captures claude-opus-5` |
| 17 repository checks — including "documentation matches implementation" | `npm run validate:skills` … |

## Going deeper

Nothing below is required to use the pack.

| Document | What it answers |
| --- | --- |
| [docs/preview-tester-guide.md](docs/preview-tester-guide.md) | **Testing this preview for me?** Start here — 20 minutes, and what to send back |
| [docs/faq.md](docs/faq.md) | Why prompts and not a plugin? Does it work offline? Can I fork it? |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Longer troubleshooting, with exit codes |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the pieces fit and which boundaries hold them apart |
| [docs/capability-matrix.md](docs/capability-matrix.md) | **Canonical:** what works and how well proven it is |
| [docs/report-format.md](docs/report-format.md) | Consuming the JSON output from your own tooling |
| [docs/installation/](docs/installation/README.md) | Per-assistant installation guides |
| [COMPATIBILITY.md](COMPATIBILITY.md) | Supported assistants, runtimes, and frameworks |
| [docs/architecture/README.md](docs/architecture/README.md) | 15 decision records explaining every major choice |
| [docs/release/v0.9-release-checklist.md](docs/release/v0.9-release-checklist.md) | Exactly what was verified for this release, and what wasn't |
| [CHANGELOG.md](CHANGELOG.md) | What changed, including what regressed |

### Roadmap

```text
  ▸ NOW — v0.9 public preview
      Twelve commands · verified results · safe installer · Playwright live

  ▸ NEXT — v1.0
      Measured accuracy across real AI assistants
      A second framework running live · contracts frozen

  ▸ LATER
      CI-log and language-specific knowledge · more frameworks · docs site
```

Detail: **[ROADMAP.md](ROADMAP.md)**.

## Contributing

The most useful contribution right now is **using it on a real project and reporting what your assistant actually did** — especially if it claimed something untrue. That is the evidence this project most needs.

Also welcome: a new framework adapter ([runbook](docs/contributing/add-a-framework.md)), better QA knowledge, or challenging a decision record.

Start with [CONTRIBUTING.md](CONTRIBUTING.md). Everyone is bound by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Support

| Need | Where |
| --- | --- |
| Something is broken | Run `npx qa-engineer doctor --project .`, then read [When something goes wrong](#when-something-goes-wrong) |
| A question | GitHub Discussions — see [SUPPORT.md](SUPPORT.md) |
| A bug | GitHub Issues, with your `doctor --json` output |
| A security problem | **Privately** — see [SECURITY.md](SECURITY.md). Never a public issue. |

One volunteer maintainer, no SLA. [MAINTAINERS.md](MAINTAINERS.md) says what that means for you.

## Licence

[MIT](LICENSE) © QA Automation Pack contributors. Use it commercially, fork it, modify it.

Designed and developed by [Abisheik](https://abisheik.dev).
