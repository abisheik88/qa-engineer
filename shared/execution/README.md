# shared/execution/ — The Execution Platform

The framework-agnostic engine that turns a request to run tests into a real, executed run and a normalized result. Every execution skill — [`qa-run`](../../skills/qa-run/README.md) today, `qa-debug` and others later — is built on this platform, so the logic of *how to run tests well* is written once and reused.

The platform is knowledge and contracts, not a program. There is no execution binary: the AI agent is the runtime, and it executes by following these modules and running commands through its own shell. The modules make that execution deterministic, evidence-backed, and identical across the agents the pack targets. The decision to work this way is recorded in [ADR-0006](../../docs/architecture/ADR-0006-execution-architecture.md).

## The pipeline

```text
  user → /qa-run → execution engine → framework adapter → browser → artifact collector → normalized result
```

Each stage is a module below. The engine is framework-agnostic; everything framework-specific lives behind the **adapter** boundary, so a new framework plugs in without changing `qa-run` or any module here.

## Modules

| Module | Owns | Synced into execution skills |
| --- | --- | --- |
| [execution-contract.md](execution-contract.md) | The adapter interface every framework must implement | No — author-facing |
| [framework-detection.md](framework-detection.md) | Selecting the adapter, resolving conflicts, unsupported-framework behavior | No — folded into skill procedure |
| [execution-strategy.md](execution-strategy.md) | The strategies (smoke, regression, changed, single, tag, directory, failed-only, retry) | Yes |
| [command-builder.md](command-builder.md) | Turning strategy + scope + environment into a concrete command | Yes |
| [browser-launch.md](browser-launch.md) | Browser and mode lifecycle: startup, timeout, retry, cleanup, cancellation | Yes |
| [artifact-collector.md](artifact-collector.md) | The common, framework-independent artifact model and collection rules | Yes |
| [failure-handoff.md](failure-handoff.md) | The automatic red-run handoff to diagnosis: when it fires, its bounds, what is recorded | Yes |
| [report-normalization.md](report-normalization.md) | Mapping raw framework output to the normalized result contract | Yes |
| [environment-detection.md](environment-detection.md) | Local vs CI, headed vs headless defaults, base URL and environment variables | Yes |

Framework-specific adapters live under [shared/frameworks/](../frameworks/README.md); Playwright is the reference adapter for this milestone.

## Reuse

Modules marked *synced* are copied into each execution skill's `references/` by the [shared knowledge engine](../README.md) so the skill stays self-contained. `qa-run` syncs the set it needs; future execution skills sync the subset they need. Because the platform is single-sourced here, improving *how the pack runs tests* is a one-file edit that propagates to every execution skill.

## Boundaries

This platform *runs* tests and *collects* their output. It does not analyze that output — trace parsing, HAR analysis, and failure classification are the analysis layer of a later milestone, and they consume the [normalized result and artifacts](artifact-collector.md) this platform produces without knowing which framework produced them.
