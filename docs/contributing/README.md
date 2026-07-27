# Contributor Standards

[CONTRIBUTING.md](../../CONTRIBUTING.md) at the repository root is the entry point for contributors; this directory holds the detailed standards it references. Each document is normative: pull requests are reviewed against them.

## Index

| Document | Governs |
| --- | --- |
| [development-workflow.md](development-workflow.md) | Environment setup, the local validation loop, live skill testing, debugging |
| [coding-standards.md](coding-standards.md) | Quality rules for everything committed: Markdown, YAML, configuration, and the standards future code must meet |
| [commit-message-convention.md](commit-message-convention.md) | Conventional Commits: format, types, scopes, breaking changes |
| [branch-naming-convention.md](branch-naming-convention.md) | Branch name pattern, lifecycle, and protection rules |
| [documentation-standards.md](documentation-standards.md) | The project style guide: voice, verbosity, structure, formatting, linking, examples |
| [review-checklist.md](review-checklist.md) | What reviewers verify before approving a pull request |
| [issue-lifecycle.md](issue-lifecycle.md) | Issue states, labels, triage expectations, and closure reasons |
| [versioning-and-releases.md](versioning-and-releases.md) | Release process, branching strategy, and support policy |

Skill-specific standards — the `SKILL.md` specification, authoring guide, and per-dimension quality checklists — live with the skill platform in [docs/skills/](../skills/README.md).

## How these standards evolve

The standards themselves change by pull request like any other content. Changes that alter architectural decisions (versioning semantics, for example) additionally require an ADR per the [architecture process](../architecture/README.md). When a standard and an ADR disagree, the ADR wins and the standard must be corrected.
