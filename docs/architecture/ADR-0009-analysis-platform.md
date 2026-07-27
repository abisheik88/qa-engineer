# ADR-0009: A deterministic, framework-agnostic analysis platform, in code

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

The diagnostic skills the pack will build — `qa-debug`, `qa-fix`, `qa-report` — must reach conclusions about why tests failed. If those conclusions came from a model reading raw artifacts, they would be guesses: plausible, unverifiable, and different every run. The pack's first principle is deterministic over probabilistic, and its second is evidence before conclusions. Diagnosis is exactly where those principles are tested, because a confident wrong diagnosis is worse than none.

The artifacts themselves — traces, HAR files, JUnit XML, reports — are structured data. Structured data should be parsed by code, not interpreted by inference. And that code must be shared: every diagnostic skill and every framework needs the same evidence model, the same failure taxonomy, the same redaction, or they will diverge and the analysis layer will fragment.

This is also the first milestone to ship executable code, which raises a question the pack had deferred: what language, and where does it live.

## Decision

The pack builds a **deterministic analysis platform, implemented in code**, framework-agnostic at its core.

- **Code, not prompts.** Analyzers are Python (standard library only, 3.8+), deterministic, and unit-tested. The same artifact yields the same findings. This is the `qa_analysis` package under `shared/analysis/lib/`.
- **One evidence model, one taxonomy.** Every analyzer emits the same [evidence model](../../shared/analysis/evidence-model.md) and classifies with the same [failure taxonomy](../../shared/analysis/failure-taxonomy.md), so findings compose regardless of which analyzer or framework produced them.
- **Framework-agnostic core, framework adapters.** Formats that are standards (JUnit, HAR, plain text) are parsed by the core and serve every framework. Only genuinely framework-specific artifacts (a Playwright trace) get a framework adapter, and even those reuse the core for evidence, taxonomy, redaction, and validation.
- **Never guess past a bad artifact.** A malformed artifact raises; it is not parsed into a fabricated result. Insufficient signals yield `unknown` at low confidence with an honest reason.
- **Redact at the boundary.** Secrets and PII are masked as artifacts are read, enforced in the evidence model so it cannot be bypassed ([redaction policy](../../shared/analysis/redaction-policy.md)).
- **The platform recommends, never fixes.** Analysis produces findings and safe recommendations; editing is a later skill's job, with the [diff guard](../../shared/analysis/lib/README.md) between any edit and a success claim.

The specification lives in `shared/analysis/*.md`; the implementation lives in `shared/analysis/lib/`; the two are kept consistent because the docs describe what the tested code does.

## Alternatives considered

- **Let the diagnostic skills reason over raw artifacts with the model.** Rejected: it makes diagnosis probabilistic and unverifiable, violating the pack's founding principles at the exact point they matter most. A trace parsed by code is evidence; a trace summarized by inference is a guess.
- **A third-party analysis or schema library.** Rejected: analyzers are bundled into skills that run in users' repositories, so a dependency is attack surface and an install burden shipped to every user. Standard-library-only keeps the pack safe to vendor and matches the coding standards set in earlier milestones.
- **Per-framework analyzers with no shared core.** Rejected: it would duplicate the evidence model, taxonomy, and redaction across frameworks and let them drift, and it would make the diagnostic skills framework-specific — the coupling this platform exists to prevent.
- **Defer the analysis platform until the diagnostic skills are built.** Rejected: the skills can only be built well against a stable, tested analysis layer. Building the infrastructure first, with its contracts frozen, is what lets the skills be thin and correct.

## Consequences

- The diagnostic skills of a later milestone consume tested, deterministic findings in one shape — they orchestrate analysis, they do not reinvent it.
- The pack now carries Python. CI gains a Python job (unit tests, contract validation, redaction and diff-guard checks); COMPATIBILITY.md declares Python 3.8+ for the analysis tooling; `.editorconfig` gains a Python profile.
- The analysis contracts (evidence model, taxonomy, artifact model) are load-bearing: changing them is a versioned change, because every future analyzer and consumer depends on them.
- Analysis quality now rests on tested code rather than prompt behavior — a stronger foundation, and one whose correctness is demonstrable and regression-guarded, unlike inference.
- The framework-agnostic-core / framework-adapter split is the same shape as [ADR-0006](ADR-0006-execution-architecture.md); [ADR-0010](ADR-0010-multi-framework-foundation.md) proves it holds across execution, generation, and analysis at once.
