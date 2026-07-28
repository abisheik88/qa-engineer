# Compatibility

This document records which AI coding agents the pack targets, how each one discovers and invokes skills, and which runtimes the pack requires. It is the authoritative compatibility reference and is updated with every release.

**Test-framework** support (Playwright, Selenium, Cypress, WebdriverIO) is a separate matrix — see [docs/compatibility/framework-matrix.md](docs/compatibility/framework-matrix.md). This document covers AI-agent compatibility and runtimes.

## Release compatibility

No versions have been released yet. Beginning with the first tagged release, this section will carry a matrix of pack versions against tested agent versions and the Agent Skills specification revision each release was validated against.

## The standard this pack targets

Skills are authored against the open [Agent Skills specification](https://agentskills.io/specification): one directory per skill containing a `SKILL.md` (YAML frontmatter plus Markdown body) with optional `references/`, `scripts/`, and `assets/` directories. The specification is community-maintained and does not yet publish formally versioned releases; this pack tracks the living specification and records the revision it validated against at each release. See [ADR-0002](docs/architecture/ADR-0002-agent-skill-standard.md) for why the pack is standard-native by design.

## Target agent matrix

Verified against official documentation as of July 2026. Entries marked *unverified* rely on secondary sources and will be confirmed before the relevant integration ships.

| Agent | Native `SKILL.md` support | Skill discovery path the pack targets | Invocation surface | Planned tier |
| --- | --- | --- | --- | --- |
| Claude Code | Yes (format originator) | `.claude/skills/` (project), plugins | `/skill-name`, auto-activation | Tier 1 |
| OpenAI Codex CLI | Yes | `.agents/skills/` | `$skill-name` mention, `/skills` menu, auto-activation | Tier 1 |
| OpenCode | Yes | `.agents/skills/`, `.opencode/skills/` | native `skill` tool (auto); slash via generated commands | Tier 1 |
| Cursor | Yes (2.4+) | `.agents/skills/`, `.cursor/skills/` | `/skill-name`, auto-activation | Tier 2 |
| GitHub Copilot | Yes (VS Code, JetBrains, CLI, cloud) | `.agents/skills/`, `.github/skills/` | `/skill-name` in VS Code; auto-activation elsewhere | Tier 2 |
| Gemini CLI | Yes | `.agents/skills/`, `.gemini/skills/` | auto-activation; slash via generated commands | Tier 2 |
| Antigravity | Yes | `.agents/skills/` | auto-activation; slash via workflows (*path unverified*) | Tier 2 |
| Kimi / other Agent Skills hosts | Yes (copy) | `.agents/skills/` (or product-specific path) | auto-activation / product slash | Tier 2 |

Two facts shape the integration design:

1. Six of the seven primary agents read `.agents/skills/` directly; Claude Code additionally requires `.claude/skills/`. A single canonical skill set therefore covers every target with copies, not conversions. Additional hosts (Kimi and peers) use the same copy path — see [docs/installation/other-agents.md](docs/installation/other-agents.md).
2. Description-driven auto-activation is the only invocation channel available on all primary agents. Slash-command ergonomics on Gemini CLI, OpenCode, and Antigravity require thin generated wrappers from the installer (`qa install`).

## Support tiers

| Tier | Meaning | Bar |
| --- | --- | --- |
| Tier 1 — CI-tested | Exercised by the automated evaluation harness on every release | Headless execution available and evaluations passing |
| Tier 2 — community-verified | Installed and manually smoke-checked; issues triaged with priority | Documented install path and at least one verified walkthrough |

The tier column in the matrix above is the **planned** tier — the level each agent is expected to occupy. It is not achieved status. No release has occurred and the M10 evaluation harness has not run, so **no agent has yet met the Tier 1 bar** (headless execution exercised by passing evaluations). Until M10 runs, treat every entry as a target, not a verified result. Tier assignments are re-examined at every release and when an agent ships format changes.

## Runtime requirements

| Requirement | Status | Used for |
| --- | --- | --- |
| Python 3.8+ | Required for analysis | The deterministic analysis toolkit (`shared/analysis/lib/`) and framework analyzers — standard library only, no packages |
| Node.js 18+ | Required for the installer CLI | `npx qa-engineer` / `qa install` / `qa doctor` / `qa self-test` (interactive onboarding uses `--yes` / `--ci` in non-TTY and CI) |

The analysis toolkit is standard-library-only Python, so it runs on any Python 3.8+ interpreter with nothing to install. Requirements are declared per skill via the specification's `compatibility` frontmatter field, and the pack degrades gracefully: skills describe a manual fallback whenever a runtime or optional integration (such as an MCP server) is unavailable.

## Reporting compatibility problems

If a listed agent fails to discover or activate the pack's skills once they ship, file a bug report with the agent name, agent version, and the discovery path in use. Compatibility reports are triaged ahead of feature work.
