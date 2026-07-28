# Skill Authoring Guide

How skills are created, tested, reviewed, versioned, deprecated, and composed. The format rules live in the [specification](skill-specification.md) and the layout in [skill-anatomy.md](skill-anatomy.md); this guide is the workflow around them.

## Creating a skill

Before writing anything, confirm the capability belongs in a new skill at all. The command surface is budgeted (currently twelve user-facing skills after [RFC-0001](../rfcs/RFC-0001-qa-explore.md)); most contributions are a new **mode** on an existing skill or a new **knowledge module** in `shared/`. A new top-level skill requires an accepted proposal (use the *Skill proposal* issue form; larger changes use [templates/rfc-template.md](../../templates/rfc-template.md) and land under `docs/rfcs/`).

Then:

1. **Copy the template:** `cp -r templates/skill-template skills/qa-<name>` and replace every `{{...}}` placeholder.
2. **Write the description first** — capability sentence plus "Use when..." sentence with three to eight distinctive keywords. Run `node scripts/check-keywords.mjs` and resolve collisions with sibling skills now, not in review.
3. **Fill the six body sections** in order. Purpose and non-goals force scope discipline; the procedure comes last, once you know what the skill must never do.
4. **Externalize knowledge as you go.** Anything longer than a paragraph that isn't choreography goes to `references/`; anything a second skill could plausibly need goes to `shared/` and is synced in (see the [shared knowledge engine](../../shared/README.md)).
5. **Add a contract** if the skill emits a structured report — start from [templates/output-contract-template.json](../../templates/output-contract-template.json) and follow [output-contracts.md](output-contracts.md).
6. **Add at least one example** from [templates/example-template.md](../../templates/example-template.md) — reviewers evaluate intended behavior through examples.
7. **Validate:** `node scripts/validate-skills.mjs` must pass clean.

New skills start at `maturity: experimental` and version `0.1.0`.

## Testing a skill

Until the evaluation harness lands (Milestone 5), testing is live and manual — but it is not optional:

1. **Install your working copy** into your own agent by copying (or symlinking) the skill directory into the agent's discovery path — `.claude/skills/` for Claude Code, `.agents/skills/` for most others (see [COMPATIBILITY.md](../../COMPATIBILITY.md)). Re-copy after edits if your agent does not follow symlinks.
2. **Test activation, not just execution.** Phrase requests the way a real user would — without naming the skill — and confirm the right skill activates. Then test the explicit invocation.
3. **Test the unhappy paths:** missing artifacts, empty repositories, requests that belong to a sibling skill (the skill should redirect, per its non-goals).
4. **Check the output contract**: produce a report and validate it against the schema by hand or with your agent.
5. **Record what you tested** in the pull request description — agent, model, and the requests you tried. Reviewers weigh untested skills accordingly.

## Reviewing a skill

Review happens dimension by dimension against [quality-checklists.md](quality-checklists.md) — architecture, documentation, prompt quality, examples, security, compatibility, and contract. Three review principles sit above the checklists:

- **Review as the agent.** Read the procedure asking "could I execute this with only what the skill gives me?" Ambiguity a human reviewer glosses over is ambiguity an agent will resolve badly.
- **Review as the attacker.** Ask what happens when the artifacts this skill ingests contain hostile content.
- **Review as the neighbor.** Check the description against sibling skills — the most common defect is activation overlap, and it degrades *both* skills.

## Versioning a skill

Bump `metadata.version` in the same pull request as the change, classified per [ADR-0003](../architecture/ADR-0003-versioning-strategy.md):

| Change | Bump |
| --- | --- |
| Contract field removed or renamed; invocation meaning changes; skill renamed | MAJOR |
| New mode, new procedure capability, new optional contract field, new reference | MINOR |
| Wording, clarity, keyword tuning, fixed typos — no observable behavior change | PATCH |

Skill versions are informational (the pack version is the release unit), but they are what makes a vendored, three-months-old copy of a skill diagnosable — treat them as seriously as the pack version.

## Deprecating a skill

1. In a MINOR release: add `metadata.deprecated: replaced-by:<skill>` and replace the body's `## Purpose` opening with a short deprecation notice pointing to the replacement. Keep the description's activation keywords so existing users get redirected rather than stranded.
2. One release later: reduce the description to the redirect alone, freeing its keyword budget.
3. Remove no earlier than the next MAJOR release and at least 90 days after step 1, with a changelog migration note.

## Composing skills

Skills compose through two mechanisms — and only these two:

- **Handoff by name.** A skill ends by recommending the next command with its input: "classification is `test-bug` — run `/qa-fix` with this report." Never by loading another skill's files; sibling paths are not guaranteed at runtime.
- **Artifacts as interfaces.** Skills communicate through contract-validated reports in `qa-artifacts/`. Any skill may consume a report another skill produced; the schema — not the producing skill's internals — is the interface.

The [`qa` router](../../skills/qa/README.md) is the only skill whose job is dispatch; workflow skills never re-route a request more than once. If you find a skill needing a third mechanism — shared state, direct chaining, callbacks — the design is wrong; bring it to an issue.

## Execution skills

A skill that runs, observes, or acts on a system under test is an *execution skill* (`qa-run`, and later `qa-debug`, `qa-api`, `qa-audit`, and peers). Beyond the rules above, every execution skill:

- opens its procedure by reading [`.qa/context.md`](../architecture/context-contract.md) and stops-and-recommends `qa-init` if it is absent — it never guesses the stack;
- structures its procedure as the [execution lifecycle](../architecture/execution-lifecycle.md), performing a contiguous prefix of the phases and marking the rest planned or deferred;
- emits an [output contract](output-contracts.md) whose classification is the skill's decision and whose evidence justifies it.

It also builds on the shared [execution platform](../../shared/execution/README.md) — strategy, command building, browser lifecycle, artifact collection, normalization — by syncing the modules it needs rather than reimplementing them, and it runs a framework through that framework's [adapter](../../shared/execution/execution-contract.md). Authoring one is largely composing those platform modules with the three contracts; [`qa-run`](../../skills/qa-run/README.md) is the worked reference. The pattern is set by [ADR-0005](../architecture/ADR-0005-execution-lifecycle.md) and [ADR-0006](../architecture/ADR-0006-execution-architecture.md).

## Generation skills

A skill that creates or extends automation builds on the shared [generation platform](../../shared/generation/README.md) — repository analysis, mode and strategy, bootstrap and extension, template selection, style and naming — and carries per-framework code templates in its own `templates/` directory. It is discovery-first (analyze before generating), non-destructive (never overwrite without permission), and convention-matching (output looks like the team wrote it). [`qa-generate`](../../skills/qa-generate/README.md) is the worked reference; the rules are set by [ADR-0008](../architecture/ADR-0008-generation-architecture.md).

## Diagnostic skills

A skill that debugs, repairs, or reports on tests builds on the shared [diagnostic engine](../../shared/diagnostics/README.md) and the [analysis platform](../../shared/analysis/README.md) beneath it — both knowledge *and* tested Python code. It does not parse artifacts, classify failures, or reason about them itself: the engine does that once, deterministically, and the skill presents the result. Reasoning lives in the engine; narrative and audience framing are the skill's. A diagnostic skill bundles the `analysis` and `diagnostics` packages into its `scripts/lib/` (via `packages/installer/lib/core/bundle.mjs`) so it runs self-contained, and every conclusion cites the finding behind it. `qa-debug`, `qa-fix`, and `qa-report` are the worked references; the design is set by [ADR-0009](../architecture/ADR-0009-analysis-platform.md) and [ADR-0011](../architecture/ADR-0011-diagnostic-platform.md).

## Model-only skills

`metadata.audience: model` marks skills that are not commands: they hold expertise other skills load through their own activation (framework references, tooling documentation). Differences from user-facing skills:

| Aspect | User-facing (`audience: user`) | Model-only (`audience: model`) |
| --- | --- | --- |
| Description | Written for request routing; competes for activation | Written for the model's judgment about when the expertise applies |
| Body sections | All six mandatory sections | `Purpose`, `Context loading`, and content sections; no `Procedure`/`Inputs`/`Output` required |
| Contracts and examples | Expected | Not applicable |
| Wrappers (Milestone 4) | Generated | Never generated |
| Counted in description budget | Yes | Yes — model-only skills still occupy agent context |

Everything else — naming, size limits, prohibitions, review — applies identically.
