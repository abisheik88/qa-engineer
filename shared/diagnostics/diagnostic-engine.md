# The Diagnostic Engine

How the one engine composes the other platforms into a diagnosis, and what lives in code versus in the skill. The rule that defines the engine: reasoning that is deterministic is code; judgment that is contextual is the skill. Neither is duplicated across the three diagnostic skills.

## What the engine does, in code

The `diagnostics` package (in lib/) implements the deterministic reasoning, reusing `analysis`:

| Step | Module | Reuses |
| --- | --- | --- |
| Classify the failure into a root cause | `root_cause` | `the shared taxonomy` |
| Assign severity, priority, impacts, owner, effort | `prioritization` | the taxonomy classes |
| Reconstruct the ordered timeline | `timeline` | the evidence in findings |
| Plan a repair (never code) | `repair` | the taxonomy; the diff guard's guarantees |
| Orchestrate and rank | `engine` | all of the above |

`engine.diagnose(...)` produces the shared diagnosis; `engine.plan_repairs(...)` turns it into repair plans for qa-fix; `engine.summarize(...)` aggregates it for qa-report. The same inputs always yield the same diagnosis.

## What the skill does, in judgment

The engine produces structured facts; the skill turns them into something a person reads and acts on. That is where the three skills differ:

- **qa-debug** narrates the root cause, walks the timeline, and states who should act — presenting the engine's diagnosis as an investigation.
- **qa-fix** takes the engine's repair plans and expresses them as concrete, reviewable proposals, gated by the diff guard, awaiting permission.
- **qa-report** aggregates diagnoses across a run into audience-specific summaries and a release call.

The narrative, the phrasing, the audience framing — these are the agent's judgment, guided by the skill. The classification, the priority score, the timeline order, the repairability — these are the engine's determinism. Keeping the line there is what makes diagnoses both trustworthy (the facts are computed) and useful (the presentation is human).

## Composition, not duplication

The engine calls the analysis platform for classification and evidence, the execution result for outcomes and artifacts, and the generation result for context — it re-implements none of them (knowledge-integration). If the engine ever needs to parse an artifact or classify a message itself, that logic belongs in the analysis platform and is called from here — the engine orchestrates, it does not parse.

## Bundling

Because the diagnostic skills run the engine in a consumer's repository, the `analysis` and `diagnostics` packages are bundled into each skill's `scripts/lib/` from their canonical source in `shared/`. The bundle is a build artifact produced by the bundler; the source of truth is `shared/`. See ADR-0011.
