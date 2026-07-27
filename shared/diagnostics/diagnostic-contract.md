# The Diagnostic Contract

The shared inputs and outputs every diagnostic skill uses. Because the three skills consume one engine, they also consume one set of contracts — the differences are in presentation, not in the data. This is what lets a debug result flow into `qa-fix` and a set of results flow into `qa-report` without translation.

## Inputs

The engine reads the structured results the earlier platforms already produce — it never re-parses raw artifacts:

| Input | Produced by | Carries |
| --- | --- | --- |
| Execution result | [qa-run](../../skills/qa-run/README.md) | Status, counts, per-test outcomes, artifacts, environment |
| Generation result | [qa-generate](../../skills/qa-generate/README.md) | What was created or changed, when relevant to a failure |
| Analysis result | The [analysis platform](../analysis/README.md) | Findings in the evidence model, already classified |

When an analysis result is present, the engine trusts its classifications (the analysis platform is the deterministic classifier). When only an execution result is available, the engine derives signals from the failed tests. It never requires all three; it uses what exists and says what is missing.

## Outputs

Each skill emits a contract-validated result, all sharing the pack's output-contract envelope:

| Output | Skill | Classification is |
| --- | --- | --- |
| Debug result | qa-debug | The root-cause failure class |
| Fix result | qa-fix | The repair disposition (repairable, not-repairable, needs-investigation, blocked) |
| Report result | qa-report | The release-readiness call (ready, ready-with-risks, not-ready, insufficient-data) |

Every output carries the envelope's evidence array, so a diagnostic conclusion is always traceable to the artifacts and results behind it.

## The shared record

Underneath the three outputs is one diagnosis structure the engine produces: per-failure entries (each a root cause plus its prioritization plus affected tests), a reconstructed timeline, and ranked recommendations. `qa-debug` presents it directly; `qa-fix` adds repair plans; `qa-report` aggregates many. The record is defined by the [diagnostic engine](diagnostic-engine.md) and implemented in the engine module of the diagnostics library.

## Stability

These contracts are load-bearing across three skills. A change to the diagnosis structure or any result schema is a versioned change under the pack's rules, because all three skills and their consumers depend on the shapes holding still.
