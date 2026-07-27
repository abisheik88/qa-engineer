# Branch Naming Convention

Branch names make intent visible in lists, CI runs, and reviews. The project is trunk-based (see [versioning-and-releases.md](versioning-and-releases.md)): all work happens on short-lived branches cut from `main`.

## Pattern

```text
<type>/<issue-number>-<short-slug>
```

- `<type>` matches the [commit types](commit-message-convention.md): `feat`, `fix`, `docs`, `refactor`, `test`, `ci`, `build`, `chore`.
- `<issue-number>` is the tracking issue; omit it only when no issue exists (typo-level changes).
- `<short-slug>` is lowercase kebab-case, at most six words, describing the change — not the area alone.

## Examples

```text
docs/57-clarify-tier2-verification-bar
ci/61-add-external-link-schedule
fix/72-issue-form-required-fields
chore/renovate-editorconfig-rules
```

## Rules

- Branch from the current `main`; rebase rather than merge `main` into the branch when it falls behind.
- One branch per pull request; do not reuse a merged branch.
- Delete branches after merge — GitHub's auto-delete setting is expected to be on.
- Only `main` and on-demand `release/vN.x` backport branches are long-lived; both are protected and accept changes exclusively through pull requests.

## Reserved prefixes

- `release/` — backport lines for security fixes to a supported previous major (created by maintainers on demand).
- `dependabot/` — automated dependency updates; never create these manually.
