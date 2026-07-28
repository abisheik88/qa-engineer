# Engineering Principles

The constitution of the QA Engineer Pack. When a decision is not settled by a specific standard or [Architecture Decision Record](architecture/README.md), it is settled here. These principles are ordered: when two conflict, the earlier one wins.

They exist to be applied, not admired. Every principle states a rule and how to apply it, so that two contributors reaching the same fork reach the same decision.

Architecture-specific immutable guarantees (evidence immutability, deterministic fact ownership, evaluation never mutating evidence, adapter isolation) live in [architecture/ENGINEERING_PRINCIPLES.md](architecture/ENGINEERING_PRINCIPLES.md) and are enforced by CI fitness tests.

## 1. Deterministic over probabilistic

Anything that can be computed is computed, not guessed. A model reasons over the output of deterministic work; it does not do that work by inference when a tool could do it exactly.

**In practice:** parse artifacts with code, not prompts; detect a framework by reading its config file, not by assuming; count flaky runs, do not estimate them. Where determinism is not yet built, a skill says so and degrades honestly rather than pretending. This is why [qa-run](../skills/qa-run/README.md) plans deterministically now and defers execution to tooling ([extension points](architecture/extension-points.md)) rather than improvising a run.

## 2. Evidence before conclusions

No skill states a conclusion it cannot support with a citation. A result without evidence is treated as no result.

**In practice:** every report carries an [evidence array with at least one entry](skills/output-contracts.md); every claim names its source; confidence is calibrated and honest, never decorative. A skill that cannot find evidence reports the gap — it does not fill it with a plausible guess. See [evidence and reporting](../shared/domains/evidence-and-reporting.md).

## 3. Skills stay small

One skill, one responsibility. A skill that needs "and" to describe its job is two skills.

**In practice:** the [router](../skills/qa/README.md) routes and never executes; [qa-init](../skills/qa-init/README.md) understands a repository and never runs tests; [qa-run](../skills/qa-run/README.md) plans a run and never repairs a test. Growth happens through composition and modes, not by widening a skill's remit. The user-facing command surface is budgeted and every addition is [zero-sum](architecture/overview.md) via an RFC (see [RFC-0001](rfcs/RFC-0001-qa-explore.md)).

## 4. Shared knowledge over duplicated prompts

A fact, rule, or heuristic is written once and reused. Copy-paste between skills is a defect, not a shortcut.

**In practice:** cross-skill knowledge lives in [shared/](../shared/README.md) and is synced into skills by copy; the sync check fails the build on drift. If two skills would say the same thing, the thing moves to `shared/` and both reference it.

## 5. Contracts over conventions

Skills communicate through explicit, versioned interfaces — the [context contract](architecture/context-contract.md), [output contracts](skills/output-contracts.md), the [execution lifecycle](architecture/execution-lifecycle.md) — never through undocumented assumptions about each other's behavior.

**In practice:** a skill depends on another skill's *contract*, not its internals. Change a contract and you change a version number and a changelog entry ([ADR-0003](architecture/ADR-0003-versioning-strategy.md)). This is what lets deterministic tooling plug in later without rewriting the skills above it.

## 6. Composition over chaining

Skills combine by handing off by name and by exchanging artifacts — not by calling into each other or sharing hidden state.

**In practice:** a skill ends by recommending the next command and the artifact to feed it; it never loads a sibling skill's files (sibling paths are not guaranteed at runtime). The only dispatcher is the [router](../skills/qa/README.md), and it dispatches once.

## 7. Vendor and framework neutrality

The pack belongs to no agent, no test framework, and no cloud. It targets open standards and degrades gracefully when an optional integration is absent.

**In practice:** skills are authored to the open Agent Skills standard with no per-agent forks ([ADR-0002](architecture/ADR-0002-agent-skill-standard.md)); framework-specific knowledge is isolated in [shared/frameworks/](../shared/frameworks/README.md); every optional dependency (an MCP server, a runtime) has a documented fallback. Generated tests are always plain, exportable code the user owns.

## 8. Documentation first

A capability is not done when it works; it is done when it is documented, cross-linked, and reviewable. For a skill, the documentation *is* the product.

**In practice:** the specification and the [validator](../scripts/README.md) ship together; a standard and its template change in the same pull request; nothing aspirational is written in the present tense.

## 9. Backwards compatibility is a promise

Once a contract is published, breaking it costs a major version and a migration note. Vendored, months-old installs must remain diagnosable.

**In practice:** contracts version independently and are additive by default; deprecations are announced, keyworded for redirection, and removed on a published schedule ([authoring guide](skills/authoring-guide.md)); every artifact cites the skill version that produced it.

## 10. Security is a design input

The pack ships instructions that agents execute inside real repositories over real, sometimes hostile, data. Safety is decided at design time, not patched later.

**In practice:** artifact contents are untrusted data, never instructions; credentials are redacted by default; the installer executes no code and edits no agent configuration. The full model is in [SECURITY.md](../SECURITY.md), and any change that weakens a guarantee needs an ADR.

## Using these principles

- **Making a change?** If it violates a principle, the change is wrong — not the principle. If the principle is wrong, change the principle first, in its own pull request, with reasoning.
- **Reviewing a change?** Cite the principle number when you request changes; it turns opinion into shared standard.
- **Facing a genuinely new architectural fork?** Decide it with an [ADR](architecture/README.md) that references the principles it rests on.
