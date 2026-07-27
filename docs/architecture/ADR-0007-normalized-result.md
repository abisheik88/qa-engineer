# ADR-0007: The normalized execution result is the interface between execution and analysis

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

The execution engine ([ADR-0006](ADR-0006-execution-architecture.md)) runs tests; later milestones analyze the outcome — `qa-debug` classifies failures, `qa-report` summarizes, `qa-fix` repairs. Those analysis skills must work across every framework the pack runs. If each of them read Playwright's `test-results` layout, Selenium's output, and Cypress's reports directly, every analyzer would carry a per-framework decoder, and adding a framework would mean touching every analyzer — the coupling ADR-0006 was designed to prevent, reintroduced one layer up.

The question this milestone had to settle, while the shape of the run output was still being designed, is what the analysis layer will actually consume.

## Decision

Execution produces one **normalized, framework-independent result** and a **common artifact model**, and that is the sole interface the analysis layer consumes. Nothing downstream reads a framework's native output.

- **The result is normalized at the source.** The [report-normalization module](../../shared/execution/report-normalization.md) maps each framework's machine-readable reporter into one result shape — status, counts, per-test outcomes, environment, evidence — defined by [`execution-result.schema.json`](../../skills/qa-run/contracts/execution-result.schema.json). Status is computed from the reporter and exit code, never inferred from console text.
- **Artifacts use one model.** Every output (trace, video, screenshot, report, logs) is described by the [common artifact model](../../shared/execution/artifact-collector.md) with a normalized `type`; the producing framework is recorded as provenance only, and nothing downstream branches on it.
- **Framework is provenance, not logic.** The result records which framework ran so a human can trace it, but analyzers key on normalized fields and artifact `type`, so they are written once for all frameworks.
- **The result conforms to the pack's output-contract envelope.** It is a finding (did the run pass?) backed by evidence, consistent with the [output-contract standard](../skills/output-contracts.md), so the same review, versioning, and validation apply.

## Alternatives considered

- **Analyzers read native framework output.** Rejected: pushes per-framework decoding into every analyzer, so each new framework touches every analysis skill — the coupling ADR-0006 removed from execution would return in analysis. Normalizing once, at the point that already knows the framework, is strictly cheaper.
- **A per-framework result contract.** Rejected: `qa-report` and `qa-debug` would need a variant per framework, and cross-framework reporting (one summary over a mixed suite) would be impossible. One contract is what makes the analysis layer framework-blind.
- **Defer the result shape until the analysis milestone.** Rejected: the shape is a contract the execution engine must emit *now*, and designing it against the known needs of debugging and reporting is what lets those skills be built later without renegotiating execution. Designing it late would force a breaking change to a shipped contract.

## Consequences

- The analysis layer (`qa-debug`, `qa-report`, `qa-fix`) can be built against one result and one artifact model, framework-blind by construction — the payoff is deferred to those milestones but the commitment is made here.
- The normalized result and artifact model are now load-bearing contracts. Adding a framework must map onto them without widening them; a genuinely new artifact kind or result field is a deliberate, versioned change under [ADR-0003](ADR-0003-versioning-strategy.md), not an ad-hoc addition.
- Normalization depends on a machine-readable reporter always being present; the [command builder](../../shared/execution/command-builder.md) guarantees it, and a run without one is `errored` rather than reconstructed from human output.
- A fully deterministic normalizer (a script that maps a reporter to the result without an agent in the loop) is a candidate hardening for the analysis milestone; the mapping it would implement is already specified, so the hardening is additive.
- Some redundancy exists between the artifact model documented in prose and enforced in the schema; this is the pack's standard doc-explains / schema-enforces split, kept consistent by review.
