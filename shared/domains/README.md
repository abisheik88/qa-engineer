# shared/domains/ — The QA Engineering Knowledge Base

The canonical, reusable QA engineering knowledge every skill draws on. This is where the pack's *judgment* lives — what good looks like, how things break, how to detect and repair them — so no skill re-derives it and no two skills disagree. Skills sync the domains they need; the knowledge is authored once here.

## Structure

Each domain is a single authoritative document (`<domain>.md`), not a directory of fragments. This is deliberate: the pack's sync engine flattens a synced file to its basename, so `locator-strategies.md` stays unique in a skill's `references/`, whereas a directory of `README.md` files would collide. One dense document per domain is also more maintainable and more readable than seven thin ones. Domains that genuinely outgrow a single document may split later; the [domain template](../../templates/domain-template.md) defines the canonical section structure either way.

Every domain document has the same seven sections — **Best practices, Common failures, Detection signals, Repair guidance, Framework notes, Anti-patterns, Future extension** — so the knowledge base is uniform and lint-checked in CI.

## Knowledge principles

Every claim is labeled so a reader knows its force, and none appears without engineering reasoning:

- **Best practice** — an industry-agreed standard.
- **Recommendation** — the pack's considered advice where practice varies.
- **Framework requirement** — something a specific framework forces.
- **Known limitation** — a real constraint to work within.
- **Anti-pattern** — a practice to avoid, with the reason and the better alternative.
- **Trade-off** — where reasonable engineers differ, and on what axes.

## The domains

Authored (deep, and synced into the skills that consume them):

| Domain | Scope | Consumed by |
| --- | --- | --- |
| [locator-strategies](locator-strategies.md) | Choosing and stabilizing element locators | qa-generate, qa-fix, qa-review |
| [waiting-strategies](waiting-strategies.md) | Synchronization and web-first waiting | qa-generate, qa-flaky, qa-fix |
| [assertion-patterns](assertion-patterns.md) | Meaningful, resilient assertions | qa-generate, qa-review |
| [page-objects](page-objects.md) | Page-object and screenplay patterns | qa-generate, qa-review |
| [fixtures](fixtures.md) | Setup, shared state, and authenticated sessions | qa-generate, qa-review |
| [test-data](test-data.md) | Data factories, seeding, and cleanup | qa-generate, qa-flaky |
| [flakiness](flakiness.md) | Sources of nondeterminism and how to remove them | qa-flaky |
| [retry](retry.md) | Retry strategy that observes flakiness without hiding it | qa-flaky, qa-run |
| [authentication](authentication.md) | Login, session reuse, and token handling | qa-generate, qa-api |
| [rest](rest.md) | REST API testing quality | qa-api |
| [graphql](graphql.md) | GraphQL API testing quality | qa-api |
| [websocket](websocket.md) | WebSocket testing quality | qa-api |
| [accessibility](accessibility.md) | WCAG audits and what automation can and cannot check | qa-audit |
| [performance](performance.md) | Core Web Vitals and performance budgets | qa-audit |
| [security](security.md) | Client-side security checks in the test scope | qa-audit |
| [visual-testing](visual-testing.md) | Visual regression that is stable, not noisy | qa-audit |
| [anti-patterns](anti-patterns.md) | The cross-cutting test anti-patterns to avoid | qa-review |
| [exploratory-qa](exploratory-qa.md) | Live product QA operating principles (DOM truth, login handoff, stable IDs) | qa-explore |
| [api-replay](api-replay.md) | Live API audit from performance entries and in-page replay | qa-explore |

Planned (scope defined; authored as the consuming work lands): `authorization`, `network`, `timeouts`, `parallelism`, `mobile`, `component-testing`, `cross-browser`.

## Rules

- **Single source.** Cross-skill knowledge lives here and is synced by copy; a skill never re-states it.
- **Link-free.** Domain documents are synced into skills, so they carry no escaping links — they cross-reference other domains by name in prose. This index carries the links.
- **Held to skill-level review.** Domain content is what agents quote to users; it passes the [quality checklists](../../docs/skills/quality-checklists.md).
