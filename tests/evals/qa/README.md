# Eval cases: qa (router)

Cases that verify the [router](../../../skills/qa/README.md) dispatches correctly. The router emits no contract, so its evals are almost entirely deterministic: given a request, did it route to the expected skill, ask the right number of questions, and avoid doing the work itself?

> **Status:** router cases below await the live-agent runner (routing is a behavioral property with no output contract to score). The deterministic scorer already runs for the six output-emitting skills — see the [framework README](../README.md).

## Planned cases

| Case | Input | Deterministic assertion |
| --- | --- | --- |
| Clear failure routes to debug | "the checkout spec went red in CI" | Routes to `qa-debug`; performs no analysis itself |
| Missing context routes to init first | run request, no `.qa/context.md` | Routes to `qa-init` before the requested skill |
| Ambiguous request asks once | "look at my API tests" | Asks exactly one question; does not dispatch before the answer |
| General question is answered, not routed | "smoke vs regression?" | Answers inline; routes to no work skill |
| Unknown request degrades honestly | an off-topic request | Lists available commands; forces no route |

## What is checked

- **Routing target:** the case asserts the exact skill named in the handoff.
- **Question budget:** at most one clarifying question (a core router guardrail).
- **No work performed:** the router's transcript shows a dispatch, not an attempt at the task.

Rubric (advisory): was the one-line routing rationale accurate and useful?
