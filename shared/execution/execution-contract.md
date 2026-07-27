# The Framework Adapter Contract

The interface every framework adapter implements so the execution engine stays framework-agnostic. `qa-run` and future execution skills talk to *this contract*, never to a specific framework. Playwright is the reference adapter ([shared/frameworks/playwright/](../frameworks/playwright/README.md)); Selenium, Cypress, and WebdriverIO implement the same contract in later milestones and plug in without changing any execution skill.

## The six responsibilities

An adapter for a framework provides answers to six questions. Each is documented as knowledge the agent applies — not code it calls.

| # | Responsibility | Input | Output |
| --- | --- | --- | --- |
| 1 | **Detect and confirm** | The framework recorded in `.qa/context.md` | Confirmation the framework is present and runnable, or an honest "cannot run" |
| 2 | **Discover configuration** | The repository | Config files, defined projects, the runnable test set |
| 3 | **Build the command** | Strategy, scope, browser, environment | The exact command to run, plus the reporter flags that produce machine-readable output |
| 4 | **Launch and run** | The built command | The run, executed through the agent's shell, with timeout and cleanup |
| 5 | **Collect artifacts** | The completed run | Artifacts located and described in the [common artifact model](artifact-collector.md) |
| 6 | **Normalize the result** | Raw framework output | A [normalized execution result](report-normalization.md), framework-independent |

The engine owns the *sequence* (the [execution lifecycle](../../docs/architecture/execution-lifecycle.md)); the adapter owns the *framework specifics* at each step. Nothing framework-specific may leak above the adapter boundary.

## What "implementing the contract" means

A framework is supported when its adapter answers all six for the execution paths in scope. Playwright answers all six for local Chromium/Firefox/WebKit execution this milestone. A framework whose adapter is incomplete is **detected but not executable**: `qa-run` plans the run and stops, explaining that execution for that framework is not yet available (see [framework-detection.md](framework-detection.md)). This is how the pack ships one working framework without pretending to run the others.

## Why an adapter, not a plugin system

The adapters are knowledge modules, not registered code, because the runtime is the agent, not a program ([ADR-0006](../../docs/architecture/ADR-0006-execution-architecture.md)). "Adding an adapter" means authoring a framework module under `shared/frameworks/` that answers the six responsibilities, and syncing it into the execution skills. No engine code changes, because there is no engine code — there is a contract and the knowledge that satisfies it.

## The boundary in practice

When `qa-run` needs to run tests, it does not ask "is this Playwright?". It asks the adapter, in order: what is runnable, what command realizes this strategy, how do I launch it, where are the artifacts, what is the normalized result. Every framework answers the same six questions in its own module. That symmetry is what lets `qa-run` be written once and never mention a framework by name in its procedure.
