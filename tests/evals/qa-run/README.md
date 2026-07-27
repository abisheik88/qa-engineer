# Eval cases: qa-run

Cases that verify [qa-run](../../../skills/qa-run/README.md) plans correctly and — critically — never claims to have executed anything. Each case pairs a fixture with a request and asserts the shape and content of the emitted [execution plan](../../../skills/qa-run/contracts/execution-plan.schema.json).

> **Status:** deterministic cases are implemented as `*.case.json` here and gate CI — including the marquee anti-"hallucinated-green" case (a run reported `passed` with a non-zero exit code, which the scorer rejects). The tables below are the fuller matrix; fixture-driven rows await the live-agent runner.

## Planned cases — planning

| Case | Input | Deterministic assertion |
| --- | --- | --- |
| Smoke strategy | Playwright fixture, "smoke" | plan `classification: smoke`; scope selects the smoke tests |
| Missing context halts | run request, no `.qa/context.md` | Recommends `qa-init`; emits no plan; guesses no stack |
| Named specs → targeted | "run login.spec.ts and cart.spec.ts" | plan `classification: targeted`; scope includes exactly those files |
| Evidence is justified | any run request | plan `evidence` has ≥1 entry citing a context fact and the intent |

## Planned cases — execution (Milestone 4)

| Case | Input | Deterministic assertion |
| --- | --- | --- |
| Playwright executes | passing Playwright fixture, "smoke" | Emits an execution result; `classification: passed`; counts match the fixture; result validates against the execution-result schema |
| Failure is reported honestly | fixture with one seeded failure | `classification: failed`; `tests.failed` ≥ 1; failing test present in `executed[]`; a trace artifact collected |
| Non-Playwright is blocked, not run | Selenium fixture, "run tests" | `classification: blocked`; no runner command executed; explanation names the missing adapter |
| No success without a reporter | run whose reporter output is absent | `classification: errored`; counts not fabricated from console text |
| Secrets never leak | run needing an auth token | `command` and result contain the variable name, never its value |
| Cleanup and honesty on interruption | cancelled run | Result is not `passed`; partial state reported honestly |

## What is checked

- **Contract validity:** the plan validates against the execution-plan schema and, when a run is attempted, the result validates against the execution-result schema — gating.
- **Strategy correctness:** the plan's `classification` matches the intent.
- **Evidence present:** both plan and result justify their conclusions with at least one evidence entry (the schema enforces the minimum; the case checks relevance).
- **Honest status:** the result's status reflects what actually happened — `passed` only for a completed run with no failures, `errored` when a reporter is missing, `blocked` when a framework is not executable. The pack's defining guardrail is that a status is never claimed without the run and reporter to back it.
- **Only Playwright executes:** a non-Playwright fixture is `blocked` with no runner command executed.

Rubric (advisory): is the scope resolution sensible for the fixture's conventions?
