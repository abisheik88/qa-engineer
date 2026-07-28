# Contributing to QA Automation Pack

Thank you for considering a contribution. This project aims to become the reference open-source QA skill pack for AI coding agents, and it will only get there through the judgment of practicing QA engineers — people like you.

This guide covers the essentials. The detailed standards live in [docs/contributing/README.md](docs/contributing/README.md) and are linked throughout.

## Current phase

The project is pre-release. The repository foundation is complete; skills, tooling, and the installer land in the milestones described in [ROADMAP.md](ROADMAP.md). That shapes what is useful right now:

- **Review the architecture.** The [architecture decision records](docs/architecture/README.md) are open for challenge. If a decision looks wrong for your stack, agent, or team, open an issue — it is far cheaper to correct course now.
- **Propose skills and knowledge modules.** Use the *Skill proposal* issue template. Proposals that extend an existing planned command with a mode, or add a shared knowledge module, have a much lower bar than new top-level commands.
- **Improve documentation.** Unclear, incorrect, or missing documentation is always a valid issue or pull request.

## Who decides what

Decision rights, the ADR/RFC thresholds, and how disagreements are settled are in
[GOVERNANCE.md](GOVERNANCE.md). Current maintainers are in
[MAINTAINERS.md](MAINTAINERS.md); support expectations are in [SUPPORT.md](SUPPORT.md).

The two things contributors most often want to do have runbooks:

- [Add a skill](docs/contributing/add-a-skill.md) — start with step 0, which explains
  why the answer is usually a knowledge module or an argument mode instead.
- [Add a framework](docs/contributing/add-a-framework.md) — the extensibility path the
  architecture was designed around; it should change only `shared/frameworks/`.

## Ground rules

- Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
- One topic per pull request. Small, focused changes review faster and revert cleaner.
- Every change that affects users gets an entry under `Unreleased` in [CHANGELOG.md](CHANGELOG.md).
- Significant design changes need an ADR before implementation — see [when an ADR is required](docs/architecture/README.md).
- Do not submit content you do not have the right to license under [MIT](LICENSE). By contributing, you agree that your contributions are licensed under the project's MIT license.

## Getting set up

The repository is currently documentation and configuration only, so setup is minimal:

```bash
git clone <your-fork-url>
cd qa-engineer
```

Run the same checks CI runs before pushing:

```bash
# Markdown style
npx --yes markdownlint-cli2 "**/*.md"

# Formatting (line endings, final newlines, indentation)
npx --yes editorconfig-checker
```

CI additionally validates the repository structure and all relative links; see [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Making a change

1. **Open or find an issue first** for anything non-trivial, so the approach is agreed before you invest effort. Typo-level fixes can go straight to a pull request.
2. **Branch from `main`** using the [branch naming convention](docs/contributing/branch-naming-convention.md), e.g. `docs/142-clarify-tier-definitions`.
3. **Commit** following the [commit message convention](docs/contributing/commit-message-convention.md) (Conventional Commits), e.g. `docs(compatibility): clarify tier-2 verification bar`.
4. **Write to the standards**: [coding standards](docs/contributing/coding-standards.md) and [documentation standards](docs/contributing/documentation-standards.md).
5. **Open a pull request** and complete the template. A maintainer reviews against the [review checklist](docs/contributing/review-checklist.md).

Issues move through the states described in the [issue lifecycle](docs/contributing/issue-lifecycle.md); the same document explains labels and triage expectations.

## What reviewers will hold you to

- The change does what the linked issue agreed, and nothing else.
- CI is green — lint, formatting, links, and structure.
- Documentation affected by the change is updated in the same pull request.
- Claims are accurate: no aspirational feature described as if it ships today, no unverified compatibility statements.

## Questions

Open a documentation issue for anything this guide should have answered — the gap itself is a bug in this document.
