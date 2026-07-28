# Maintainers

Who is responsible for this project, and for which parts. Governance rules are in
[GOVERNANCE.md](GOVERNANCE.md); support expectations are in [SUPPORT.md](SUPPORT.md).

## Current maintainers

| Name | GitHub | Areas | Since |
| --- | --- | --- | --- |
| Abisheik Vijayarangan | *(to be filled on publication)* | All areas; release manager | 2026-07 |

**This table is honest about a young project: there is one maintainer.** That is a
real risk to anyone adopting the pack, and it is stated here rather than hidden
behind a plural "the team". The mitigations are structural rather than social:

- Every architectural decision is written down ([ADRs](docs/architecture/README.md)),
  so the reasoning survives the author.
- Every capability claim is backed by a test, so a new maintainer can verify the
  project's state by running it rather than by asking.
- The pack is MIT-licensed with no runtime dependencies and no service component,
  so a fork is genuinely viable if maintenance stalls.

The `@qa-engineer/maintainers` handle in
[.github/CODEOWNERS](.github/CODEOWNERS) is a placeholder until the repository is
published under its organization; the areas below are the intended split as the
group grows.

## Area ownership (as the group grows)

| Area | Paths | Responsibility |
| --- | --- | --- |
| Skills and knowledge | `skills/`, `shared/domains/`, `shared/execution/`, `shared/generation/` | Skill spec compliance, knowledge quality, context budget |
| Deterministic core | `shared/analysis/`, `shared/diagnostics/` | Correctness of parsing, classification, and diagnosis; test coverage |
| Framework adapters | `shared/frameworks/` | Adapter boundary ([ADR-0013](docs/architecture/ADR-0013-framework-boundary.md)); cross-framework parity |
| Installer and packaging | `packages/installer/`, `package.json` | Install safety, transaction guarantees, tarball contents |
| Evaluation | `tests/` | Eval harness integrity; the scorer is frozen and changes only by ADR |
| Release | `.github/workflows/`, `CHANGELOG.md`, `docs/release/` | Release process, versioning, release notes |

## Release manager

The release manager runs the [release process](docs/contributing/release-process.md)
and owns the go/no-go call. Currently the sole maintainer. The role is deliberately
separable from authorship: whoever ships a release is accountable for having run
the checklist, not for having written the code.

## What maintainers commit to

- **Review within one week** for pull requests that follow
  [CONTRIBUTING.md](CONTRIBUTING.md), or say why not.
- **No silent capability inflation.** A claim ships with the test that proves it,
  or it does not ship.
- **Security reports acknowledged within 72 hours** — see [SECURITY.md](SECURITY.md).
- **Honest release notes**, including what regressed and what remains unproven.

## What maintainers do not commit to

Stated plainly so expectations are calibrated:

- **No support SLA.** This is a volunteer project; see [SUPPORT.md](SUPPORT.md).
- **No guaranteed feature requests.** The command surface is capped by design.
- **No backports.** Fixes land on `main` and ship in the next release.
- **No behavioral guarantees across AI models.** The pack is prompts plus
  deterministic tooling; the tooling is tested, and model behavior is measured only
  as far as [docs/release/](docs/release/) documents.

## Emeritus

None yet. Former maintainers are listed here with the period they served, and
carry the project's thanks and no obligations.
