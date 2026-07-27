# Versioning and Releases

The operational companion to [ADR-0003](../architecture/ADR-0003-versioning-strategy.md), which defines the versioning semantics. This document covers how releases are actually cut, how branches work, and what support a release receives. If this document and the ADR ever disagree, the ADR wins.

## Version semantics in one table

| Bump | Trigger (defined precisely in ADR-0003) |
| --- | --- |
| MAJOR | Command removed/renamed; output-contract field removed/renamed; generated file layout changed; minimum runtime or agent requirement raised; install paths changed |
| MINOR | New command, mode, agent integration, or optional contract field; substantive behavior change with contracts intact |
| PATCH | Clarifications and fixes with no observable contract or surface change |

While the pack is pre-1.0, MINOR releases may contain breaking changes; each is flagged in the changelog with migration notes.

## Release unit and artifacts

One release = one git tag `vX.Y.Z` on `main` = one changelog section = one GitHub Release. The tag spans the entire repository (skills, shared knowledge, tooling, documentation) — there are no independently released components ([ADR-0001](../architecture/ADR-0001-repository-structure.md)). Package-registry publication joins the same tag-driven process when the installer ships in Milestone 4.

## Release process

1. **Verify state.** CI green on `main`; no unresolved release-blocking issues in the milestone.
2. **Classify.** Review everything under `Unreleased` in [CHANGELOG.md](../../CHANGELOG.md); confirm the version bump the entries imply, per the table above.
3. **Finalize the changelog.** Convert `Unreleased` into a dated `X.Y.Z` section; breaking entries link migration notes.
4. **Update compatibility.** Record the agent versions and specification revision the release was validated against in [COMPATIBILITY.md](../../COMPATIBILITY.md).
5. **Tag.** Annotated tag `vX.Y.Z` on the release commit; the tag message references the changelog section.
6. **Publish.** Create the GitHub Release from the tag with the changelog section as its body.
7. **Announce.** Update anything version-pinned in documentation; deprecation clocks (90-day minimum, per ADR-0003) start at publication.

Release automation (changelog assembly, tag/version consistency checks, registry publication) is planned for Milestone 4; until then a maintainer performs these steps manually and the checklist above is the record.

## Branching strategy

Trunk-based development:

- **`main`** is protected, always releasable, and only changes through reviewed pull requests. Releases are tags on `main` — there is no separate development branch.
- **Working branches** are short-lived, named per the [branch naming convention](branch-naming-convention.md), and deleted after merge.
- **`release/vN.x`** branches exist only on demand, created from the last `vN.*` tag to deliver security or critical fixes to a supported previous major. Fixes land on `main` first and are cherry-picked back whenever the code still exists there.

## Support policy

| Phase | Policy |
| --- | --- |
| Pre-1.0 | Only the latest release is supported; upgrade is the fix |
| From 1.0 | Current major: full support (features, fixes, security). Previous major: security and critical fixes for six months after the new major ships, delivered from a `release/vN.x` branch |
| Older | Unsupported; advisories state affected ranges |

"Supported" means: security reports are investigated and fixed per [SECURITY.md](../../SECURITY.md), and confirmed defects are eligible for fixes. Compatibility with agent versions is tracked separately in [COMPATIBILITY.md](../../COMPATIBILITY.md).

## Rollback for users

Because installs are lockfile-pinned from Milestone 4, rolling back is reinstalling the previous version explicitly. Release notes must call out when a rollback additionally requires reverting generated files (a MAJOR-only situation, per the semantics above).
