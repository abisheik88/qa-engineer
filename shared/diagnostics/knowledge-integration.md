# Knowledge Integration

How the diagnostic engine reuses the pack's other platforms instead of duplicating them. The engine is orchestration: it is valuable precisely because it does not re-implement execution, generation, or analysis — it composes them.

## What the engine reuses

| From | The engine uses | It does not |
| --- | --- | --- |
| [Execution platform](../execution/README.md) | The normalized execution result — status, counts, per-test outcomes, artifacts, environment | Run tests, or re-read raw runner output |
| [Analysis platform](../analysis/README.md) | Findings in the evidence model, already classified; the failure taxonomy; the diff guard | Parse artifacts, or re-classify what analysis classified |
| [Generation platform](../generation/README.md) | The generation result, for context on recently created or changed tests | Generate or modify code |
| [Project context](../../docs/architecture/context-contract.md) | Framework, conventions, and ownership hints from `.qa/context.md` | Re-detect the stack |

## The rule

If the engine finds itself wanting to parse an artifact, classify a message, or run a test, that logic belongs in another platform and is called from here. The engine's own code is confined to reasoning that is genuinely diagnostic: turning findings into prioritized root causes, reconstructing timelines, planning repairs, and aggregating reports. This is why the diagnostics library depends on `qa_analysis` and adds no parsing of its own.

## Why this matters

Three payoffs follow from strict reuse:

- **No drift.** The failure taxonomy, evidence model, and diff guard have one definition, in the analysis platform. The engine cannot disagree with analysis about what a `locator-failure` is, because it uses the same classifier.
- **Framework neutrality for free.** Because the engine consumes the *normalized* execution result and analysis findings, it is framework-blind — a Playwright failure and a Selenium failure reach it in the same shape, so `qa-debug` diagnoses both identically.
- **A small engine.** Orchestration is far less code than re-implementation, so the engine is reviewable and its determinism is testable.

## The composition, end to end

A diagnosis is the other platforms' outputs, reasoned over: qa-run's execution result and the analysis platform's findings flow in; root-cause, prioritization, timeline, and repair reasoning apply; a debug result, repair plan, or report flows out. Every arrow in that chain is a reuse, not a reimplementation — which is the whole design of the pack, realized at the diagnostic layer.
