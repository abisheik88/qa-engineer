# Contract checks

Shared schema-validation used across eval cases: the deterministic, gating check that a skill's structured output conforms to its [output contract](../../../docs/skills/output-contracts.md). The deterministic contract-validity check is **implemented** — [`run-evals.mjs`](../run-evals.mjs) validates every case's output against its skill contract, reusing the pack's contract validator. This directory holds any additional shared schema-validation material the live-agent layer needs.

## What this checks

Any skill that emits a report (today, [qa-run](../../../skills/qa-run/contracts/execution-plan.schema.json)) must produce output that validates against that skill's committed JSON Schema. This check is:

- **Deterministic and gating.** A schema-invalid report fails the case outright, whatever else it got right — a malformed contract breaks the skills downstream that consume it.
- **Shared.** Every case for a report-emitting skill runs it, so contract conformance is verified everywhere the skill produces output, not in one place.
- **Sourced from the skill.** The schemas checked against are the skills' own `contracts/` files — there is no second copy here to drift. This directory holds the *checking* logic, not the schemas.

## Relationship to the standard

The [output-contract standard](../../../docs/skills/output-contracts.md) defines the envelope and the JSON Schema strategy; the skill authors define each contract; this check enforces conformance at eval time. Together they close the loop: a contract that is specified, versioned, and continuously verified against real output — the deterministic backbone under the "evidence, not claims" principle.
