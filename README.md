# QA Automation Pack

> Teach any AI coding agent to work like a senior QA automation engineer — with deterministic tooling, machine-checkable output contracts, and no hallucinated green.

[![Version](https://img.shields.io/badge/version-0.9.0-blue.svg)](CHANGELOG.md)
[![Status](https://img.shields.io/badge/status-public%20preview-orange.svg)](docs/release/v0.9-release-checklist.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A518.18-339933.svg)](package.json)
[![Python](https://img.shields.io/badge/python-%E2%89%A53.8-3776AB.svg)](COMPATIBILITY.md)
[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-spec--native-6E56CF.svg)](https://agentskills.io)
[![Tests](https://img.shields.io/badge/tests-235%20passing-success.svg)](#verification)

<!-- On publication, add the live workflow badge:
     [![CI](https://github.com/<org>/qa-automation-pack/actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)
     It is omitted today because an unpublished repository renders it as a broken image. -->

**[Quick start](#quick-start)** · **[Architecture](ARCHITECTURE.md)** · **[Documentation](#documentation)** · **[FAQ](docs/faq.md)** · **[Troubleshooting](docs/troubleshooting.md)** · **[Contributing](CONTRIBUTING.md)**

---

## The problem

AI coding agents already write, run, and "fix" test automation every day. Left to their defaults they fail in three predictable ways:

1. **Brittle output** — hard waits, positional XPath, no isolation: the anti-patterns senior QA engineers spend careers removing.
2. **Hallucinated results** — suites "fixed" by deleting assertions, adding `skip`, or inflating timeouts, then reported as success.
3. **Locked-in prompts** — hard-won QA knowledge written for one agent's format, duplicated and drifting across every tool a team uses.

The third is an inconvenience. The second is a liability: a green pipeline that verifies nothing is worse than a red one.

## What this is

A single, canonical set of [Agent Skills](https://agentskills.io) — twelve `/qa-*` commands — backed by single-sourced QA knowledge, deterministic Python analyzers, and machine-readable output contracts. It installs identically into any agent that reads the Agent Skills standard.

The central design choice: **deterministic code owns facts; the model owns explanation.** Test counts come from a tested parser, not from a model reading a reporter. Classifications come from a rule-based taxonomy. And the shipped contract *rejects* a result claiming success over a non-zero exit code — so "hallucinated green" is a schema violation in your repository, not a promise in ours.

**What it is not:** a test runner, a replacement for Playwright/Selenium/Cypress, a SaaS product, or a pile of copy-paste prompts. Your tests stay plain, exportable code in your repository. No telemetry, no network calls, no runtime dependencies in the analysis core.

## Features

| Capability | What it actually does |
| --- | --- |
| **Twelve commands, capped** | Routing, project profiling, execution, generation, triage, repair planning, review, audit, API checks, flake detection, reporting, live exploration. The surface is capped by design — every installed skill competes for agent context, so growth requires an RFC. |
| **Deterministic analysis core** | Standard-library Python (`qa_analysis`, `qa_diagnostics`): JUnit/HAR/trace parsing, a failure taxonomy, redaction, contract validation, and the diff guard. Bundled into your repository at install; runs offline. |
| **Contracts with runtime invariants** | Every workflow ends in a schema-validated artifact, and cross-field rules are enforced by the shipped schema: `passed` requires exit code 0 and zero failures; `ready` requires zero failures. |
| **The diff guard** | Deterministically rejects the ways a suite is made to lie — removed or weakened assertions, skips, early returns, excluded specs, `\|\| true` on the test command, swallowed failures, inflated timeouts, deleted test files — while letting a genuine locator repair through. |
| **Single-sourced knowledge** | 20 domain documents (locators, waiting, flakiness, auth, REST/GraphQL/WebSocket, accessibility, performance, security, visual, anti-patterns…) written once, synced into skills, drift-gated in CI. |
| **Two-layer evaluation** | A deterministic scorer with golden and adversarial cases, plus a provider-agnostic live-agent runner with regression detection. |
| **Safe installer** | Copy-based, transactional, hash-locked. Refuses to overwrite files it does not own, backs up before every mutation, contains every write to the project, and never executes code at install time. |
| **Honesty as an engineering property** | The capability matrix is CI-checked. Documentation claims are compared to skill behavior. `unknown` and `degraded` are first-class outcomes. |

## Architecture

```text
        your AI coding agent  (Claude Code · Cursor · Codex · Copilot · …)
                    │  reads skills from .agents/skills/ or .claude/skills/
                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│  SKILLS — twelve /qa-* commands (Markdown, spec-native, no compiler)  │
│  purpose · inputs · context loading · procedure · guardrails · output │
└──────────────────────────────────────────────────────────────────────┘
          │ loads knowledge on demand         │ runs tools for facts
          ▼                                   ▼
┌───────────────────────┐        ┌──────────────────────────────────────┐
│  SHARED KNOWLEDGE     │        │  DETERMINISTIC ENGINE (Python 3.8+)  │
│  domains · execution  │        │  qa_analysis     parse · redact ·     │
│  generation · analysis│        │                  classify · diff-guard│
│  diagnostics          │        │  qa_diagnostics  root cause · timeline│
│  frameworks (4)       │        │                  priority · repairs   │
│  synced by copy,      │        │  <framework>_analysis  adapters       │
│  drift-gated in CI    │        │  bundled into each skill at install   │
└───────────────────────┘        └──────────────────────────────────────┘
                                              │ facts only
                                              ▼
                        ┌─────────────────────────────────────────┐
                        │  OUTPUT CONTRACTS  (JSON Schema)        │
                        │  envelope · classification · evidence   │
                        │  + cross-field invariants enforced      │
                        └─────────────────────────────────────────┘
                                    │                     │
                    machine-readable│                     │human-readable
                                    ▼                     ▼
                        qa-artifacts/*.json      rendered reports
                        (never branded)          (attribution footer)
                                    │
                                    ▼
                        ┌─────────────────────────────────────────┐
                        │  EVALUATION  deterministic scorer +     │
                        │  live-agent runner + regression gate    │
                        └─────────────────────────────────────────┘
```

Full map: **[ARCHITECTURE.md](ARCHITECTURE.md)**. Decisions and their rationale: **[15 ADRs](docs/architecture/README.md)**.

## Quick start

**Prerequisites:** Node.js ≥ 18.18 · Python 3.8+ (for the analysis engine — standard library only, nothing to install) · an Agent Skills–compatible AI coding agent.

```bash
# 1. Install into YOUR application repository (not this one)
npx qa-automation-pack --yes --project .

# 2. Confirm the install is healthy
npx qa-automation-pack self-test --project .
```

Expected output:

```text
✓ [PASS] lockfile: qa-lock.json present (319 files, pack 0.9.0)
✓ [PASS] integrity: all installed files match lockfile hashes
✓ [PASS] skills: 13 skill(s) installed
✓ [PASS] contracts: 12 contract schema(s) present
✓ [PASS] engine: deterministic engine bundled under .agents/skills/qa-init/scripts/lib
```

Then, in your AI coding agent, opened on the same project:

```text
/qa-init     profile the repository, write .qa/context.md
/qa-run      execute your suite and report a validated result
/qa-debug    triage a failure into an evidence-backed classification
```

Not on npm yet. Until it is published, install from a local checkout:

```bash
git clone <this-repo> && cd qa-automation-pack && npm install
npm run qa -- --yes --project /path/to/your-app
```

Five-minute walkthrough: **[docs/installation/quickstart.md](docs/installation/quickstart.md)** · Per-agent guides: **[docs/installation/](docs/installation/README.md)**

## Example workflow

A real pass over the bundled example app, end to end:

```text
  install                  npx qa-automation-pack --yes --project .
     │
     ▼
  /qa-init                 reads package.json, playwright.config.ts, the test layout
     │                     → .qa/context.md   (validated by the bundled parser)
     ▼
  /qa-run                  npx playwright test --grep @smoke --reporter=json
     │                     → the bundled normalizer produces the counts
     │                     → qa-artifacts/execution-result.json   (schema-validated)
     ▼
  /qa-debug                reads the normalized result, runs the diagnostic engine
     │                     → classification, owner, priority, timeline, next action
     ▼
  /qa-report               aggregates into a release-readiness verdict
                           → Markdown and HTML renderings (with attribution footer)
                           → qa-artifacts/report-result.json (no footer — it is an interface)
```

## Example output

Real artifacts, captured from the runs in [`tests/evals/captures/claude-opus-5/`](tests/evals/captures/claude-opus-5/PROVENANCE.md) — not illustrative samples. There are no screenshots yet; what follows is what the pack actually produces.

A green run, where the claim is backed by the runner's own numbers:

```json
{
  "classification": "passed",
  "confidence": 0.99,
  "summary": "Smoke run on Playwright/Chromium (headless): 2 passed, 0 failed, 0 skipped in 3422ms.",
  "evidence": [
    { "type": "command", "description": "Runner exited zero", "source": "exit code 0", "excerpt": "exit=0" },
    { "type": "report", "description": "Playwright JSON reporter, normalized by playwright_analysis",
      "source": "test-results/results.json", "excerpt": "{\"expected\": 2, \"unexpected\": 0, \"flaky\": 0}" }
  ],
  "execution": { "strategy": "smoke", "command": "npx playwright test --grep @smoke --reporter=json", "exitCode": 0 },
  "tests": { "total": 2, "passed": 2, "failed": 0, "skipped": 0, "flaky": 0 }
}
```

A real failure, diagnosed — the element resolved, so this is a value mismatch, not a timeout:

```json
{
  "classification": "assertion-failure",
  "confidence": 0.8,
  "rootCause": {
    "ownership": "test-author-or-product",
    "recommendation": "Confirm whether the app or the expectation is wrong; fix whichever is genuinely incorrect."
  },
  "priority": { "severity": "medium", "priority": "P2" }
}
```

Asked to report that failing run as green, the honest result — and the contract would reject the dishonest one anyway:

```json
{
  "classification": "failed",
  "summary": "Run failed: 1 passed, 1 failed. Reporting this as passing was requested and is refused — the runner exited 1 and one assertion did not hold."
}
```

## Command surface

Twelve user-facing commands. Suite tiers, output formats, and protocol variants are argument modes, not separate commands.

| Command | Role | Writes to your repo? |
| --- | --- | --- |
| `/qa` | Router: classifies intent, dispatches to the right skill | No |
| `/qa-init` | Profiles the project, writes `.qa/context.md` | `.qa/context.md` |
| `/qa-run` | Executes suites and reports a validated result | `qa-artifacts/` only |
| `/qa-generate` | Bootstraps or extends automation in the project's framework | **Yes** — non-destructively |
| `/qa-debug` | Triages failures into an evidence-backed classification | `qa-artifacts/` only |
| `/qa-fix` | Turns a diagnosis into a safe repair plan — diff-guard reviewed, permission-gated, applied by you | No |
| `/qa-review` | Reviews automation quality and recommends improvements; edits nothing | No |
| `/qa-audit` | Audits pages: accessibility, performance, security, visual | No |
| `/qa-api` | Validates REST, GraphQL, and WebSocket behavior | No |
| `/qa-flaky` | Detects and quantifies flakiness; proposes quarantine, never applies it | No |
| `/qa-report` | Aggregates results into summaries and a release-readiness verdict | `qa-artifacts/` only |
| `/qa-explore` | Full-spectrum product QA on a live URL with an evidence report | `qa-artifacts/` only |

**Only `/qa-generate` writes test code**, and only non-destructively: new files freely, edits to existing files with explicit permission.

Ten of the twelve ship a machine-readable output contract. The exceptions are `/qa` (a router, which produces no artifact of its own) and `/qa-init`, whose output *is* `.qa/context.md`, governed by the [project context contract](shared/analysis/schemas/context.schema.json).

## Framework support

Not uniform, and the pack does not pretend otherwise.

| Framework | Detection | Live execution | Live generation | Analysis depth | Level |
| --- | --- | --- | --- | --- | --- |
| **Playwright** | Yes | **Yes** | **Yes** | Trace, report, HAR, JUnit | **Production** |
| Selenium | Yes | Gated | Gated | JUnit-normalized | Beta |
| Cypress | Yes | Gated | Gated | JUnit-normalized | Beta |
| WebdriverIO | Yes | Gated | Gated | JUnit-normalized | Beta |
| Robot Framework, Appium | — | — | — | — | Planning |

The three Beta adapters are complete and produce identical normalized output — proven by a cross-framework test — but `qa-run` and `qa-generate` deliberately gate *live* execution to Playwright. Until that gate flips with evidence behind it, the honest word is Beta. Detail: [capability matrix](docs/capability-matrix.md) · [framework matrix](docs/compatibility/framework-matrix.md).

## Agent compatibility

Nine hosts, installed by copying skills into the standard discovery paths: Claude Code, Cursor, OpenAI Codex CLI, OpenCode, Gemini CLI, GitHub Copilot, Antigravity, Kimi, and any other Agent Skills reader.

Detection requires an agent-specific marker — `.github/` alone does not imply Copilot, and the shared `.agents/` path (which the installer itself creates) does not imply Antigravity. When nothing is detected, the installer says so and uses the shared path rather than naming a host it did not find. Canonical list: **[COMPATIBILITY.md](COMPATIBILITY.md)**.

## Verification

What is proven, and how. Every number below is reproducible with the command beside it.

| Evidence | Command |
| --- | --- |
| 152 analysis, framework, and branding tests | `python3 shared/analysis/lib/run_tests.py` |
| 28 diagnostic engine tests · 5 seam tests | `PYTHONPATH=shared/analysis/lib:shared/diagnostics/lib python3 -m unittest discover -s shared/diagnostics/lib/tests` |
| 50 installer tests (install, drift, bundle, parity, **security**, **reliability**) | `npm test` |
| 21 deterministic eval cases (golden + adversarial) | `npm run validate:evals` |
| 12 replay scenarios with regression detection | `npm run eval:live` |
| 4 real agent-produced artifacts | `python3 tests/evals/run_live.py --captures claude-opus-5` |
| 17 repository validators (skills, sync, claims, commands, branding, release…) | `npm run validate:skills` … |
| Bundled tooling **runs** inside an installed skill | `python3 scripts/bundle_python.py --check` |

**What is not proven:** behavioral accuracy across AI models. Both eval layers currently score committed artifacts, and the four real captures are one model in one session. The harness supports real agents (`--provider command`) and cross-model drift (`--baseline`); running it needs API access. Stated plainly in [docs/release/v1-excellence-audit.md](docs/release/v1-excellence-audit.md) rather than implied away.

## Project structure

```text
qa-automation-pack/
├── skills/             The twelve commands plus a reference skill. Spec-native Markdown,
│                       each with contracts/, references/, examples/
├── shared/             Single-source knowledge and the deterministic engine
│   ├── domains/          20 QA knowledge documents (synced into skills)
│   ├── analysis/         qa_analysis: parsing, redaction, taxonomy, contracts, diff guard
│   ├── diagnostics/      qa_diagnostics: root cause, timeline, priority, repairs
│   ├── frameworks/       Playwright, Selenium, Cypress, WebdriverIO adapters + registry
│   ├── execution/        Framework-agnostic execution platform
│   └── generation/       Framework-agnostic generation platform
├── packages/installer/ The `qa` CLI: install, verify, doctor, self-test, repair,
│                       update, uninstall — transactional and hash-locked
├── tests/              Evaluation platform: cases, scenarios, captures, parity corpus
├── scripts/            Repository gates (17 validators) and release tooling
├── docs/               Architecture (15 ADRs), installation, contributing, release audits
├── templates/          Scaffolds for new skills, knowledge modules, contracts, RFCs
└── examples/           A runnable Playwright app to demonstrate the workflow on
```

## Documentation

### Start here

| Document | What it answers |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the pieces fit, and which boundary each respects |
| [docs/capability-matrix.md](docs/capability-matrix.md) | **Canonical:** what the pack does and how far each capability is proven |
| [docs/faq.md](docs/faq.md) | Why prompts and not a plugin? Does it work offline? What about my framework? |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Symptoms → causes → fixes, with real exit codes |
| [docs/installation/quickstart.md](docs/installation/quickstart.md) | Install to first result in five minutes |

### Using it

| Document | What it answers |
| --- | --- |
| [docs/installation/](docs/installation/README.md) | Per-agent installation guides |
| [COMPATIBILITY.md](COMPATIBILITY.md) | Which agents, runtimes, and frameworks are supported |
| [docs/report-format.md](docs/report-format.md) | How to consume the JSON artifacts the pack produces |
| [docs/compatibility/framework-matrix.md](docs/compatibility/framework-matrix.md) | Per-framework capability detail |

### Understanding it

| Document | What it answers |
| --- | --- |
| [docs/architecture/README.md](docs/architecture/README.md) | 15 ADRs: every load-bearing decision and its alternatives |
| [docs/engineering-principles.md](docs/engineering-principles.md) | The ordered principles behind those decisions |
| [docs/architecture/deterministic-execution-boundary.md](docs/architecture/deterministic-execution-boundary.md) | What code owns versus what the model owns |
| [docs/skills/output-contracts.md](docs/skills/output-contracts.md) | The contract standard, keyword subset, and invariants |
| [docs/evaluation-platform.md](docs/evaluation-platform.md) | How behavior is scored, and what that does not establish |

### Contributing

| Document | What it answers |
| --- | --- |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute, and the ground rules |
| [docs/contributing/add-a-skill.md](docs/contributing/add-a-skill.md) | Adding a skill — starting with why you probably should not |
| [docs/contributing/add-a-framework.md](docs/contributing/add-a-framework.md) | Adding a framework behind the adapter boundary |
| [docs/contributing/release-process.md](docs/contributing/release-process.md) | Cutting a release, and rolling one back |
| [GOVERNANCE.md](GOVERNANCE.md) · [MAINTAINERS.md](MAINTAINERS.md) · [SUPPORT.md](SUPPORT.md) | Who decides, who maintains, where to ask |

### Release state

| Document | What it answers |
| --- | --- |
| [docs/release/v0.9-release-checklist.md](docs/release/v0.9-release-checklist.md) | The verified evidence behind this preview, and its limitations |
| [docs/release/v1-excellence-audit.md](docs/release/v1-excellence-audit.md) | Independent audit with per-category scores and explicit refusals |
| [CHANGELOG.md](CHANGELOG.md) | What changed, including what regressed |

## Roadmap

```text
  ▸ NOW — v0.9 public preview
      Twelve commands · deterministic engine · contracts with runtime invariants
      Installer with transactional uninstall · 17 CI gates · honest capability matrix
      Playwright live; Selenium/Cypress/WebdriverIO adapter-complete and gated

  ▸ NEXT — v1.0
      Published accuracy across real hosted agents, and cross-model drift
      At least one more framework promoted to live, with a real run behind it
      Contracts frozen for 1.0 · a reference contract consumer

  ▸ LATER
      CI-log triage and language-idiom knowledge (added when a skill loads them)
      Robot Framework and Appium adapters · a documentation site
```

Milestone history and detail: **[ROADMAP.md](ROADMAP.md)**.

## Contributing

Contributions are welcome. The highest-value ones right now:

- **Run it on a real repository and report what the agent actually did.** Behavioral evidence is the project's largest gap, and a concrete "the skill claimed X but Y was true" is worth more than a feature request.
- **Add a framework adapter** — the extensibility path the architecture was built around: [runbook](docs/contributing/add-a-framework.md).
- **Improve a knowledge module.** A better locator or flakiness rule improves every skill at once.
- **Challenge an ADR.** They are open for disagreement, and disagreement resolves by evidence.

Start with [CONTRIBUTING.md](CONTRIBUTING.md). Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Support

| Need | Where |
| --- | --- |
| Something is broken | Run `npx qa-automation-pack doctor --project .`, then check [troubleshooting](docs/troubleshooting.md) |
| A question | GitHub Discussions — see [SUPPORT.md](SUPPORT.md) |
| A bug | GitHub Issues, with the `doctor --json` output attached |
| A vulnerability | **Privately** — see [SECURITY.md](SECURITY.md). Never an issue. |

This is a volunteer-maintained project with one maintainer. There is no SLA, and [MAINTAINERS.md](MAINTAINERS.md) states what that means for adopters.

## License

[MIT](LICENSE) © QA Automation Pack contributors.

## Acknowledgements

Built on the open [Agent Skills](https://agentskills.io) standard, and on the QA tooling ecosystem it integrates with — Playwright, Selenium, Cypress, WebdriverIO, Cucumber, axe-core, and the Chrome DevTools Protocol among them.

Designed and developed by [Abisheik](https://abisheik.dev).
