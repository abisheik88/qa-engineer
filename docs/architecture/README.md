# Architecture

This directory is the project's architectural memory: the finalized system overview and the Architecture Decision Records (ADRs) that lock in — and explain — every significant choice.

## Contents

- [overview.md](overview.md) — the finalized architecture: layers, command surface, integration model, security model, and open validation questions.
- The specifications and the ADR log, below.
- [adr-template.md](adr-template.md) — the template every new ADR starts from.

## Specifications

Living specifications that skills and tooling conform to. Unlike ADRs, these evolve in place as the pack grows; the decision to adopt each is recorded in the ADR it links.

| Specification | Defines | Introduced by |
| --- | --- | --- |
| [ENGINEERING_PRINCIPLES.md](ENGINEERING_PRINCIPLES.md) | Immutable architecture guarantees (M10.5) | [ADR-0014](ADR-0014-evaluation-platform.md) |
| [deterministic-execution-boundary.md](deterministic-execution-boundary.md) | What deterministic code vs the LLM may own | M10.5 |
| [context-contract.md](context-contract.md) | The structure of `.qa/context.md`, the pack's shared project profile | [ADR-0004](ADR-0004-project-context.md) |
| [execution-lifecycle.md](execution-lifecycle.md) | The fixed phase model every execution skill follows | [ADR-0005](ADR-0005-execution-lifecycle.md) |
| [skill-interactions.md](skill-interactions.md) | How skills communicate: dispatch by name and artifacts as interfaces | [ADR-0002](ADR-0002-agent-skill-standard.md) |
| [extension-points.md](extension-points.md) | The seams capability plugs into (most already shipped) | [ADR-0005](ADR-0005-execution-lifecycle.md) |
| [shared/execution/](../../shared/execution/README.md) | The framework-agnostic execution platform and adapter contract | [ADR-0006](ADR-0006-execution-architecture.md) |
| [shared/generation/](../../shared/generation/README.md) | The framework-agnostic generation platform and template-category contract | [ADR-0008](ADR-0008-generation-architecture.md) |
| [shared/analysis/](../../shared/analysis/README.md) | The framework-agnostic analysis platform: analyzer contract, evidence model, failure taxonomy, redaction | [ADR-0009](ADR-0009-analysis-platform.md) |
| [shared/diagnostics/](../../shared/diagnostics/README.md) | The shared diagnostic engine: root cause, timeline, prioritization, repair planning, aggregation | [ADR-0011](ADR-0011-diagnostic-platform.md) |
| [shared/domains/](../../shared/domains/README.md) | The QA engineering knowledge base — one authoritative document per domain | [ADR-0012](ADR-0012-knowledge-base.md) |
| [docs/compatibility/framework-matrix.md](../compatibility/framework-matrix.md) | Per-framework support across execution, generation, analysis, diagnostics, reporting | [ADR-0013](ADR-0013-framework-boundary.md) |

The execution, generation, and analysis platform specifications live under [shared/](../../shared/README.md) because they are synced into skills; they are architecture nonetheless, governed by their ADRs. The analysis platform additionally has a tested Python implementation under `shared/analysis/lib/`.

## ADR log

| ADR | Title | Status |
| --- | --- | --- |
| [ADR-0001](ADR-0001-repository-structure.md) | Repository structure: single repository, single release unit | Accepted |
| [ADR-0002](ADR-0002-agent-skill-standard.md) | Author skills in the open Agent Skills standard with no compile step | Accepted |
| [ADR-0003](ADR-0003-versioning-strategy.md) | Semantic Versioning with prompt-pack semantics | Accepted |
| [ADR-0004](ADR-0004-project-context.md) | Project understanding captured once by qa-init and read by every skill | Accepted |
| [ADR-0005](ADR-0005-execution-lifecycle.md) | Execution skills follow a fixed lifecycle and emit conformant contracts | Accepted |
| [ADR-0006](ADR-0006-execution-architecture.md) | Framework-agnostic execution through adapters, with the agent as runtime | Accepted |
| [ADR-0007](ADR-0007-normalized-result.md) | The normalized execution result is the interface between execution and analysis | Accepted |
| [ADR-0008](ADR-0008-generation-architecture.md) | Generation is discovery-first, non-destructive, and convention-matching | Accepted |
| [ADR-0009](ADR-0009-analysis-platform.md) | A deterministic, framework-agnostic analysis platform, in code | Accepted |
| [ADR-0010](ADR-0010-multi-framework-foundation.md) | The multi-framework foundation, proven by Selenium | Accepted |
| [ADR-0011](ADR-0011-diagnostic-platform.md) | One diagnostic engine, three skills | Accepted |
| [ADR-0012](ADR-0012-knowledge-base.md) | The QA knowledge base is one authoritative document per domain | Accepted |
| [ADR-0013](ADR-0013-framework-boundary.md) | The framework adapter boundary is permanent | Accepted |
| [ADR-0014](ADR-0014-evaluation-platform.md) | The evaluation platform is a core architectural component | Accepted |

## What an ADR is

An ADR is a short document that captures one architecturally significant decision: the context that forced it, the decision itself, the alternatives that were rejected, and the consequences — good and bad — of living with it. ADRs are immutable history: once accepted, a record is never edited into a different decision. Changing course means a new ADR that supersedes the old one, so the reasoning trail stays intact.

## When an ADR is required

Write an ADR when a change:

- alters the canonical skill format, directory contract, or installation model;
- adds, removes, or renames a user-facing command;
- weakens or reshapes a security guarantee in [SECURITY.md](../../SECURITY.md);
- changes versioning, release, or support semantics;
- introduces a new runtime requirement or external dependency.

Routine content work — editing a knowledge module, improving a skill's wording, fixing documentation — does not need an ADR.

## Process

1. Copy [adr-template.md](adr-template.md) to `ADR-NNNN-short-kebab-title.md`, taking the next number in sequence.
2. Open a pull request with status `Proposed`. The pull request discussion is the review.
3. On merge approval, set the status to `Accepted` and add the record to the log above.
4. To reverse a decision, write a new ADR and mark the old one `Superseded by ADR-NNNN`.

Valid statuses: `Proposed`, `Accepted`, `Superseded by ADR-NNNN`, `Rejected` (kept for the record when a proposal is declined after substantial discussion).
