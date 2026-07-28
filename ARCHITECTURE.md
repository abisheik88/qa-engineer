# Architecture

A map of how QA Automation Pack fits together and why it is shaped this way. It
is the entry point to the architecture, not a replacement for it: every decision
below has an [ADR](docs/architecture/README.md) recording its context,
alternatives, and consequences.

## The one idea

> **Deterministic code owns facts. The model owns explanation.**

An AI agent is excellent at reading a failure and explaining it to a human, and
unreliable at counting. So anything countable, parseable, or checkable is computed
by tested code, and the model's job is to interpret and communicate what that code
produced — never to produce it.

That single rule explains most of the structure. Test counts come from a parser.
Classifications come from a rule-based taxonomy. Safety verdicts come from the diff
guard. And the output contract *rejects* a result whose narrative disagrees with
its numbers, so the boundary is enforced in the user's repository rather than
trusted. The full division is in
[deterministic-execution-boundary.md](docs/architecture/deterministic-execution-boundary.md).

## The layers

```text
        your AI coding agent  (Claude Code · Cursor · Codex · Copilot · …)
                    │  discovers skills in .agents/skills/ or .claude/skills/
                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│  1. SKILLS — twelve /qa-* commands                                    │
│     Markdown in the Agent Skills format. No compiler, no build step:  │
│     the committed file is the runtime artifact.                       │
└──────────────────────────────────────────────────────────────────────┘
          │ loads knowledge per step          │ runs tools for facts
          ▼                                   ▼
┌───────────────────────┐        ┌──────────────────────────────────────┐
│  2. SHARED KNOWLEDGE  │        │  3. DETERMINISTIC ENGINE (Python)    │
│     Written once,     │        │     qa_analysis     · qa_diagnostics │
│     synced by copy    │        │     framework adapters               │
│     into each skill,  │        │     Standard library only; bundled   │
│     drift-gated in CI │        │     into each skill at install time  │
└───────────────────────┘        └──────────────────────────────────────┘
                                              │ facts only
                                              ▼
                        ┌─────────────────────────────────────────┐
                        │  4. OUTPUT CONTRACTS (JSON Schema)      │
                        │     shape + cross-field invariants      │
                        └─────────────────────────────────────────┘
                                              │
                                              ▼
                        ┌─────────────────────────────────────────┐
                        │  5. EVALUATION                          │
                        │     deterministic scorer + live runner  │
                        └─────────────────────────────────────────┘
```

### 1. Skills — the workflows

Twelve user-facing commands, each a single `SKILL.md` with a fixed anatomy:
purpose, inputs, context loading, procedure, guardrails, tooling, output. They are
**spec-native**: the file committed here is exactly what the agent reads, with no
transformation step ([ADR-0002](docs/architecture/ADR-0002-agent-skill-standard.md)).
That removes an entire class of source-versus-artifact drift.

The surface is **capped at twelve**. Every installed skill competes for context and
for activation accuracy, so a thirteenth command must displace something and needs
an accepted RFC. Suite tiers, output formats, and protocol variants are argument
modes, not new commands.

Skills are also **self-contained**: no skill references another skill's files, and
no skill reads `shared/` at runtime. Whatever a skill needs travels inside it.

### 2. Shared knowledge — the judgment

QA judgment that more than one skill needs — locator strategy, waiting discipline,
flakiness taxonomy, assertion patterns, auth, REST/GraphQL/WebSocket, accessibility,
performance, security, visual testing, anti-patterns — is written once under
`shared/` and **copied** into each consuming skill's `references/`, carrying a
provenance marker as its first line.

Copying rather than referencing is deliberate: installed skills must work standalone.
The cost is duplication, and the mitigation is mechanical —
`sync-shared --check` fails CI if any copy differs from its source, so a hand-edited
copy cannot merge ([ADR-0012](docs/architecture/ADR-0012-knowledge-base.md)).

A directory under `shared/` exists only when it holds knowledge a skill loads; a
fitness test fails on a directory containing nothing but a README
([ADR-0015](docs/architecture/ADR-0015-no-reserved-empty-directories.md)).

### 3. The deterministic engine — the facts

Standard-library Python, no third-party dependencies, bundled into each skill that
needs it at install time so it runs in the user's repository with nothing to
install.

| Package | Owns |
| --- | --- |
| `qa_analysis` | JUnit and HAR parsing, artifact discovery, the failure taxonomy, the evidence model, credential redaction, contract validation, the `.qa/context.md` parser, and the diff guard |
| `qa_diagnostics` | Root-cause analysis, timeline reconstruction, prioritization, recommendation ranking, and repair planning — one engine consumed by five skills |
| `<framework>_analysis` | Per-framework artifact shapes only. Playwright adds trace and JSON-report analysis; the others normalize through the shared JUnit parser |

Each is reachable through a documented CLI, and every skill's Tooling section gives
the literal command. That matters more than it sounds: before those commands
existed, skills described the engine in prose and agents had to invent the glue.

The **diff guard** deserves separate mention. It is the deterministic answer to
"fixed by deleting the assertion": it inspects a unified diff and flags removed or
weakened assertions, added skips, early returns, excluded specs, always-succeeding
test commands, swallowed failures, inflated timeouts, and deleted test files —
while letting a genuine locator repair through, because a guard that flags real
repairs gets ignored.

### 4. Output contracts — the interface

Every workflow ends in a JSON artifact validated against a committed schema. The
schemas carry a common envelope (`contract`, `skill`, `generatedAt`, `summary`,
`classification`, `evidence`) and a closed `classification` enum where every value
implies a different next action.

They also carry **cross-field invariants**, which is what makes them more than
shape checks:

| Contract | Invariant |
| --- | --- |
| `qa-run/execution-result` | `passed` ⇒ exit code 0 **and** zero failing tests |
| `qa-run/execution-result` | `failed` ⇒ at least one failing test |
| `qa-report/report-result` | `ready` ⇒ zero failures, and a matching readiness verdict |
| `qa-fix/fix-result` | a failed diff-guard review cannot be `repairable` |

A result that claims success over a non-zero exit code is therefore *invalid*, in
the user's repository, at runtime — not merely discouraged
([ADR-0007](docs/architecture/ADR-0007-normalized-result.md),
[output-contracts.md](docs/skills/output-contracts.md)).

### 5. Evaluation — the proof

Two layers. The **deterministic scorer** runs golden cases (correct behavior, which
must validate and satisfy every assertion) and adversarial cases (the failure modes
the pack promises to prevent, which the scorer must *reject*). The **live-agent
runner** feeds real or replayed agent output into that same frozen scorer, with a
committed baseline and regression detection.

What this establishes and what it does not is stated in
[docs/evaluation-platform.md](docs/evaluation-platform.md) — currently four real
agent-produced artifacts from one model, which is an existence proof rather than a
benchmark.

## The boundaries that hold it together

Four seams are load-bearing. Each is enforced by a test, not by convention.

| Boundary | Rule | Enforced by |
| --- | --- | --- |
| **Framework adapter** | All framework specifics live in `shared/frameworks/<name>/`; no framework name appears in a skill or a shared platform | Cross-framework parity test; adding a framework changes only that directory ([ADR-0013](docs/architecture/ADR-0013-framework-boundary.md)) |
| **Deterministic vs. model** | Code owns facts; the model explains them | Contract invariants, adversarial eval cases, `check-architecture-fitness` |
| **Analysis → diagnostics** | The engine's inputs and outputs are validated against internal seam schemas | `tests/seams/`, and the CLI refuses a malformed payload with exit 2 |
| **Artifact vs. rendering** | JSON artifacts are interfaces and carry no prose; human renderings carry attribution | `check-branding.mjs` |

## Installation model

The installer copies skills byte-for-byte into the agent's discovery path and
records a SHA-256 per file in `qa-lock.json`. It does not rewrite skills, execute
code at install time, or modify agent security settings.

Every mutation runs through a transaction that backs up what it is about to
overwrite or delete and rolls back on failure. Writes are contained to the project
root — lexically *and* after resolving symlinks — and version-control directories
are refused outright, because `qa-lock.json` travels with a clone and is therefore
attacker-influenced input.

`install · verify · doctor · self-test · repair · update · uninstall` share those
guarantees.

## Where to go next

| Question | Document |
| --- | --- |
| What can it actually do, and how well proven? | [docs/capability-matrix.md](docs/capability-matrix.md) |
| Why was each decision made? | [docs/architecture/README.md](docs/architecture/README.md) — 15 ADRs |
| What principles order those decisions? | [docs/engineering-principles.md](docs/engineering-principles.md) |
| How do the skills interact? | [docs/architecture/skill-interactions.md](docs/architecture/skill-interactions.md) |
| Where can I extend it? | [docs/architecture/extension-points.md](docs/architecture/extension-points.md) |
| How do I add a framework or skill? | [add a framework](docs/contributing/add-a-framework.md) · [add a skill](docs/contributing/add-a-skill.md) |
| How do I consume the output? | [docs/report-format.md](docs/report-format.md) |
