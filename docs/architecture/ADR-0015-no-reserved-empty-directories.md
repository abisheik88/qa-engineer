# ADR-0015: Reserved-but-empty knowledge directories are removed

- **Status:** Accepted
- **Date:** 2026-07-27

## Context

`shared/stacks/` and `shared/ci/` were reserved in Milestone 1 and scoped in
Milestone 3, each holding a README that described a catalog to be authored:
language idioms for the first, CI-system log and artifact knowledge for the
second. Neither was ever written. Both directories have contained exactly one
file — their own scope note — for the whole life of the project, while the
milestone that was to fill them has been marked **Complete** since M3.

Two release audits flagged this. The first labelled the directories honestly in
place; the second still deducted for it, because labelling an empty room does not
furnish it. The relevant questions are therefore: does anything depend on them,
and does keeping them make the repository better or worse?

The evidence, gathered before deciding:

- **No skill loads either directory.** `grep -rl 'shared/ci\|shared/stacks' skills/` → 0.
- **No knowledge module references them** beyond the `shared/README.md` index row.
- **No capability claim depends on them.** The capability matrix lists neither.
- **Generation targets Playwright/TypeScript only**, where the idioms already live
  in `shared/frameworks/playwright/` — the work `stacks/` was to do is either done
  elsewhere or not yet needed.
- The pack's own [engineering principles](../engineering-principles.md) put the
  **burden of proof on adding** architecture, and its first readiness review
  advised against "signalling depth that isn't there".

## Decision

**Both directories are removed.** Knowledge is added when a skill loads it, not
reserved in advance.

- `shared/stacks/` and `shared/ci/` are deleted, along with their entries in the
  `shared/README.md` index and the CI structure check.
- The intent is preserved where intent belongs: the [roadmap](../../ROADMAP.md)
  records language-idiom and CI-triage knowledge as *unscheduled future work*,
  with the condition for starting it — a skill that needs it.
- The rule generalizes: **a directory under `shared/` exists only when it holds
  knowledge a skill loads.** An empty reserved directory is a promise the
  repository cannot keep, and every reader has to re-discover that it is empty.

This replaces the reserved-directory practice that [ADR-0001](ADR-0001-repository-structure.md)
established for `shared/` subdirectories. ADR-0001's reservation of the
*top-level* directories (`skills/`, `shared/`, `packages/`, `scripts/`,
`templates/`, `tests/`, `examples/`) stands: those are all populated and each
documents itself.

## Alternatives considered

- **Author both catalogs now.** Rejected. Nine documents of language and CI
  knowledge that no skill loads would be filler written to satisfy a directory
  listing — the opposite of the knowledge base's standard, where every domain
  document is loaded by a named skill and lint-enforced into a fixed structure.
  Writing knowledge before a consumer exists is how prompt libraries rot.
- **Keep them, labelled.** Rejected, and this is what the previous audit did. It
  is honest but it still costs: two directories that look like capability, a
  standing invitation to fill them with filler, and a recurring deduction that
  documentation alone cannot remove.
- **Keep `shared/ci/` only**, since CI failure triage is genuinely valuable and
  no comparable pack covers it. Rejected on the same grounds — value that is not
  yet built is roadmap, not architecture. It returns as a directory the day a
  skill loads it.

## Consequences

- `shared/` now contains only knowledge that is loaded: `domains/` (19 documents),
  `frameworks/` (4 adapters), `execution/`, `generation/`, `analysis/`,
  `diagnostics/`. Every subdirectory is live.
- The CI structure check no longer requires the two paths, and
  `check-architecture-fitness.mjs` gains a rule that **fails if any directory
  under `shared/` contains only a README** — so the situation this ADR resolves
  cannot recur silently.
- Adding language or CI knowledge later is additive and unblocked: create the
  directory together with the skill reference and the sync entry that consume it.
- One small loss, stated plainly: a contributor who wanted to write CI knowledge
  no longer finds a directory inviting them to. The roadmap entry carries that
  invitation instead, with the condition attached.
