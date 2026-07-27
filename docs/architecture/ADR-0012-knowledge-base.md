# ADR-0012: The QA knowledge base is one authoritative document per domain

- **Status:** Accepted
- **Date:** 2026-07-19

## Context

The pack's skills need shared QA engineering judgment — what good locators look like, how flakiness arises, how to audit accessibility honestly. Without a shared knowledge base, that judgment would be re-stated inside each skill's prompt, drift between skills, and be impossible to review or improve in one place. The knowledge is also the pack's most quoted output: it is what an agent tells a user is best practice, so it must be accurate, reasoned, and consistent.

The milestone that introduced the knowledge base sketched a per-domain directory of seven files (a README plus best-practices, common-failures, detection-rules, repair-guidelines, framework-notes, future-extension). Two forces argued against implementing it literally. First, the pack's sync engine flattens a synced file to its basename, so a domain directory of `README.md` files would collide the moment two domains synced into one skill. Second, seven thin files per domain fragments knowledge that reads better as one dense document, and multiplies maintenance.

## Decision

Each domain is **one authoritative document**, `shared/domains/<domain>.md`, with the seven required aspects as fixed sections — **Best practices, Common failures, Detection signals, Repair guidance, Framework notes, Anti-patterns, Future extension**.

- **Flat, uniquely named files.** `locator-strategies.md`, `flakiness.md`, and so on — unique basenames, so they sync into a skill's `references/` without collision, matching the pack's existing domain-file pattern.
- **The seven aspects are sections, not files.** The knowledge the milestone asked for is all present, in one place, per domain — more maintainable and more readable than a directory of fragments. The [domain template](../../templates/domain-template.md) defines the canonical section structure.
- **Every claim is labeled and reasoned.** Best practice, recommendation, framework requirement, known limitation, anti-pattern, trade-off — no opinion without engineering reasoning. This is the knowledge-base equivalent of "evidence before conclusions".
- **Link-free, because synced.** Domain documents are synced into skills, where escaping links are forbidden; they cross-reference other domains by name in prose. The [domains index](../../shared/domains/README.md) carries the links.
- **Lint-checked.** `scripts/check-knowledge.mjs` verifies every domain document has the seven sections and no escaping links, so the base stays uniform.
- **Single source, held to skill-level review.** Knowledge lives here once and is synced by copy; it passes the same quality bar as a skill, because agents quote it.

## Alternatives considered

- **A directory of seven files per domain, as sketched.** Rejected on two grounds: the seven `README.md`/fixed-name files collide under basename-flattening sync, and the fragmentation lowers quality and raises maintenance. The seven aspects are better delivered as sections of one document; the structure is preserved, the fragmentation is not.
- **Knowledge inside each skill's prompt.** Rejected: it duplicates judgment across skills, guarantees drift, and cannot be reviewed or improved in one place — the exact problem the knowledge base exists to solve (principle 4).
- **Exhaustive coverage of all sketched domains at once.** Rejected in favor of depth over breadth: the domains the new skills actually consume are authored fully; the remaining few are indexed with defined scope and authored as the consuming work lands, rather than shipping thin filler to hit a count.

## Consequences

- Every skill draws QA judgment from one reviewed source; two skills cannot disagree about what a locator anti-pattern is.
- The knowledge base is uniform (seven sections, lint-enforced) and safe to sync (link-free, unique basenames).
- Some domains are authored deeply now and others are scoped in the index; the index is honest about which, and the section structure means growing a scoped domain is filling sections, not restructuring.
- A domain that genuinely outgrows one document can split later; the template and the flat-file convention accommodate it, and the sync/lint tooling would extend to it.
- The knowledge base is load-bearing for the skills that sync it; changing a domain's guidance is a normal reviewed content change, but removing a section it promises is a structural change the lint will catch.
