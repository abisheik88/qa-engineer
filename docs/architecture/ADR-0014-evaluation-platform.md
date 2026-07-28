# ADR-0014: The evaluation platform is a core architectural component

- **Status:** Accepted
- **Date:** 2026-07-24

## Context

By Milestone 10 the pack ships a two-layer evaluation platform
([docs/evaluation-platform.md](../evaluation-platform.md)): a deterministic gate
that scores skill outputs against JSON Schema contracts and assertion operators,
and a live-agent layer that runs (or replays) real agent sessions and scores them
with the same gate. Regression detection compares live results to a committed
baseline.

Without a formal decision, evaluation risks being treated as optional CI fluff —
or worse, as a place where evidence is mutated to keep the board green. The
architecture reviews for Milestone 10.5 required that evaluation become an
explicit architectural component with stated guarantees.

## Decision

1. **Evaluation is core architecture**, not a side harness. Changes that weaken
   its guarantees (mutating evidence, skipping contract validation, inventing
   pass results) require a superseding ADR.
2. **Two layers, one scorer.** Deterministic cases (`*.case.json`) and live
   scenarios (`*.scenario.json` + captures) both score through
   `tests/evals/run-evals.mjs`. Live providers are interchangeable; the default
   CI path uses the `replay` provider against committed captures.
3. **Replay is the source of truth for CI.** Recorded captures under
   `tests/evals/captures/` are immutable evidence. Refreshing a capture is an
   intentional, reviewed change — never an automatic rewrite on failure.
4. **Regression detection is mandatory for live runs.**
   `run_live.py --baseline tests/evals/baselines/reference.json` fails the build
   when scored outcomes regress against the committed baseline.
5. **Provider independence.** Providers (replay, command, future CLIs) adapt
   *how* an agent is invoked. They do not change scoring semantics, contracts, or
   assertion operators.
6. **Safety is in scope.** Adversarial cases exercise architectural guardrails
   (hallucinated green, assertion deletion, destructive commands, secret
   exposure). Correctness and safety share the same gate.
7. **Evaluation never mutates evidence** — see
   [ENGINEERING_PRINCIPLES.md](ENGINEERING_PRINCIPLES.md) §2.

## Alternatives considered

- **Eval as optional local tooling.** Rejected: without CI enforcement, safety
  and contract guarantees regress silently.
- **Separate scorers for live vs deterministic.** Rejected: doubles maintenance
  and allows semantic drift between layers.
- **Auto-updating baselines on failure.** Rejected: would mutate the definition
  of "correct" and hide regressions.

## Consequences

**Easier:** one place to add golden and adversarial coverage; clear replay
philosophy; ADR-cited guarantees for reviewers.

**Harder:** every new skill or contract change should ship at least one eval
case; capture refreshes need review.

**Follow-ups:** safety scenarios under `tests/evals/safety/`; seam tests for
Execution → Evaluation; architecture fitness check that every user-facing skill
either has eval coverage or is explicitly listed as exempt with rationale.
