# Governance

How decisions get made in QA Automation Pack, who makes them, and how that
changes. This document is deliberately small: the project is young, and
pretending to a foundation-scale structure it does not have would be its own kind
of dishonesty.

## Current model: maintainer-led, ADR-governed

One maintainer group holds final say, and its decisions are recorded rather than
remembered. That is the whole model. What keeps it accountable is not a committee
but three rules that apply to the maintainers too:

1. **Architectural decisions are written down before they are implemented.** Every
   load-bearing choice lives in an [architecture decision record](docs/architecture/README.md),
   with its context, alternatives, and consequences. A decision that is not in an
   ADR is not a decision; it is a habit.
2. **Capability claims must be backed by a test.** The
   [capability matrix](docs/capability-matrix.md) is the single source of truth for
   what the pack can do, and CI fails if a claim and its evidence disagree.
   Maintainers cannot promote a capability by asserting it.
3. **The command surface is capped.** Growing beyond the twelve user-facing
   commands requires an [RFC](templates/rfc-template.md), because every installed
   skill competes for a finite context budget. "It would be useful" is not
   sufficient; "it is useful and here is what it displaces" is the standard.

See [MAINTAINERS.md](MAINTAINERS.md) for who currently holds these
responsibilities, and [SUPPORT.md](SUPPORT.md) for what to expect when you ask
for help.

## Decision types and who decides

| Decision | Who | Instrument | Bar |
| --- | --- | --- | --- |
| Bug fix, documentation fix, test addition | Any maintainer | Pull request | One maintainer approval, CI green |
| New knowledge module, new domain document | Any maintainer | Pull request | Loaded by a named skill; passes `check-knowledge` |
| New framework adapter | Any maintainer | Pull request | Follows [add a framework](docs/contributing/add-a-framework.md); changes only `shared/frameworks/` |
| Capability promotion (Beta → Production) | Maintainer group | Pull request updating the matrix **and** the test that proves it | The new level's stated bar is met by a passing test |
| New user-facing command | Maintainer group | [RFC](templates/rfc-template.md) | Accepted RFC; description budget still within limits |
| Architectural change | Maintainer group | [ADR](docs/architecture/adr-template.md) | Accepted ADR; fitness tests updated |
| Output contract change | Maintainer group | ADR + version bump per [ADR-0003](docs/architecture/ADR-0003-versioning-strategy.md) | Additive within a major; removal is breaking |
| Release | Release manager (a maintainer) | Tag + [release process](docs/contributing/release-process.md) | Every gate green; checklist complete |

## How a proposal moves

```text
idea → issue (discussion)
     → ADR or RFC if architectural or surface-changing
     → pull request implementing the accepted decision
     → review (one maintainer minimum; two for contracts and architecture)
     → CI green (all gates, no exceptions)
     → merge
```

Anyone may open an issue, an ADR draft, or an RFC. Being a maintainer is not a
prerequisite for proposing a direction — only for accepting one.

## Disagreement

Technical disagreements are settled by evidence, in this order:

1. **A test.** If the disagreement can be expressed as a test, write it. The test
   decides, not the argument.
2. **A worked example.** If it cannot be tested, demonstrate it on a real
   repository and show the output.
3. **The engineering principles.** Where evidence is genuinely balanced,
   [docs/engineering-principles.md](docs/engineering-principles.md) breaks the tie:
   deterministic over inferred, honest over impressive, removing over adding.
4. **The maintainer group decides**, records why in the ADR, and moves on.

Escalation beyond that does not exist yet, because the project is not large
enough to need it. If it becomes large enough, that change gets its own ADR.

## Becoming a maintainer

There is no application. The path is contribution:

- Several merged, non-trivial pull requests that needed little rework.
- Demonstrated judgment in review — catching real problems, and *not* blocking on
  taste.
- Willingness to say "I don't know" and "we shouldn't claim that". The pack's
  central value is honest reporting; a maintainer who oversells is a liability
  regardless of technical skill.

Existing maintainers extend the invitation. Nomination and acceptance are
recorded in [MAINTAINERS.md](MAINTAINERS.md).

## Stepping down and inactivity

Maintainers may step down at any time by opening a pull request removing
themselves. A maintainer inactive for six months may be moved to *emeritus* by
the remaining maintainers; this carries no judgment and is reversible on request.

## Changing this document

Governance changes are ADRs. That is deliberate: a project whose governance can
be changed quietly has none.
