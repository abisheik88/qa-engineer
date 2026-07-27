# Skill Interactions

How the pack's skills fit together: who calls whom, who owns what, and where data flows. The rules here are the concrete application of principle 6 ([composition over chaining](../engineering-principles.md)) and principle 5 ([contracts over conventions](../engineering-principles.md)).

## The two ways skills interact

Skills interact through exactly two mechanisms, and no others:

1. **Dispatch by name.** The [router](../../skills/qa/README.md) selects a skill and hands the request to it *by command name*. No skill loads another skill's files — sibling paths are not guaranteed to exist at runtime.
2. **Artifacts as interfaces.** Skills exchange data through files with defined contracts: the shared [`.qa/context.md`](context-contract.md), and the per-run reports under `qa-artifacts/`. A skill consumes another's output by reading its artifact and trusting its [contract](../skills/output-contracts.md) — never by knowing how it was produced.

Everything below is an application of these two mechanisms.

## Current wiring (QA Core Engine)

```text
        user
          │  request
          ▼
        ┌─────┐   dispatch by name        ┌──────────┐
        │ qa  │ ────────────────────────► │ qa-init  │  writes .qa/context.md
        └─────┘                           └──────────┘
          │                                     │
          │                                     ▼
          │                              .qa/context.md   (shared context)
          │                                     │  read first
          │             dispatch by name        ▼
          └───────────────────────────────► ┌──────────┐
                                             │  qa-run  │  reads context,
                                             └──────────┘  emits execution plan
                                                   │
                                                   ▼
                                          qa-artifacts/qa-run-*.json
```

- `qa` never touches `.qa/context.md` to do work; it may read it only to route better. It produces no artifact — its output is a dispatch.
- `qa-init` is the only writer of `.qa/context.md`. Everyone else reads it.
- `qa-run` reads `.qa/context.md` and writes an execution-plan artifact. It does not call `qa-init`; if context is missing, it recommends `qa-init` and stops.

## Full wiring (current)

All twelve commands are implemented and wired. The shape did not change as they were added — every skill attaches to the same two seams (the router dispatches to it; it reads `.qa/context.md` and exchanges `qa-artifacts/`):

```text
  user → qa ─┬─► qa-init     writes  .qa/context.md
             ├─► qa-run      reads context → run plan / Playwright execution
             ├─► qa-generate reads context → new tests (Playwright live)
             ├─► qa-debug    reads run artifacts → failure classification
             ├─► qa-fix      reads debug artifacts → repair plan (no code edits)
             ├─► qa-review / qa-audit / qa-api / qa-flaky   reads context → findings
             ├─► qa-explore  live URL session → explore-result + screenshots
             └─► qa-report   reads any qa-artifacts/* → summary
```

Handoffs follow the artifacts: `qa-run` produces a result a human or `qa-debug` can consume; `qa-debug` produces a classification `qa-fix` can consume; `qa-explore` produces a product-QA report a human or `qa-report` can summarize; `qa-report` consumes anything. No skill in this chain calls the next — each ends with a [recommendation](execution-lifecycle.md) naming it.

## Responsibilities and ownership

| Skill | Owns | Never does |
| --- | --- | --- |
| [qa](../../skills/qa/README.md) | Intent classification and dispatch | Any QA work; more than one clarifying question; dispatch by path |
| [qa-init](../../skills/qa-init/README.md) | Detecting the stack; writing `.qa/context.md` | Running or generating tests; overwriting the human-authored body |
| [qa-run](../../skills/qa-run/README.md) | Planning and executing suite runs | Exploring an arbitrary URL as product QA; repairing tests |
| [qa-explore](../../skills/qa-explore/README.md) | Live full-spectrum product QA and evidence report | Executing the project's automated suite; auto-fixing product code |
| [qa-audit](../../skills/qa-audit/README.md) | Narrow page audits from artifacts / scans | Full exploratory product QA with attached cases |

Each artifact has exactly one owning producer. `.qa/context.md` is owned by `qa-init`; each `qa-artifacts/<skill>-*.json` is owned by the skill named in it. Consumers may read any artifact; they may not write another skill's artifact.

## Extension points

New skills and new capabilities attach without reshaping this diagram — the seams are the router, the context contract, and the artifact contracts. How each planned capability plugs in is specified in [extension-points.md](extension-points.md).
