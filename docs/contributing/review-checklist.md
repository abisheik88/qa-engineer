# Review Checklist

What a reviewer verifies before approving a pull request. The checklist exists so review quality does not depend on reviewer memory; it is applied with judgment, not as a ritual.

Changes that touch `skills/` or `shared/` are additionally reviewed against the per-dimension [skill quality checklists](../skills/quality-checklists.md).

## Scope and intent

- The change does what its linked issue agreed — no drive-by changes riding along.
- The change is the smallest reasonable version of itself; anything separable is separated.
- If the change alters a decision recorded in an [ADR](../architecture/README.md), it includes a superseding ADR rather than silently diverging.

## Correctness and accuracy

- Statements are true against the current repository — no planned feature described as shipped, no unverified compatibility claim (see the [accuracy rules](documentation-standards.md)).
- Internal links resolve; new external links point to canonical sources.
- Examples, commands, and paths in the change actually work when followed literally.

## Consistency

- Terminology matches the [documentation standards](documentation-standards.md) glossary.
- Formatting follows the [coding standards](coding-standards.md); CI green on lint, formatting, links, and structure is necessary but not sufficient — CI cannot judge clarity.
- Normative content is not duplicated from another document; it links instead.

## Process hygiene

- Commit messages (and the PR title, which becomes the squash commit) follow the [commit message convention](commit-message-convention.md).
- The branch follows the [branch naming convention](branch-naming-convention.md).
- User-facing changes have a `CHANGELOG.md` entry under `Unreleased`, classified per [ADR-0003](../architecture/ADR-0003-versioning-strategy.md).
- Documentation affected by the change is updated in the same pull request.

## Security

- No credentials, tokens, internal hostnames, or personal data anywhere in the change — including examples and fixtures.
- Workflow changes keep least-privilege permissions and pinned action versions.
- Nothing in the change weakens a guarantee in [SECURITY.md](../../SECURITY.md) without an accompanying ADR.

## Approval

- One maintainer approval merges a change today; areas gain additional required reviewers as CODEOWNERS entries are activated.
- The author merges after approval (squash merge), confirming CI is green at merge time.
- A reviewer who requests changes states what would make the change approvable — review comments are actionable or they are questions.
