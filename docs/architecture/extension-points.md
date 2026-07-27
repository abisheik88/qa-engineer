# Extension Points

How capability plugs into the QA Core Engine without reshaping it. The engine was designed so that adding deterministic tooling, new frameworks, and new analysis is a matter of *filling seams that already exist* — not editing the skills above them. This document names the seams and maps each capability to one. Most of the map below has **shipped** (M4–M8); the design held, which is the point.

## The four seams

Every future capability attaches at one of four places, and only these:

1. **Context detectors** — new facts in [`.qa/context.md`](context-contract.md). Adding detection (a new framework, a new CI provider) is a new field plus detection heuristics in `qa-init`; consumers that do not know the field ignore it (the contract is additive).
2. **Lifecycle phases 6–8** — deterministic **collect / execute / validate** behind the [execution lifecycle](execution-lifecycle.md). Skills already plan these phases; tooling fills them behind the phase boundary without changing the plan's shape.
3. **Bundled analyzers** — standard-library scripts inside a skill's `scripts/` ([skill anatomy](../skills/skill-anatomy.md)) that turn raw artifacts into contract-shaped JSON. A skill gains an analyzer by adding a script and a `Tooling` row, not by changing its procedure.
4. **New skills** — additional commands that attach to the [router](../../skills/qa/README.md) and exchange `qa-artifacts/`, per [skill interactions](skill-interactions.md).

If a proposed capability does not fit one of these seams, that is a signal to reconsider the design before writing code — not to add a fifth seam casually.

## Capability map

Each capability, the seam it uses, and what it took to add it. The "Shipped in" column names the milestone that delivered it; **Selenium/Cypress/WebdriverIO live execution and generation are the notable not-yet items** (adapters complete, live use gated — see the [capability matrix](../capability-matrix.md)).

| Capability | Seam | What it takes | Shipped in |
| --- | --- | --- | --- |
| Playwright execution | Phases 6–8 | Execution + evidence-collection tooling behind `qa-run`'s plan | M4 |
| Selenium execution (live) | Phases 6–8 | Same seam, different runner adapter selected from context | Gated (adapter done) |
| Trace parsing | Analyzer | `scripts/` trace extractor in the owning skill; JSON to the report contract | M6 |
| HAR analysis | Analyzer | `scripts/` HAR analyzer, redaction on by default | M6 |
| Diff guard | Analyzer | `scripts/` guard that fails a "fix" removing assertions or adding skips | M6 |
| Locator healing | New skill + analyzer | A repair capability under `qa-fix`, backed by a locator-diff analyzer | M7 |
| REST validation | Context + new skill | `apiStyles: [rest]` already detected; `qa-api` consumes it | M8 |
| GraphQL validation | Context + new skill | `apiStyles: [graphql]` detector; `qa-api --graphql` mode | M8 |
| Performance | New skill | `qa-audit` performance mode; analyzer for Core Web Vitals | M8 |
| Accessibility | New skill | `qa-audit` accessibility mode; ruleset knowledge in `shared/domains/` | M8 |
| Frontend security | New skill | `qa-audit` security mode; client-side checks only | M8 |
| CI failure triage | Context + knowledge | `ci.provider` already detected; `shared/ci/` log knowledge feeds `qa-debug` | M7 |
| Trace Viewer integration | Analyzer + knowledge | Reads what the trace analyzer emits; no new seam | Planned |

## Worked example: adding Playwright execution (Milestone 4)

The point of the design is that this list of changes is short and local:

1. `qa-init` already records `testFramework.e2e` and `browserAutomation.tool` — **no context change needed**.
2. Add a trace/result analyzer under `skills/qa-run/scripts/` and a `Tooling` row to `qa-run`'s `SKILL.md`.
3. Fill lifecycle phases 6–8 in `qa-run`: collect (run with tracing), execute (invoke the runner), validate (parse the report). The plan `qa-run` already produces becomes the thing that gets executed.
4. The [execution-plan contract](../../skills/qa-run/contracts/execution-plan.schema.json) gains result fields; because additions are additive, the version bumps minor and no consumer breaks.

Nothing in the [router](../../skills/qa/README.md), the [context contract](context-contract.md), or the [execution lifecycle](execution-lifecycle.md) changes. That is the test of whether a seam is doing its job: new capability, old architecture.

## The obligation this creates

Because these seams are load-bearing promises, they may not be narrowed casually. Removing a context field, changing a lifecycle phase's meaning, or breaking a report contract is a major change requiring an [ADR](README.md) and a migration note. Extending them — new fields, new analyzers, new skills — is the normal, additive path and needs only the usual review.
