# Compatibility

This document records which AI coding agents the pack targets, how each one discovers and invokes skills, and which runtimes the pack requires. It is the authoritative compatibility reference and is updated with every release.

**Test-framework** support (Playwright, Selenium, Cypress, WebdriverIO) is a separate matrix — see [docs/compatibility/framework-matrix.md](docs/compatibility/framework-matrix.md). This document covers AI-agent compatibility and runtimes.

## Release compatibility

| Pack version | Released | Discovery paths verified against agent docs | Live agent runs |
| --- | --- | --- | --- |
| 0.9.0, 0.9.1 | 2026-07-28 | Not systematically re-read for the release | Claude Code, Cursor (manual, by the maintainer) |
| 0.9.2 | 2026-07-28 | Yes — every host's own documentation, re-read on 2026-07-28 (sources in the matrix below) | Claude Code, Cursor (manual, by the maintainer) |

"Verified" in the third column means the discovery paths in the matrix below were read off each host's own documentation on that date and are asserted against the installer by `packages/installer/test/hosts.test.mjs`, which fails if the installer writes to a path that host does not document reading. It does **not** mean the pack was executed inside every host: that is the Tier 1 bar, and only Claude Code and Cursor have had a real run.

Documentation is re-read at each release. A test can pin the installer to a recorded claim; it cannot notice that a vendor moved a directory, so that check is a release step performed by a person.

## The standard this pack targets

Skills are authored against the open [Agent Skills specification](https://agentskills.io/specification): one directory per skill containing a `SKILL.md` (YAML frontmatter plus Markdown body) with optional `references/`, `scripts/`, and `assets/` directories. The specification is community-maintained and does not yet publish formally versioned releases; this pack tracks the living specification and records the revision it validated against at each release. See [ADR-0002](docs/architecture/ADR-0002-agent-skill-standard.md) for why the pack is standard-native by design.

## Target agent matrix

Each row's discovery paths were read off that host's own documentation on **2026-07-28** and are recorded in the installer's agent registry, where a test asserts the installer writes to one of them. The **bold** path is the one `qa install` targets.

| Agent | Paths this host reads (project) | Pack installs to | How you reach a skill | Source | Planned tier |
| --- | --- | --- | --- | --- | --- |
| Claude Code | `.claude/skills/` | **`.claude/skills/`** | `/qa-explore`, or describe the task | [docs](https://code.claude.com/docs/en/skills) | Tier 1 |
| OpenAI Codex CLI | `.agents/skills/` — at the working directory, its parent, and the repo root. There is **no** `.codex/skills/` | **`.agents/skills/`** | `$qa-explore`, or `/skills` to browse | [docs](https://developers.openai.com/codex/skills) | Tier 1 |
| OpenCode | `.agents/skills/`, `.opencode/skills/`, `.claude/skills/` | **`.agents/skills/`** | `/qa-explore` (generated command), or the agent's own `skill` tool | [docs](https://opencode.ai/docs/skills/) | Tier 1 |
| Cursor | `.agents/skills/`, `.cursor/skills/`, plus Claude and Codex directories | **`.agents/skills/`** | `/` in Agent chat, then pick the skill | [docs](https://cursor.com/docs/skills) | Tier 2 |
| Antigravity | `.agents/skills/` (default), `.agent/skills/` (legacy) | **`.agents/skills/`** | describe the task — skills auto-activate | [docs](https://antigravity.google/docs/skills) | Tier 2 |
| GitHub Copilot | `.agents/skills/`, `.github/skills/` | **`.agents/skills/`** | `/qa-explore` in Copilot Chat (generated prompt file) | [docs](https://docs.github.com/en/copilot) | Tier 2 |
| Gemini CLI | `.agents/skills/`, `.gemini/skills/` | **`.agents/skills/`** | `/qa-explore` (generated command) | [docs](https://google-gemini.github.io/gemini-cli/) | Tier 2 |
| Kimi (Agent Skills copy) / other spec-compliant hosts | `.agents/skills/` | **`.agents/skills/`** | product's own surface | [spec](https://agentskills.io/specification) | Tier 2 |

Three facts follow from that table and shape the design:

1. **One path serves seven of the eight hosts.** Everything except Claude Code reads `.agents/skills/`, so `qa install` writes the same canonical skill set there — copies, never conversions. Claude Code gets `.claude/skills/` as well, and a project where only Claude Code is detected still receives the shared path, so opening the same repository in Cursor or Codex tomorrow needs no reinstall.
2. **Auto-activation is the only channel every host shares.** Codex takes `$qa-explore`, Cursor matches on `/`, OpenCode's agent calls a `skill` tool. `qa install` prints the convention for the host it detected, because a user who types the wrong one has no way to tell a wrong keystroke from a failed install.
3. **Slash ergonomics on Gemini CLI, OpenCode, and Copilot need a thin generated wrapper.** Those wrappers are rendered from skill frontmatter alone (ADR-0002), capped at 15 lines, and carry no knowledge. Antigravity's workflow directory (`.agents/workflows/`) is *not* documented by Google, so those wrappers are generated only on explicit `--agent antigravity`; skills themselves work there without them.

**Antigravity detection is deliberately conservative.** Its skills live at `.agents/skills/`, which is also the path this installer creates for every host — so detecting Antigravity from `.agents/` would mean detecting it because the pack had run once before. An earlier release did exactly that and reported a host that was never there. Skills work in Antigravity either way; only the optional workflow wrappers need `--agent antigravity`.

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

## Operating systems

| OS | Status |
| --- | --- |
| Linux | Verified — every CI job runs on Ubuntu |
| macOS | Expected to work; not covered by CI |
| Windows | Expected to work; **not yet verified end to end** |

The installer uses Node's platform-independent path handling, and the skills
invoke their bundled engine through a launcher (`scripts/qa_tool.py`) that needs
no shell features — the command shape is identical in bash, zsh, PowerShell, and
cmd.exe. The one difference on Windows is the interpreter name: use `python` where
`python3` is not on PATH.

Until a Windows run is confirmed, that row says "expected", not "supported".

The analysis toolkit is standard-library-only Python, so it runs on any Python 3.8+ interpreter with nothing to install. Requirements are declared per skill via the specification's `compatibility` frontmatter field, and the pack degrades gracefully: skills describe a manual fallback whenever a runtime or optional integration (such as an MCP server) is unavailable.

## Reporting compatibility problems

If a listed agent fails to discover or activate the pack's skills once they ship, file a bug report with the agent name, agent version, and the discovery path in use. Compatibility reports are triaged ahead of feature work.
