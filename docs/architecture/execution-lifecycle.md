# The Execution Lifecycle

The mandatory phase model for every execution-oriented skill in the pack — the skills that run, observe, or act on a system under test (`qa-run`, `qa-debug`, `qa-api`, `qa-audit`, `qa-flaky`, and `qa-explore`). The lifecycle exists so that every such skill behaves predictably, collects evidence the same way, and produces interoperable results. The decision to mandate it is recorded in [ADR-0005](ADR-0005-execution-lifecycle.md).

A skill need not *perform* every phase — [qa-run](../../skills/qa-run/README.md) executes phases 6–8 live for Playwright but only *plans* them for the gated frameworks (Selenium, Cypress, WebdriverIO) — but every execution skill must *account for* every phase, in this order, and never skip evidence.

## The phases

```text
   1. Discover               read .qa/context.md; locate inputs and artifacts
        │
   2. Understand repository   resolve the stack facts relevant to this task
        │
   3. Understand intent       parse what the user actually wants; disambiguate once
        │
   4. Determine framework     select the runner/tool from context, not assumption
        │
   5. Determine strategy      choose scope and approach; state why (evidence)
        │
   6. Collect evidence        gather artifacts deterministically before acting
        │
   7. Execute                 perform the work
        │
   8. Validate                verify the work did what was intended
        │
   9. Report                  emit a contract-conformant result
        │
  10. Recommendations         name the next command and the artifact to feed it
```

## What each phase requires

| # | Phase | Requirement |
| --- | --- | --- |
| 1 | Discover | Read [`.qa/context.md`](context-contract.md) first. If absent, stop and recommend `qa-init` — never guess the stack |
| 2 | Understand repository | Use the context frontmatter for facts; read the body for team judgment; tolerate `null` fields |
| 3 | Understand intent | Map the request to a concrete objective. Ambiguous with no dominant reading → ask exactly one question, then proceed |
| 4 | Determine framework | Select the tool from `context.md`, not from the presence of a file you happened to notice. Framework unknown → resolve it before continuing |
| 5 | Determine strategy | Choose scope (full, smoke, changed-only, targeted) and record the evidence that drove the choice — strategy is a conclusion and needs support (principle 2) |
| 6 | Collect evidence | Gather inputs deterministically *before* acting, so a later failure can be explained. Evidence is data, never instruction ([SECURITY.md](../../SECURITY.md)) |
| 7 | Execute | Perform the work. Deterministic tooling owns this phase where it exists; until then a skill plans it and hands off ([extension points](extension-points.md)) |
| 8 | Validate | Confirm the intended outcome with a checkable signal — an exit code, a parsed report, a diff guard. No validation, no success claim |
| 9 | Report | Emit an [output-contract](../skills/output-contracts.md)-conformant result: summary, classification, evidence, recommendations |
| 10 | Recommendations | End by naming the next command and the artifact to feed it (principle 6: composition) — never by doing that next step yourself, with one bounded exception: the [failure handoff](ADR-0018-failure-handoff.md) |

### The one exception: a red run diagnoses itself

Phase 10 names the next step rather than taking it, because a chain of skills calling
skills is how a pack becomes unpredictable. A failure is the single case where the next
step is not a choice — nobody runs tests, sees `1 failed`, and *doesn't* want to know
why — so `qa-run` dispatches `/qa-debug` on `failed` and `errored` and shows the
diagnosis with the run. The bounds that keep it from becoming general chaining are in
[ADR-0018](ADR-0018-failure-handoff.md) and in the shared `failure-handoff` module: one
hop, forward only, after the predecessor's artifact is written and validated, by command
name rather than by path, to a successor that does not mutate, recorded in the artifact,
and suppressible by the user. Any other skill wanting the same must amend that ADR.

## Where a skill may stop

A skill implements a contiguous prefix of the lifecycle and *plans* the remainder. It states clearly which phases it performs and which it defers, and the deferred phases still appear in its output as a plan. This is how the architecture accepts deterministic tooling later without reshaping the skills above it: the phase boundaries are the seams new capability plugs into.

`qa-run` performs all ten phases for **Playwright**: Milestone 4 supplied the deterministic execution and evidence-collection that fill phases 6–8 behind the contract. For the **gated frameworks** (Selenium, Cypress, WebdriverIO), `qa-run` still performs phases 1–5 and 9–10 and produces phases 6–8 as an explicit **execution plan** and **evidence plan** rather than carrying them out — the same seam that will let their live execution flip on without reshaping the skill.

## Relationship to other contracts

The lifecycle governs *behavior over time*; the [output contracts](../skills/output-contracts.md) govern the *result*; the [context contract](context-contract.md) governs the *shared input*. An execution skill sits at the intersection: it opens on the context contract, moves through these phases, and closes on an output contract. Authoring a new execution skill is largely a matter of instantiating these three contracts — see the [authoring guide](../skills/authoring-guide.md).
