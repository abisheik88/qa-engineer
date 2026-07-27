# Architecture Overview

This document is the finalized architecture for QA Automation Pack. It records the system's shape, the decisions already locked in (with their ADRs), and the questions deliberately left open for validation during implementation. Milestone scoping lives in [ROADMAP.md](../../ROADMAP.md); this document describes the end state those milestones build.

The architecture was selected by evaluating competing designs — a per-agent compiler pipeline, an MCP-server-first design, and a standard-native design — against contributor experience, output fidelity, maintenance cost under agent-format churn, testability, and upgrade path, followed by an adversarial risk review. The decisions below reflect that process.

## System shape

Four layers, with strict rules about what may live in each:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ L1  SKILLS                                        skills/            │
│     12 user-facing commands + 1 reference skill (qa-example).        │
│     Spec-pure Agent Skills. Own procedure, guardrails, contract.     │
│     Source == runtime artifact. Never transformed.                   │
├──────────────────────────────────────────────────────────────────────┤
│ L2  SHARED KNOWLEDGE                              shared/            │
│     Single-source QA judgment: domains, frameworks, stacks, CI.      │
│     Materialized into each skill's references/ by copy (sync),       │
│     committed, drift-gated in CI. Never inlined or rewritten.        │
├──────────────────────────────────────────────────────────────────────┤
│ L3  DETERMINISTIC TOOLING       shared/*/lib -> bundled per skill    │
│     Standard-library-only Python analyzers, single-sourced in        │
│     shared/ and bundled into each skill: trace extraction, HAR       │
│     analysis, CI-log triage, flake stats, locator diffing, diff      │
│     guard. JSON out, exit codes, redaction by default.               │
├──────────────────────────────────────────────────────────────────────┤
│ L4  DELIVERY                                      packages/installer │
│     qa installer: agent detection, copy-based install, lockfile      │
│     with per-file hashes, generated <=15-line invocation wrappers.   │
│     Wrappers contain zero knowledge.                                 │
└──────────────────────────────────────────────────────────────────────┘
```

## Locked decisions

Each decision is binding on all milestones; changing one requires a superseding ADR.

1. **Canonical format is the open Agent Skills standard, authored directly in `skills/`, runtime-valid exactly as committed.** No compile step may ever rewrite a skill body or frontmatter. Vendor-specific frontmatter extras may ride along under the specification's unknown-key tolerance but must never be load-bearing. ([ADR-0002](ADR-0002-agent-skill-standard.md))
2. **Shared knowledge is single-sourced in `shared/` and materialized by copy, never by inline expansion.** A sync tool copies declared modules into each skill's `references/` and shared script libraries into each skill's `scripts/lib/`; copies are committed and CI fails on drift. Cross-skill relative paths are banned — every installed skill must be self-contained.
3. **The command surface is 12 user-facing skills**: `qa` (router), `qa-init`, `qa-run`, `qa-generate`, `qa-debug`, `qa-fix`, `qa-review`, `qa-audit`, `qa-api`, `qa-flaky`, `qa-report`, `qa-explore` — plus the model-only `qa-example` reference skill (format demo and install self-check). Framework and toolbox expertise is not a skill; it lives in `shared/` knowledge that skills load on detection. Suite tiers, artifact types, audit dimensions, and protocol variants are argument modes. The sum of all skill descriptions is a hard CI budget; growing the surface is a zero-sum decision requiring an RFC ([RFC-0001](../rfcs/RFC-0001-qa-explore.md)).
4. **Skill bodies are placeholder-free and agent-syntax-free.** No argument substitution tokens, no shell-injection syntax, no agent-specific execution directives in any `SKILL.md`. Bodies state that the user's request follows in the conversation — the only convention that works identically on all seven target agents. Substitution syntax exists only inside generated wrappers.
5. **Invocation wrappers are generated stubs, never rewrites.** Where an agent needs a companion file for slash ergonomics (Gemini CLI commands, OpenCode commands, Antigravity workflows, optional Copilot prompt files), the installer renders it from skill frontmatter alone; wrappers are at most 15 lines and contain no knowledge.
6. **Deterministic first.** Every parseable artifact is parsed by a tested, dependency-free script before any model reasoning; agents consume the script's JSON. MCP integrations (Playwright MCP, Chrome DevTools MCP) are runtime-detected enhancements with a documented CLI fallback — never requirements, and never configured by the installer.
7. **Install is copy plus lockfile.** The installer copies skills into `.agents/skills/` (all spec-native agents) and `.claude/skills/` (Claude Code), drops wrappers, and writes a lockfile recording the pack version and a hash per installed file. Updates refuse to overwrite user-modified files without an explicit force; uninstall removes only lockfile-listed paths. Teams vendor the installed files and verify drift in CI.
8. **Machine-readable output contracts gate releases.** Workflow skills end by writing a `qa-artifacts/` report validating against a committed JSON Schema — for `qa-debug`, a classification of `product-bug`, `test-bug`, `env-issue`, `flake`, or `infra` with confidence and evidence. Removing or renaming a contract field is a breaking change. Evaluations score skills with deterministic assertions; judge-model scores are advisory only.

## Why these decisions hold in the 2026 ecosystem

The verified landscape (July 2026): all seven target agents natively parse `SKILL.md`; six of seven read `.agents/skills/` directly; description-driven auto-activation is the one invocation channel available everywhere; and at least one agent enforces a hard budget on installed skill descriptions. Two agents deprecated their proprietary prompt formats in favor of the standard within the last year. Consequences:

- A compiler that rewrites per agent adds a drift surface and a contributor barrier while solving a conversion problem the ecosystem has already solved — rejected.
- The surviving per-agent variance (slash ergonomics, argument passing) is small enough for 15-line generated stubs.
- Format churn lands on the agents, which converge on the standard, rather than on this repository.

## Command surface rationale

The original proposal contained 28 flat commands. Consolidation to 11 was deliberate; [RFC-0001](../rfcs/RFC-0001-qa-explore.md) then added `qa-explore` as a twelfth command for live product QA that no existing skill or mode could own without overload:

| Consolidation | Reason |
| --- | --- |
| debug / investigate / rootcause → `qa-debug` | One triage pipeline at different depths; users cannot predict which name to type, and near-identical descriptions break auto-activation |
| smoke / regression → `qa-run` modes | Suite selection is an argument, not a workflow |
| cucumber / pageobject / fixture / data → `qa-generate` modes | One generator procedure with four artifact types |
| locators → `qa-fix` mode | Healing is a repair strategy inside the repair workflow |
| refactor → `qa-review --apply` | Find and apply are one skill with an escalation step |
| graphql → `qa-api` mode | Protocol variant of one validation workflow |
| a11y / performance / security / visual / network → `qa-audit` modes | Page-audit dimensions sharing one procedure shape |
| playwright / selenium expert modes → `shared/frameworks/` | Expertise is knowledge the workflows load on detection, not a workflow |
| qa-ai → `qa` router | Intent classification belongs in one place |
| live URL / attached cases / full-spectrum product QA → `qa-explore` | Distinct from artifact audits (`qa-audit`) and suite execution (`qa-run`); owns the browser session and evidence report ([RFC-0001](../rfcs/RFC-0001-qa-explore.md)) |

The router is user-invoked only, dispatches by skill name (never by file path), asks at most one disambiguating question, and never performs work itself.

## Security model

Security guarantees are defined in [SECURITY.md](../../SECURITY.md) and are architectural constraints: no install-time code execution, no agent-configuration mutation, artifact-contents-as-untrusted-data guardrails in every ingesting skill, redaction by default in every analyzer, no secrets in reports, no telemetry. The evaluation harness additionally checks forbidden actions — a "fix" that deletes assertions, adds skips, or inflates timeouts fails its golden task regardless of suite state.

## Testing model

| Layer | Scope | When |
| --- | --- | --- |
| 0 — Static | Specification validation, frontmatter schema, size and description budgets, placeholder ban, link and drift checks | Every pull request |
| 1 — Unit | Analyzer scripts against recorded artifact fixtures | Every pull request |
| 2 — Install snapshots | Installer output per agent: tree, idempotency, uninstall restores pristine state | Every pull request |
| 3 — Behavioral evals | Golden tasks on seeded fixture apps and repos, run headlessly on Tier 1 agents, deterministic assertions gating | Release and scheduled |

Milestone 1 implements the repository-level subset of layer 0 (Markdown lint, formatting, links, structure); each subsequent milestone extends the layers it touches.

## Open questions to validate during implementation

Recorded here so implementation milestones test them deliberately rather than discovering them in production. The M9 installer resolved the *mechanics* of items 1, 3, and 4 (duplicate-path dedup by discovery directory, an Antigravity workflow wrapper, and trailing-argument passthrough); behavioral confirmation across every agent is deferred to the M10 evaluation harness.

1. **Duplicate discovery:** how each agent behaves when it can see both `.agents/skills/` and `.claude/skills/` copies — resolve copy versus exclusion per agent before shipping the installer.
2. **Description budgets:** whether 12 keyword-rich descriptions survive the most restrictive agent's context budget alongside a realistic set of co-installed third-party skills; if not, a single narrow escape hatch (a shorter description variant consumed only at install time) is permitted — body variants are not.
3. **Antigravity workflow integration:** the workflow directory and format are the one target-surface claim not yet verified against primary documentation; verify before shipping that wrapper, fall back to auto-activation if wrong.
4. **Trailing-argument handling:** confirm each agent passes text following a slash invocation into the conversation; extend generated wrappers to any agent that drops it.
5. **Reference-following reliability:** whether load-bearing rules can live in `references/` on weaker agents or must be promoted into skill bodies — settled empirically by the evaluation harness, not by assumption.
