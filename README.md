# QA Automation Pack

> A vendor-neutral skill pack that teaches AI coding agents to work like senior QA automation engineers — built on the open [Agent Skills](https://agentskills.io) standard.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-spec--native-6E56CF.svg)](https://agentskills.io)
[![SemVer](https://img.shields.io/badge/versioning-SemVer%202.0.0-informational.svg)](https://semver.org)
[![Conventional Commits](https://img.shields.io/badge/commits-Conventional-fe5196.svg)](https://www.conventionalcommits.org/en/v1.0.0/)
[![Status](https://img.shields.io/badge/status-pre--release-orange.svg)](ROADMAP.md)

## The problem

AI coding agents already write, run, and "fix" test automation every day — and left to their defaults, they do it badly in three predictable ways:

1. **Brittle output.** Generated tests full of hard waits, positional XPath selectors, and no isolation — the exact anti-patterns senior QA engineers spend careers stamping out.
2. **Hallucinated results.** Suites "fixed" by deleting assertions, adding `skip`, or inflating timeouts — green pipelines that verify nothing, reported as success.
3. **Locked-in prompts.** Hard-won QA knowledge written for one agent's format, duplicated and drifting across every tool a team uses.

## What this project is

QA Automation Pack is a single, canonical set of Agent Skills — `/qa-run`, `/qa-debug`, `/qa-generate`, `/qa-explore`, and eight more — backed by single-sourced QA knowledge, deterministic analysis tooling, and machine-readable output contracts. It installs identically into any agent that reads the Agent Skills standard, which as of mid-2026 includes every major AI coding agent.

Think of it as the standard library for AI-assisted QA engineering:

- **Skills** encode the workflows: how a senior engineer runs, generates, debugs, heals, reviews, and audits test automation.
- **Shared knowledge modules** encode the judgment: locator strategy, flakiness taxonomy, waiting discipline, BDD style, failure classification — written once, reused by every skill.
- **Deterministic analyzers** (the analysis platform) parse traces, HAR files, and reports into structured evidence, so agents reason over facts instead of guessing at raw artifacts.
- **Output contracts** make results verifiable: a debug run ends in a schema-validated classification (`product-bug`, `test-bug`, `env-issue`, `flake`, `infra`), never an unsupported claim.

What it is **not**: a test runner, a replacement for Playwright/Selenium/Cypress, a SaaS platform, or a pile of copy-paste prompts. Your tests remain plain, exportable code in your repository.

## Project status

This project is **pre-release** and under active construction. The architecture is finalized (see [docs/architecture/overview.md](docs/architecture/overview.md)); implementation is proceeding in public milestones.

| Milestone | Scope | Status |
| --- | --- | --- |
| M1 — Repository foundation | Governance, standards, CI, ADRs, structure | **Complete** |
| M2 — Skill development platform | Skill spec, authoring guide, templates, sync engine, validators | **Complete** |
| M3 — QA core engine | `qa`, `qa-init`, `qa-run`; context contract; execution lifecycle | **Complete** |
| M4 — Execution engine | Framework-agnostic execution platform; Playwright runs; normalized result | **Complete** |
| M5 — Intelligent automation generation | Generation platform; Playwright bootstrap and extend; generation result | **Complete** |
| M6 — Analysis platform and multi-framework foundation | Deterministic analyzers, diff guard, contract validator; Selenium adapter | **Complete** |
| M7 — QA diagnostic platform | `qa-debug`, `qa-fix`, `qa-report` over one shared diagnostic engine | **Complete** |
| M8 — QA knowledge platform and multi-framework completion | Knowledge base; qa-review/flaky/api/audit; Cypress + WebdriverIO | **Complete** |
| M9 — Developer experience and distribution | Installer, agent integrations, docs site, releases, examples | In progress |
| M9.5 — World-class installation & onboarding | Interactive `npx qa-automation-pack`, detect/recommend, self-test/repair/update | **Complete** |
| M10 — Behavioral evaluation and benchmarking | Release gate: measured accuracy across real scenarios | Planned |
| M10.5 — Architecture hardening | Mechanical enforcement of architectural invariants | **Complete** |

M9 is **in progress**: the interactive installer (`npx qa-automation-pack`), agent registry, and per-agent install guides have shipped; the documentation site and broader example repositories remain (see the [roadmap](ROADMAP.md)). The versioned npm release workflow is scaffolded; registry publish is the last distribution step.

**What is actually implemented, and how far each capability is proven, is tracked in one place: the [capability matrix](docs/capability-matrix.md).** Every claim below derives from it.

## Installation guide

Install the pack into **your application repository** so your AI coding agent can discover the `/qa-*` skills. The installer copies skills byte-for-byte into agent discovery paths — it does not rewrite them, run skill code, or change agent security settings.

For the shortest path, see the [five-minute quickstart](docs/installation/quickstart.md). Full index: [docs/installation/](docs/installation/README.md).

### Prerequisites

| Requirement | Notes |
| --- | --- |
| **Node.js 18.18+** | Required for the `qa` installer CLI |
| **An Agent Skills–compatible AI coding agent** | Cursor, Claude Code, OpenCode, Codex CLI, Gemini CLI, GitHub Copilot, Antigravity, and others — see [COMPATIBILITY.md](COMPATIBILITY.md) |
| **A test framework in your project (optional at install)** | Playwright is Production-ready for live `/qa-run` and `/qa-generate`. Selenium, Cypress, and WebdriverIO are Beta |

### 1. Install into your project

Run these commands from **your app directory** (not necessarily this repository).

**Recommended — interactive wizard** (detects agents, recommends components, installs, validates):

```bash
# After the package is on npm:
npx qa-automation-pack

# From a local checkout of this repo (today):
cd /path/to/QA-Automation-pack
npm install
npm run qa -- --project /path/to/your-app
```

**Non-interactive** (CI, scripts, or skip prompts):

```bash
# After npm publish:
npx qa-automation-pack --yes --project .

# From a local checkout:
npm run qa -- --yes --project /path/to/your-app
```

Target a specific agent when needed:

```bash
npx qa-automation-pack install --agent cursor --yes --project .
# agents: claude-code | cursor | codex | opencode | gemini-cli | github-copilot | antigravity | kimi
```

What gets written:

- `.agents/skills/<skill>/` — shared discovery path for most agents
- `.claude/skills/<skill>/` — when Claude Code is detected or requested
- Optional thin wrappers for agents that need them (OpenCode, Gemini CLI, Copilot, Antigravity)
- `qa-lock.json` — pack version and sha256 per installed file

### 2. Verify the install

```bash
npx qa-automation-pack self-test --project .
npx qa-automation-pack doctor --project .
npx qa-automation-pack verify --project .
```

All three should report a healthy install. `doctor` also prints detected agents and environment details.

### 3. Use it in your agent

Open your AI coding assistant in the same project and try:

1. `/qa-init` — or ask: *Analyze this repository and set up QA context.*
2. `/qa-run` — run your suite (Playwright is Production-ready).
3. `/qa-explore <url>` — live product QA with an evidence report.

You can also ask in natural language (for example, *debug the failing checkout spec*); `/qa` routes intent to the right skill.

### 4. Keep the pack healthy

```bash
npx qa-automation-pack repair --project .    # fix drifted or missing pack files
npx qa-automation-pack update --project .    # refresh from the current pack source
npx qa-automation-pack uninstall --project . # remove everything the pack installed
```

`uninstall` removes exactly the files recorded in `qa-lock.json` and nothing else,
backing each one up first. If you have edited an installed file, it stops and
names the file rather than discarding your work; `--force` proceeds anyway.
Add `--dry-run` to any of these to see the plan without writing.

### Per-agent guides

| Agent | Guide |
| --- | --- |
| Claude Code | [docs/installation/claude-code.md](docs/installation/claude-code.md) |
| Cursor | [docs/installation/cursor.md](docs/installation/cursor.md) |
| OpenAI Codex CLI | [docs/installation/codex-cli.md](docs/installation/codex-cli.md) |
| OpenCode | [docs/installation/opencode.md](docs/installation/opencode.md) |
| Gemini CLI | [docs/installation/gemini-cli.md](docs/installation/gemini-cli.md) |
| GitHub Copilot | [docs/installation/github-copilot.md](docs/installation/github-copilot.md) |
| Antigravity | [docs/installation/antigravity.md](docs/installation/antigravity.md) |
| Other Agent Skills hosts | [docs/installation/other-agents.md](docs/installation/other-agents.md) |

### Manual install (no CLI)

If you prefer not to use the installer:

```bash
mkdir -p .agents/skills
cp -R /path/to/qa-automation-pack/skills/* .agents/skills/
# Claude Code additionally:
mkdir -p .claude/skills
cp -R /path/to/qa-automation-pack/skills/* .claude/skills/
```

### Try the example project

To see support → install → generate → run → debug → report on a tiny Playwright app:

```bash
npm install
npm run qa -- --yes --project examples/getting-started
cd examples/getting-started && npm install && npx playwright install chromium
```

Then follow [examples/getting-started/README.md](examples/getting-started/README.md).

### Installer commands reference

| Command | Purpose |
| --- | --- |
| `qa` / `qa onboard` | Interactive install + guided first-run |
| `qa install` | Non-interactive install |
| `qa verify` | Integrity check against the lockfile |
| `qa doctor` | Environment + pack diagnostics |
| `qa self-test` | PASS/FAIL smoke checks |
| `qa repair` | Fix drifted or missing pack files |
| `qa update` | Refresh from the current pack source |
| `qa uninstall` | Remove every file recorded in `qa-lock.json` (transactional, backed up) |

Common flags: `--project`, `--agent`, `--yes` / `--ci`, `--json`, `--force`, `--dry-run`, `--debug`.

## Command surface

Twelve user-facing commands — deliberately few, because every installed skill competes for agent context and activation accuracy. Suite tiers, output formats, and protocol variants are argument modes, not separate commands. The twelfth command (`/qa-explore`) was added by [RFC-0001](docs/rfcs/RFC-0001-qa-explore.md) for live product QA.

| Command | Role | Absorbs |
| --- | --- | --- |
| `/qa` | Router: classifies intent, dispatches to the right skill | general QA assistant |
| `/qa-init` | Bootstraps project profile and QA context file | — |
| `/qa-run` | Executes suites and BDD scenarios | smoke, regression |
| `/qa-generate` | Generates tests, features, page objects, fixtures, data; bootstraps or extends in the project's framework | cucumber, pageobject, fixture, data |
| `/qa-debug` | Triages failures into an evidence-backed classification | investigate, rootcause |
| `/qa-fix` | Turns a diagnosis into a safe repair plan — diff-guard reviewed, permission-gated, applied by you | locators |
| `/qa-review` | Reviews automation quality and recommends improvements; edits nothing | refactor |
| `/qa-audit` | Audits pages: accessibility, performance, security, visual | accessibility, performance, security, visual, network |
| `/qa-api` | Validates REST, GraphQL, and WebSocket behavior | graphql |
| `/qa-flaky` | Detects and quantifies flaky tests, proposes quarantine | — |
| `/qa-report` | Produces reports, summaries, and exports | — |
| `/qa-explore` | Full-spectrum product QA on a live URL with evidence report | exploratory, browser QA, attached cases |

As of the current milestone, **all twelve commands are implemented** — each exists and validates against the skill spec. Ten ship a machine-readable output contract; the two that do not are `/qa` (a router — it dispatches and produces no artifact of its own) and `/qa-init`, whose output *is* `.qa/context.md`, governed by the [project context contract](shared/analysis/schemas/context.schema.json) and validated by the bundled parser. How deeply each command is *proven* varies and is recorded honestly in the [capability matrix](docs/capability-matrix.md); "implemented" is not the same as "behaviorally benchmarked" (that is the M10 release gate, still pending). In short: `/qa-run` **executes Playwright suites live** (and plans runs for other frameworks), `/qa-generate` **bootstraps or extends Playwright** non-destructively — it is the only command that writes to your source — the diagnostic trio (`/qa-debug`, `/qa-fix`, `/qa-report`) investigates failures and reports release readiness over one shared, tested engine, `/qa-review`, `/qa-flaky`, `/qa-api`, and `/qa-audit` assess quality, flakiness, API tests, and page audits against the [QA knowledge base](shared/domains/README.md), and `/qa-explore` runs live full-spectrum product QA against a URL (marked experimental — newest and broadest).

**What writes to your repository, and what does not.** Only `/qa-generate` creates or modifies test code, and only non-destructively (new files freely; edits to existing files only with explicit permission). `/qa-init` writes `.qa/context.md`. `/qa-run` and `/qa-explore` write artifacts under `qa-artifacts/`. Every other command — including `/qa-fix` and `/qa-review` — produces a report or a plan and changes nothing: a repair is described, diff-guard reviewed, and left for you to apply.

Framework support is not uniform, and the pack does not pretend it is. **Playwright is Production** — it executes and generates live. **Selenium, Cypress, and WebdriverIO are Beta**: their adapters are complete and their result normalization is proven by the cross-framework test, but `qa-run` and `qa-generate` gate *live* execution and generation to Playwright today. Robot Framework and Appium are Planning. See the [capability matrix](docs/capability-matrix.md) and the detailed [framework matrix](docs/compatibility/framework-matrix.md) for the exact per-capability picture.

Framework expertise is not a command: skills load it automatically from shared knowledge based on the detected project. BDD/Cucumber is handled as a *style layer* on top of a supported framework (today, Playwright), not as a separate execution framework.

## Target agents

The pack targets every agent that implements the Agent Skills standard. The tiers below are **planned targets, not achieved status**: an agent becomes CI-verified Tier 1 only once the M10 evaluation harness exercises it, and M10 has not run yet. Until then, every entry is where the agent is *expected* to land. [COMPATIBILITY.md](COMPATIBILITY.md) is the canonical agent list.

| Agent | Skill support | Planned tier |
| --- | --- | --- |
| Claude Code | Native (`.claude/skills/`, plugins) | Tier 1 — CI-tested |
| OpenAI Codex CLI | Native (`.agents/skills/`) | Tier 1 — CI-tested |
| OpenCode | Native (`.agents/skills/` + commands) | Tier 1 — CI-tested |
| Cursor | Native (`.agents/skills/`, `.cursor/skills/`) | Tier 2 — community-verified |
| GitHub Copilot | Native (`.github/skills/`, `.agents/skills/`) | Tier 2 — community-verified |
| Gemini CLI | Native (`.agents/skills/` + commands) | Tier 2 — community-verified |
| Antigravity | Native (`.agents/skills/` + workflows) | Tier 2 — community-verified |

Kimi and other Agent Skills hosts install through the same copy path and are planned Tier 2. The full agent list, discovery paths, and verification policy — the canonical source for agent compatibility — live in [COMPATIBILITY.md](COMPATIBILITY.md).

## Design principles

1. **Standard-native, zero transformation.** Skills are authored in the open Agent Skills format and are runtime-valid exactly as committed. No compiler, no per-agent rewrites, no source-versus-artifact drift ([ADR-0002](docs/architecture/ADR-0002-agent-skill-standard.md)).
2. **Deterministic first.** Anything parseable is parsed by tested scripts, not by model reasoning. Agents receive structured JSON evidence, never raw archives.
3. **Evidence or it didn't happen.** A skill may only claim success with machine-checkable proof: runner exit codes, reporter output, diff guards. This is the pack's answer to hallucinated green.
4. **Context discipline.** Small command surface, budgeted descriptions, progressive disclosure — because agent context is a shared, finite resource.
5. **Vendor-neutral.** MIT-licensed, plain exportable code, no platform lock-in, no telemetry.
6. **Secure by default.** Artifact contents are treated as untrusted data; analyzers redact credentials by default; the installer never executes code at install time or edits agent security configuration ([SECURITY.md](SECURITY.md)).

## How it will work

The target experience, end to end — this is what the milestones build toward:

```text
you:    /qa-debug the checkout spec failed in CI, trace at artifacts/trace.zip

agent:  1. Reads the project profile created by /qa-init  (framework, CI, conventions)
        2. Runs the bundled trace analyzer  →  structured timeline as JSON:
           failing step, console errors, a 500 on POST /api/payment
        3. Loads the failure taxonomy and weighs the evidence
        4. Writes qa-artifacts/debug-report.json:
           { "classification": "product-bug", "confidence": 0.9,
             "evidence": [...], "recommended_action": "file bug — do not modify the test" }
        5. Explicitly does NOT "fix" the test, because the product is broken
```

The same skill body drives all seven agents; only thin, generated invocation wrappers differ per platform.

## Repository layout

```text
qa-automation-pack/
├── .github/          Community health files, issue forms, CI workflows
├── docs/             Architecture (ADRs), installation, contributor standards
├── skills/           Canonical Agent Skills            (populated in M2)
├── shared/           Single-source QA knowledge modules (populated in M2)
├── packages/         Installer CLI (packages/installer) (populated in M9)
├── scripts/          Repository maintenance tooling     (populated in M2–M3)
├── templates/        Scaffolds for new skills/modules   (populated in M2)
├── tests/            Behavioral evaluation harness      (scaffold; M10 — planned)
└── examples/         Runnable example + walkthrough     (populated in M9)
```

Each reserved directory contains a README describing exactly what will live there and when.

## Project governance and support

| Question | Answer |
| --- | --- |
| Who decides, and how? | [GOVERNANCE.md](GOVERNANCE.md) — maintainer-led, ADR-governed, with the rules that bind maintainers too |
| Who maintains it? | [MAINTAINERS.md](MAINTAINERS.md) — currently one maintainer, stated plainly, with the structural mitigations |
| Where do I get help? | [SUPPORT.md](SUPPORT.md) — channels and honest expectations (no SLA) |
| Something is broken | [docs/troubleshooting.md](docs/troubleshooting.md) — symptoms, causes, fixes |
| How do I add a skill or framework? | [add a skill](docs/contributing/add-a-skill.md) · [add a framework](docs/contributing/add-a-framework.md) |
| How is a release cut? | [release process](docs/contributing/release-process.md) |
| What is actually verified? | [docs/release/](docs/release/) — audits, checklists, and known limitations |

## Contributing

Contributions are welcome now, even before the first skill ships:

- Review and challenge the [architecture decision records](docs/architecture/README.md).
- Propose skills or knowledge modules via the *Skill proposal* issue template.
- Improve documentation — the standards are in [docs/contributing/README.md](docs/contributing/README.md).

Start with [CONTRIBUTING.md](CONTRIBUTING.md). All participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Please report vulnerabilities privately — see [SECURITY.md](SECURITY.md). The security document also describes the pack's threat model and the design guarantees that govern every future milestone.

## License

[MIT](LICENSE) © QA Automation Pack contributors.

## Acknowledgements

This project builds on the open [Agent Skills](https://agentskills.io) standard and stands on the shoulders of the QA tooling ecosystem it integrates with — Playwright and its MCP server, Selenium, Cypress, WebdriverIO, Cucumber, axe-core, and the Chrome DevTools Protocol, among others.
