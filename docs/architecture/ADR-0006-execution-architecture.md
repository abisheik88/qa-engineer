# ADR-0006: Framework-agnostic execution through adapters, with the agent as runtime

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

The pack must run tests across four frameworks (Playwright, Selenium, Cypress, WebdriverIO) and ship one working framework now without stranding the others. Two questions had to be answered together: how does execution stay framework-neutral so `qa-run` is written once, and what actually runs the tests, given the pack is instructions for an AI agent rather than a program.

A naive design would put Playwright specifics directly in `qa-run`. That makes the second framework a rewrite, violates principle 3 ([skills stay small](../engineering-principles.md)) by turning `qa-run` into a multi-framework switch, and gives the later analysis layer no stable surface. A separate execution binary would answer "what runs the tests" but contradicts [ADR-0002](ADR-0002-agent-skill-standard.md) (the pack is standard skills, no compiled runtime) and the vendor-neutral, no-install goals.

## Decision

Execution is framework-agnostic and organized around a **framework adapter contract**, and the **AI agent is the runtime**.

- **The engine is knowledge and contracts, not code.** The shared [execution platform](../../shared/execution/README.md) defines strategy, command building, browser lifecycle, artifact collection, normalization, and environment decisions in framework-neutral terms.
- **Frameworks plug in as adapters.** Each framework answers the six responsibilities of the [adapter contract](../../shared/execution/execution-contract.md) in a module under [shared/frameworks/](../../shared/frameworks/README.md). Playwright is the reference adapter; the others implement the same contract later.
- **`qa-run` never names a framework in its procedure.** It asks the adapter, in order, what is runnable, what command to run, how to launch, where the artifacts are, and what the normalized result is. Adding a framework changes only its adapter module and what `qa-run` syncs — never `qa-run`'s logic.
- **The agent executes through its own shell.** There is no execution binary. `qa-run` guides the agent to build a command and run it; the modules make that execution deterministic, evidence-backed, and identical across the agents the pack targets.
- **Unsupported is honest, not partial.** A framework whose adapter is incomplete is detected, planned, and reported `blocked`; it is never partially run.

## Alternatives considered

- **Playwright logic embedded in `qa-run`.** Rejected: the second framework becomes a rewrite, `qa-run` becomes an unversionable multi-framework switch, and the analysis layer inherits framework-specific output. The adapter boundary costs one indirection and buys single-framework isolation.
- **A bundled execution binary or MCP execution server.** Rejected: contradicts the no-compiled-runtime decision in ADR-0002, reintroduces an install and a process to manage, and hides execution behind a tool call where the pack's guardrails and evidence discipline cannot reach it. The agent-as-runtime keeps execution inside the skill, where the guardrails live.
- **A registered-plugin system for frameworks.** Rejected as category error: there is no engine process to register plugins with. Adapters are knowledge modules synced into skills, which is the mechanism the pack already has.

## Consequences

- `qa-run` is framework-neutral and stays small; the second, third, and fourth frameworks are additive adapter modules, provable by the fact that they require zero change to `qa-run`.
- "Execution reliability" rests on the quality of the modules and the agent following them, not on a compiled runtime. This is the honest trade: no install and full guardrail coverage, in exchange for reliability that must be earned through rigorous instructions and, later, the [evaluation harness](../../tests/evals/README.md) rather than assumed from a binary.
- Because there is no execution process, timeouts, cleanup, and cancellation are responsibilities the [browser-launch module](../../shared/execution/browser-launch.md) places on the agent's shell handling — they are specified as rules, and their enforcement is a thing evals must check.
- The adapter contract is now load-bearing: changing the six responsibilities is a major change requiring a superseding ADR.
- Multi-framework execution and remote/grid targets are future work that attaches at the adapter boundary, per [extension-points.md](extension-points.md).
