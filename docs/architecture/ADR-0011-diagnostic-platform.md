# ADR-0011: One diagnostic engine, three skills

- **Status:** Accepted
- **Date:** 2026-07-19
- **Superseded in part by [ADR-0012](ADR-0012-node-engine.md):** the engine is Node, and it is bundled as one dependency-free package rather than as Python packages with separately copied package data. The architecture this record establishes — one engine, consumed by the diagnostic skills, bundled into each rather than referenced across directories — is unchanged.

## Context

The pack needs to debug failures, plan fixes, and report on runs. The obvious implementation is three skills — `qa-debug`, `qa-fix`, `qa-report` — and the obvious mistake is to let each reason about failures its own way. Root-cause classification, timeline reconstruction, prioritization, and the release-readiness call would then exist three times, drift apart, and disagree: `qa-debug` might call a failure a product bug while `qa-report` counts it as flaky. The value of the milestone is not three skills; it is one trustworthy reasoning process presented three ways.

The pack already has the pieces this reasoning consumes — the execution result, the analysis platform's classified findings, the generation result. What was missing was the orchestration layer that turns them into a diagnosis, and a decision about where that orchestration lives.

## Decision

Failure reasoning lives once, in a shared **diagnostic engine**, consumed by three thin skills that differ only in presentation.

- **One engine.** The `shared/diagnostics/` platform — knowledge modules plus the `qa_diagnostics` Python package — implements root-cause analysis, timeline reconstruction, prioritization, recommendation ranking, and repair planning. It is deterministic: the same inputs yield the same diagnosis.
- **Reasoning is code; presentation is the skill.** What can be computed (classification, priority, timeline order, repairability, release readiness) is in the engine and is unit-tested. What is contextual (the narrative, the audience framing) is the skill's judgment over the engine's output. The line between them is what makes diagnoses both trustworthy and readable.
- **The engine orchestrates; it does not duplicate.** It reuses the analysis platform's taxonomy, evidence model, and diff guard, the execution result, and the generation result. If it ever needs to parse or classify, that logic belongs in the analysis platform and is called from here ([knowledge-integration](../../shared/diagnostics/knowledge-integration.md)).
- **Three skills, one set of contracts.** `qa-debug` presents the diagnosis (debug result), `qa-fix` turns it into a repair plan (fix result — plans, never code), `qa-report` aggregates it (report result). All three share the pack's output-contract envelope, and a debug result flows into `qa-fix` and into `qa-report` without translation.
- **The engine is bundled, not referenced across directories.** Because the skills run the engine in a consumer's repository, `qa_analysis` and `qa_diagnostics` are bundled into each skill's `scripts/lib/` from their canonical source in `shared/`. The bundle is a build artifact (git-ignored, produced by the bundler); the source of truth stays in `shared/`, and CI proves each skill bundles and imports.

## Alternatives considered

- **Three self-contained skills, each with its own reasoning.** Rejected: guarantees drift and contradiction between skills, triples the logic to maintain, and makes the pack's diagnoses untrustworthy the moment two skills disagree. The shared engine exists precisely to prevent that.
- **All reasoning in the skill prompts, no engine code.** Rejected: classification, prioritization, and readiness are deterministic and must be repeatable and testable. Prompt-only reasoning is probabilistic and unverifiable — the opposite of what a diagnostic platform must be. The engine is code for the same reason the analysis platform is ([ADR-0009](ADR-0009-analysis-platform.md)).
- **Reference the engine from `shared/` at runtime instead of bundling.** Rejected: installed skills must be self-contained, and a `../shared/` path does not exist once a skill is installed into an agent's directory. Bundling the engine into the skill is the only way it runs standalone; the bundler keeps the copy honest.
- **One mega-skill for debug + fix + report.** Rejected: it violates principle 3 (skills stay small) and conflates three genuinely different jobs and outputs. Three skills over one engine is the right decomposition — small skills, shared reasoning.

## Consequences

- The three diagnostic skills are thin and cannot disagree about a failure, because they share the classification, prioritization, and readiness logic. Adding a fourth consumer later (a dashboard, a bot) reuses the same engine.
- `qa-fix` is safe by construction: it plans, it does not edit, and any eventual edit is gated by the diff guard. The pack gains a repair capability without the risk of automated code changes.
- The pack now bundles Python into skills. CI gains a bundle check (`scripts/bundle_python.py --check`) proving each diagnostic skill bundles and imports the engine with standard-library Python only; the engine's own tests run in the analysis Python job.
- The taxonomy gained two classes (`authorization`, `flaky`) to serve diagnosis; this was an additive change to the analysis taxonomy, and the analysis tests and docs were updated to match.
- The diagnosis structure and the three result contracts are load-bearing across the skills; changing them is a versioned change. The engine's determinism is the guarantee that makes the whole platform trustworthy, so it is protected by unit tests and must stay computed, not inferred.
