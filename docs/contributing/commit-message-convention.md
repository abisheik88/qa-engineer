# Commit Message Convention

Commits follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/). The convention makes history scannable, ties commits to the [versioning semantics](../architecture/ADR-0003-versioning-strategy.md), and enables changelog automation in later milestones.

## Format

```text
<type>(<scope>): <subject>

<body>

<footer>
```

Scope, body, and footer are optional; type and subject are not.

## Types

| Type | Use for | Version signal |
| --- | --- | --- |
| `feat` | New capability visible to users | MINOR |
| `fix` | Defect corrections | PATCH |
| `docs` | Documentation-only changes | PATCH |
| `refactor` | Restructuring with no behavior change | none |
| `test` | Tests, fixtures, and evaluation content | none |
| `ci` | CI workflows and automation | none |
| `build` | Packaging and dependency manifests | none |
| `chore` | Maintenance that fits nothing above | none |
| `revert` | Reverting a previous commit | mirrors the reverted change |

## Scopes

Use the area of the repository the change touches: `repo`, `docs`, `adr`, `ci`, `github`, plus — as their milestones land — `skills`, `shared`, `cli`, `templates`, `evals`. A specific skill may be used as a scope once skills exist (`fix(qa-debug): ...`). Omit the scope when the change is genuinely cross-cutting.

## Subject rules

- Imperative mood ("add", not "added" or "adds"), no trailing period, at most 72 characters.
- Lowercase after the colon unless the first word is a proper noun.
- The subject states *what changes*; the body states *why*.

## Body and footer

- Wrap the body at roughly 72 characters; explain motivation and contrast with previous behavior when it is not obvious.
- Reference issues in the footer (`Closes #123`).
- Breaking changes use both signals: `!` after the type/scope and a `BREAKING CHANGE:` footer describing the migration.

## Examples

```text
docs(adr): record the no-compiler decision for skill authoring

feat(ci): add offline internal link checking to the CI pipeline

fix(github): require overlap analysis in the skill proposal form

The proposal form allowed new-command proposals without stating why an
existing command's mode could not cover the job, which made triage
decisions unreviewable.

Closes #42
```

```text
feat(skills)!: rename qa-audit classification field severity to impact

BREAKING CHANGE: qa-audit reports now emit "impact" instead of
"severity". Consumers of qa-artifacts/audit-*.json must update field
references; see docs/migrations for the mapping.
```

## Enforcement

Reviewers enforce the convention today (it is on the [review checklist](review-checklist.md)); automated linting of commit messages is planned alongside release automation. Squash-merging is the default, so the pull request title must itself follow the convention — it becomes the commit that lands on `main`.
