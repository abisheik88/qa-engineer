# ADR-0003: Semantic Versioning with prompt-pack semantics

- **Status:** Accepted
- **Date:** 2026-07-17

## Context

Semantic Versioning assumes an API whose compatibility can be stated precisely. This project's primary artifact is instructions — skills whose observable behavior spans generated code, workflow decisions, and machine-readable reports. Without a project-specific definition of "breaking," version numbers become vibes.

The definition matters operationally: teams are expected to vendor installed skills into their repositories and verify drift in CI, downstream tooling will consume the machine-readable reports skills emit, and the installer must be able to tell a safe update from one that requires human review.

## Decision

The project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) with the following semantics, where the **pack is the release unit**: one version number spans skills, shared knowledge, tooling, and installer, released together as a git tag matching the changelog.

| Bump | Meaning for this pack |
| --- | --- |
| **MAJOR** | A user-facing command is removed or renamed; a field is removed or renamed in a machine-readable output contract; the layout of generated artifact or context files changes incompatibly; a minimum runtime or agent requirement is raised; installation paths change |
| **MINOR** | A new command, argument mode, or agent integration; new optional contract fields; substantive behavior changes that keep all contracts intact; new analyzer capabilities |
| **PATCH** | Wording clarifications, typo and bug fixes, knowledge-content corrections, description keyword tuning — no observable contract or surface change |

Supporting rules:

- **Output contracts are the compatibility surface.** Each structured report a skill emits validates against a committed JSON Schema; schema changes drive the bump classification above.
- **Per-skill versions are informational.** Skills carry a version in frontmatter metadata, surfaced in documentation and reports so vendored installs are self-identifying; they never gate releases independently.
- **Pre-1.0 caveat:** while the pack is `0.x`, MINOR may include breaking changes, each flagged in the changelog with migration notes.
- **Changelog:** [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format in [CHANGELOG.md](../../CHANGELOG.md); every user-facing pull request updates `Unreleased`.
- **Deprecation policy:** deprecations are announced in a MINOR release (deprecation notice plus pointer to the replacement, activation keywords retained so users are redirected); removal happens no earlier than the next MAJOR and at least 90 days later.
- **Branching:** trunk-based. `main` is protected and always releasable; work happens on short-lived branches; releases are tags on `main`. Backport branches (`release/vN.x`) are created on demand only to deliver security fixes to a supported previous major.
- **Support policy:** pre-1.0, only the latest release is supported. From 1.0, the current major receives full support and the previous major receives security and critical fixes for six months after the new major ships.

The operational detail — release steps, checklists, and the support table — lives in [versioning-and-releases.md](../contributing/versioning-and-releases.md) and must stay consistent with this record.

## Alternatives considered

- **Calendar versioning:** rejected. CalVer communicates recency, not compatibility; it gives vendoring teams and contract consumers no signal about whether an update is safe, which is the entire problem versioning must solve here.
- **Independent per-skill releases:** rejected. Skills share synced knowledge; independently versioned skills can disagree about the content of the same module, and installers, lockfiles, and the compatibility matrix would need to model a version lattice instead of a number.
- **Remaining 0.x indefinitely:** rejected. Perpetual 0.x reads as perpetual instability and gives enterprises no basis for adoption decisions; committing to 1.0 semantics forces the discipline of classifying every change.

## Consequences

- Every pull request must classify its change against the table above, and reviewers must check the classification — this is deliberate friction that keeps behavior changes visible.
- "Substantive behavior change" still requires judgment at the MINOR/PATCH boundary; the working rule is that a change a user could notice in a skill's decisions or output shape is MINOR.
- Contract schemas must exist from the first skill release onward, because they are the objective anchor the version semantics depend on.
- Release automation (changelog assembly, tag verification) is justified and expected by Milestone 4, but the semantics above hold from the first tag regardless of automation.
