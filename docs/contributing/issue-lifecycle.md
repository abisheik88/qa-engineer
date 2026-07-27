# Issue Lifecycle

How issues move from report to resolution. The lifecycle is deliberately lightweight — states are expressed with GitHub's built-in mechanisms and default labels, so it works from day one without custom automation.

## Intake

All issues arrive through the [issue forms](../../.github/ISSUE_TEMPLATE/bug_report.yml) — bug report, feature request, skill proposal, or documentation issue. Blank issues are disabled; the forms collect the context triage needs (reproduction steps, overlap analysis, affected area) so issues start actionable.

Security reports never go through issues — see [SECURITY.md](../../SECURITY.md).

## States

```text
open (untriaged)
  → triaged: accepted        (milestone assigned, ready to be picked up)
  → triaged: needs discussion (question label; direction not yet decided)
  → closed: completed | not planned | duplicate
```

| State | Expressed as | Meaning |
| --- | --- | --- |
| Untriaged | Open, no milestone | Awaiting maintainer triage |
| Accepted | Open, milestone assigned | Will be worked; scope agreed in the thread |
| Needs discussion | Open, `question` label | Direction genuinely undecided; input welcome |
| Help wanted | `help wanted` / `good first issue` labels | Accepted and available for contributors |
| Completed | Closed as completed, linked pull request | Shipped |
| Not planned | Closed as not planned, with reasoning | Declined — the reasoning comment is mandatory |
| Duplicate | Closed as duplicate, linked to the original | Consolidated |

## Triage expectations

- Best-effort first response within **one week**; compatibility reports against supported agents are triaged ahead of feature work.
- Triage decides three things: is it valid, where does it land (milestone or not planned), and who can do it (maintainer-only or `help wanted`).
- An issue is only *accepted* when its acceptance criteria are stated in the thread — a one-line "what done looks like".

## Labels

The project uses GitHub's default label set (`bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix`) plus `dependencies` (applied automatically by Dependabot). Skill proposals arrive labeled `enhancement` via their form. New labels require a maintainer decision recorded in the issue that motivated them — label sprawl is a documentation cost like any other.

## Staleness

There is no auto-close bot. Issues close for a stated reason, not for inactivity. If an issue awaits reporter input, a maintainer says exactly what is needed; after **30 days** without response it may be closed as not planned, with a note inviting reopening when the information exists.

## Escalation

If an issue sits untriaged past the expectation above, a single polite mention of the maintainers is appropriate. Cross-posting or bumping daily is not — see the [Code of Conduct](../../CODE_OF_CONDUCT.md).
