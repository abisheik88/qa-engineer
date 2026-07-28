# shared/diagnostics/ — The Diagnostic Platform

One shared diagnostic engine, consumed by three skills. `qa-debug`, `qa-fix`, and `qa-report` do not each reason about failures their own way — they call this engine, and differ only in what they present. Root-cause reasoning, timeline reconstruction, prioritization, and repair planning exist here once.

Like the analysis platform it builds on, this is knowledge **and** code: the modules specify the workflow and contracts; the Python package under [lib/](../../packages/engine/README.md) implements the deterministic reasoning. The engine orchestrates the [execution](../execution/README.md), [generation](../generation/README.md), and [analysis](../analysis/README.md) platforms — it adds no parsing or classification of its own, it composes theirs. The decision is recorded in [ADR-0011](../../docs/architecture/ADR-0011-diagnostic-platform.md).

## The workflow

```text
  execution result → artifact discovery → analysis → evidence → finding
        → root cause → confidence → recommendations → repair candidates → reports
```

Every stage is deterministic and evidence-backed. A conclusion the engine cannot support from evidence is `unknown`, not a guess.

## Modules

| Module | Specifies |
| --- | --- |
| [diagnostic-contract.md](diagnostic-contract.md) | The shared inputs and outputs every diagnostic skill uses |
| [diagnostic-engine.md](diagnostic-engine.md) | How the engine composes the other platforms; what lives in code vs the skill |
| [investigation-workflow.md](investigation-workflow.md) | The end-to-end stages from result to report |
| [root-cause-analysis.md](root-cause-analysis.md) | Deterministic classification with evidence, confidence, recommendation, and owner |
| [timeline-builder.md](timeline-builder.md) | Reconstructing the ordered sequence of a run |
| [finding-prioritization.md](finding-prioritization.md) | The severity, priority, impact, owner, and effort algorithm |
| [recommendation-ranking.md](recommendation-ranking.md) | Ordering recommendations by priority and confidence |
| [repair-strategy.md](repair-strategy.md) | Deterministic repair planning — plans, never code |
| [report-aggregation.md](report-aggregation.md) | Combining results into summaries and a release-readiness call |
| [knowledge-integration.md](knowledge-integration.md) | How the engine reuses the other platforms without duplicating them |

## The three skills

| Skill | Consumes | Presents |
| --- | --- | --- |
| [qa-debug](../../skills/qa-debug/README.md) | Execution, generation, analysis results | A debug result: root cause, timeline, evidence, priority, owner, recommendations |
| [qa-fix](../../skills/qa-fix/README.md) | A debug result | A repair plan: proposed changes, risk, permission, rollback, diff-guard review — never code applied |
| [qa-report](../../skills/qa-report/README.md) | All results and diagnoses | A report: summaries, recommendations, release readiness, in Markdown/HTML-ready/JSON |

## Boundaries

The diagnostic platform reasons and recommends. It does not run tests (the execution platform), generate code (the generation platform), or parse artifacts (the analysis platform) — it orchestrates those. And it never applies a repair: `qa-fix` produces plans, gated by the diff guard, that a human or a future milestone applies.
