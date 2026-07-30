# QA Run

The pack's execution engine. Give it a request to run tests and it understands the project, chooses a strategy and scope, executes the suite, collects the evidence, and reports a normalized, framework-independent result.

This milestone **executes Playwright** — a real run through the agent's shell, with artifact collection and a normalized result. Selenium, Cypress, and WebdriverIO are detected and planned but not yet run; their adapters plug into the same engine later without changing this skill.

## Invocation

```text
/qa-run smoke
```

The skill reads the project profile, discovers the Playwright config, builds and runs the `@smoke` suite headless, collects artifacts, and reports how many passed and failed with the evidence behind it.

## What happens when a test fails

Two things, neither of which you have to ask for:

- **The failure is captured.** Every command is built with `--screenshot=only-on-failure`, `--video=retain-on-failure`, and `--trace=on-first-retry` — the failure evidence floor, written explicitly even when the project config already sets them, and never lowered by a strategy. Each failing test's screenshot, trace, and video are attached to it by `testRef` in the result; a failure with nothing on disk is recorded as an explained absence rather than omitted. A green run pays nothing for this, because `only-on-failure` writes nothing when nothing fails.
- **The failure is diagnosed.** A `failed` or `errored` run writes and validates its result, then dispatches `/qa-debug` on it automatically and shows the diagnosis with the run. One hop, forward only, to a skill that reads and explains but never edits — `/qa-fix` stays a recommendation you approve. Ask for the run only and the handoff is skipped, with the reason recorded in the result's `handoff` block. The bounds are in [ADR-0018](../../docs/architecture/ADR-0018-failure-handoff.md).

## Details

- Skill definition: [SKILL.md](SKILL.md)
- Execution plan contract: [contracts/execution-plan.schema.json](contracts/execution-plan.schema.json)
- Normalized result contract: [contracts/execution-result.schema.json](contracts/execution-result.schema.json)
- Worked examples: [examples/plan-a-run.md](examples/plan-a-run.md) and [examples/execute-playwright.md](examples/execute-playwright.md)

The engine `qa-run` is built on is the shared [execution platform](../../shared/execution/README.md); the phase model it follows is the [execution lifecycle](../../docs/architecture/execution-lifecycle.md); and how other frameworks and the analysis layer attach is in [extension points](../../docs/architecture/extension-points.md) and [ADR-0006](../../docs/architecture/ADR-0006-execution-architecture.md).
