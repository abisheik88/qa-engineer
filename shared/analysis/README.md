# shared/analysis/ — The Analysis Platform

The deterministic infrastructure that turns raw test artifacts into structured, evidence-backed findings. Every future diagnostic skill — `qa-debug`, `qa-fix`, `qa-report` — is built on this platform, so that a diagnostic decision is never a guess when an artifact can be parsed. The platform is framework-agnostic; framework specifics live in [shared/frameworks/](../frameworks/README.md) and depend on it.

Unlike the pack's other platforms, this one is knowledge **and** code. The modules here specify the contracts; the Python package under [lib/](lib/README.md) implements them, deterministically and with standard library only. The decisions behind it are recorded in [ADR-0009](../../docs/architecture/ADR-0009-analysis-platform.md) and [ADR-0010](../../docs/architecture/ADR-0010-multi-framework-foundation.md).

## Principles

- **Evidence before conclusions.** Every finding cites the artifact it came from; a finding without evidence is not emitted.
- **Deterministic over probabilistic.** Anything parseable is parsed by tested code, never inferred by a model.
- **Unknown over incorrect.** When signals are insufficient, the result is `unknown` at low confidence — never a confident guess.
- **Redact at the boundary.** Secrets and PII are masked as artifacts are read, before anything is exposed.

## Modules (specifications)

| Module | Specifies |
| --- | --- |
| [analysis-contract.md](analysis-contract.md) | The analyzer contract: discover, validate, parse, normalize, find, evidence, recommend |
| [artifact-discovery.md](artifact-discovery.md) | Locating artifacts across runs, workers, and shards; missing/partial/corrupted |
| [artifact-validation.md](artifact-validation.md) | Confirming an artifact is usable before trusting it |
| [evidence-model.md](evidence-model.md) | The structure every finding carries |
| [finding-classification.md](finding-classification.md) | How signals become a classified finding |
| [failure-taxonomy.md](failure-taxonomy.md) | The canonical failure classes, their rules, evidence, and actions |
| [confidence-model.md](confidence-model.md) | How confidence is assigned and calibrated |
| [redaction-policy.md](redaction-policy.md) | What is redacted, and that it happens before exposure |
| [recommendation-guidelines.md](recommendation-guidelines.md) | How findings become actionable, safe recommendations |

## Implementation

The [lib/](lib/README.md) directory holds `analysis` (the framework-agnostic core) and its tests. Framework adapters ([Playwright](../frameworks/playwright/README.md), [Selenium](../frameworks/selenium/README.md)) add only what is framework-specific and reuse this core for the evidence model, taxonomy, redaction, and contract validation.

## Boundaries

This platform *analyzes* artifacts and *validates* contracts. It does not produce user-facing diagnoses — that is the diagnostic skills of a later milestone, which consume these findings. It runs nothing and fixes nothing; it reads, parses, and judges.
