# Architecture Engineering Principles

Immutable architectural guarantees for the QA Engineer Pack. These are the
rules every future milestone must obey. They refine — and do not replace — the
project constitution in [docs/engineering-principles.md](../engineering-principles.md).

When a change would violate one of these, the change is wrong. Changing a
principle requires its own pull request and, when the guarantee is architectural,
a new ADR.

## 1. Evidence is immutable

Once evidence is recorded (an artifact path, a hash, a parsed finding, a
normalized execution result), downstream stages may cite it, summarize it, or
refuse to act on it. They must not rewrite, delete, or invent it.

## 2. Evaluation never mutates evidence

The evaluation platform scores outputs against contracts and assertions. It never
edits the subject under test, never rewrites captured agent output, and never
"fixes" a failing case by altering evidence. Replay captures are append-only
records.

## 3. Analysis is read-only

The analysis platform parses artifacts into structured findings. It does not
repair tests, mutate source, or decide product intent. Findings flow forward;
source trees stay untouched.

## 4. Skills orchestrate

Skills decide *what* to do next and *how* to present results. Deterministic
libraries own parsing, normalization, hashing, redaction, and contract
validation. Skills do not invent runner exit codes, file hashes, or taxonomy
classifications that tools already produce.

## 5. Adapters isolate frameworks

Framework-specific knowledge lives under `shared/frameworks/<name>/`. Skills and
cross-cutting platforms never embed framework detection tables or capability
claims that are not derived from the [canonical framework registry](../../shared/frameworks/registry.json).

## 6. Deterministic code owns facts

Anything that is a fact about the world (exit codes, file contents, hashes,
parsed HAR/JUnit/trace fields, lockfile integrity, framework identity) is
produced by deterministic code. See
[deterministic-execution-boundary.md](deterministic-execution-boundary.md).

## 7. LLM owns reasoning

The model may explain, summarize, recommend, prioritize narrative, and choose
among *already computed* options. It must not fabricate structured evidence,
normalize raw runner output by invention, or claim execution success without a
tool-produced result.

## 8. Unknown is preferable to fabricated certainty

When evidence is missing or ambiguous, skills report the gap with calibrated
confidence. A confident wrong answer is a defect; an honest unknown is correct.

## 9. Public contracts evolve intentionally

External skill output contracts (`skills/*/contracts/*.schema.json`) and the
context contract change only with versioning discipline
([ADR-0003](ADR-0003-versioning-strategy.md)): additive fields are minor;
removals or semantic breaks are major, with a changelog entry.

## 10. Internal seams are explicit

Boundaries between Analysis → Diagnostics, Execution → Evaluation, and
Generation → Validation use declared schemas (or typed models) and seam
regression tests. Implicit dictionary shapes are defects.

## Enforcement

| Principle | Mechanical enforcement |
| --- | --- |
| 1–3, 6–8 | [deterministic-execution-boundary.md](deterministic-execution-boundary.md); eval adversarial cases; `analysis` / `diagnostics` unit + seam tests |
| 4–5 | Framework registry + `scripts/check-framework-registry.mjs`; skill sync |
| 9 | `scripts/validate-skills.mjs` envelope shape check |
| 10 | `shared/*/schemas/internal/` + `tests/seams/` |
| All | `scripts/check-architecture-fitness.mjs` in CI |

Future milestones cite these principles by number in ADRs and PR descriptions.
