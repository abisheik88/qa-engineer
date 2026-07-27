# ADR-0005: Execution skills follow a fixed lifecycle and emit conformant contracts

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

The pack will grow many skills that run, observe, or act on a system under test: `qa-run` now, then `qa-debug`, `qa-api`, `qa-audit`, `qa-flaky`, and more. Left to author each one freely, they would diverge — different orderings, different notions of evidence, incompatible result shapes — and that divergence would surface to users as inconsistency and to the tooling layer as a dozen special cases to integrate.

The pack also intends to add deterministic execution and analysis later ([extension points](extension-points.md)) *underneath* skills that are written now. That is only possible if there are stable seams for the tooling to fill. Without an agreed lifecycle, there are no seams — only bespoke procedures that each new capability must reshape.

## Decision

Every execution-oriented skill follows one fixed lifecycle, specified in [execution-lifecycle.md](execution-lifecycle.md): Discover → Understand repository → Understand intent → Determine framework → Determine strategy → Collect evidence → Execute → Validate → Report → Recommendations. And every such skill closes by emitting a result that conforms to the [output-contract](../skills/output-contracts.md) envelope.

The rules:

- **Every phase is accounted for, in order.** A skill need not *perform* every phase, but it must address each one and must never skip evidence collection or validation before claiming a result.
- **A skill implements a contiguous prefix and plans the rest.** Phases a skill does not yet perform appear in its output as an explicit plan. This is the seam the tooling layer fills.
- **Discover opens on the context contract; Report closes on an output contract.** The lifecycle is bounded by the pack's two data contracts ([context](context-contract.md), [output](../skills/output-contracts.md)).
- **Strategy is a conclusion.** Phase 5 records the evidence that drove the chosen scope, honoring principle 2 ([evidence before conclusions](../engineering-principles.md)).

## Alternatives considered

- **Let each execution skill define its own flow.** Rejected: guarantees drift across skills, inconsistent user experience, and no stable insertion point for deterministic tooling — every later capability would require reshaping the skill it plugs into, the opposite of the extensibility this milestone is meant to establish.
- **A single monolithic "execution" skill parameterized for every task.** Rejected: violates principle 3 ([skills stay small](../engineering-principles.md)); one skill with modes for running, debugging, auditing, and API-checking is four responsibilities wearing one name, and it would be unreviewable and unversionable at the granularity the pack needs.
- **Mandate the lifecycle but not a shared result contract.** Rejected: the lifecycle makes skills *behave* alike, but only the shared contract makes their outputs *compose* — `qa-report` consuming any skill's result, `qa-fix` consuming `qa-debug`'s, depends on one envelope, not many.

## Consequences

- Authoring a new execution skill becomes largely mechanical: instantiate the context contract, the ten phases, and the output contract. The [authoring guide](../skills/authoring-guide.md) can teach it as a pattern, and review can check against it.
- Skills stay honest about what they do versus plan: `qa-run` performs planning phases and defers execution, and that boundary is visible in its output rather than hidden.
- The tooling layer has stable seams (phases 6–8) to fill without editing the skills above them ([extension points](extension-points.md)).
- The lifecycle constrains execution skills only. Skills that neither run nor observe a system — the [router](../../skills/qa/README.md), pure generators — do not follow it, and the [specification](../skills/skill-specification.md) does not force its phase names on them.
- The lifecycle is now a load-bearing contract: changing a phase's meaning is a major change requiring a superseding ADR and a migration note.
