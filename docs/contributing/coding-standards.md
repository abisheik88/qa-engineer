# Coding Standards

These standards apply to everything committed to the repository. The repository is currently documentation and configuration; sections for code apply from the milestone that introduces it and are stated now so tooling choices do not drift into them accidentally.

## Principles

1. **Reviewability beats cleverness.** Everything in this repository — prose, configuration, and eventually skills and scripts — is reviewed as text. Optimize for a reader seeing the change cold.
2. **Source is the artifact.** Nothing committed is generated from something more canonical elsewhere, with one exception: synced knowledge copies (from Milestone 2), which are clearly marked and guarded by a CI drift check. Never hand-edit a marked synced copy.
3. **Small, single-topic changes.** A pull request does one thing; refactoring and behavior changes never share a commit.
4. **Claims must be true.** Documentation never describes planned behavior in the present tense; compatibility statements cite what was actually verified.

## Markdown

Enforced by `markdownlint-cli2` in CI (configuration: [.markdownlint-cli2.jsonc](../../.markdownlint-cli2.jsonc)); the rules below are the intent behind the configuration:

- One `H1` per file; headings descend without skipping levels; no punctuation at heading ends.
- Fenced code blocks always declare a language (`text` for trees and plain output).
- Lists use `-` for bullets and incrementing numbers for ordered lists, indented two spaces per level.
- Tables, headings, lists, and fences are surrounded by blank lines.
- Emphasis is never a substitute for a heading.
- No line-length limit; write natural prose and let it wrap.

## YAML and configuration

- Two-space indentation, no tabs (enforced via [.editorconfig](../../.editorconfig)).
- Quote strings that could be misread by YAML (globs, versions, cron expressions).
- Every configuration file opens with a comment stating what it configures and where it is enforced or consumed.

## GitHub Actions workflows

- Least-privilege `permissions` blocks, always explicit.
- Actions pinned to a major version; Dependabot maintains the pins.
- A workflow may only be added when it can execute successfully against the current repository content.
- Shell steps use `set -euo pipefail` and quote variable expansions.

## File and directory naming

- Kebab-case for Markdown files (`branch-naming-convention.md`); uppercase for ecosystem-conventional root files (`README.md`, `LICENSE`, `SECURITY.md`).
- ADRs follow `ADR-NNNN-short-kebab-title.md` with zero-padded sequential numbers.
- Every directory carries a `README.md` explaining its purpose — CI enforces this for reserved top-level directories.

## Standards for future code

Binding on the milestones that introduce the code:

- **Skills (Milestone 2)** follow the invariants of [ADR-0002](../architecture/ADR-0002-agent-skill-standard.md): specification-pure frontmatter, placeholder-free bodies, size budgets, self-contained directories. A dedicated skill-authoring guide ships with the skill template.
- **Analyzer scripts (Milestone 3)** are Python 3.8+ standard-library-only, exposing an argparse CLI that writes JSON to stdout with meaningful exit codes; every script ships with unit tests against recorded fixtures; redaction is on by default; unknown input schemas hard-fail with a versioned error.
- **Installer and tooling (Milestone 4)** are Node.js 18+, dependency-light, with no code execution at install time per [SECURITY.md](../../SECURITY.md).
