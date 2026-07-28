# Installation

Install the QA Automation Pack into any AI coding agent that reads the [Agent Skills](https://agentskills.io) standard. Skills are copied byte-for-byte — there is no per-agent rewrite.

**Start here:** [Quickstart (five minutes)](quickstart.md)

## Quickstart

```bash
# Interactive (recommended)
npx qa-engineer

# Non-interactive
npx qa-engineer --yes --project /path/to/your-app

# From a local checkout before npm publish
npm install
npm run qa -- --yes --project /path/to/your-app
```

Confirm:

```bash
npx qa-engineer self-test --project /path/to/your-app
npx qa-engineer doctor --project /path/to/your-app
npx qa-engineer verify --project /path/to/your-app
```

What gets written:

- `.agents/skills/<skill>/` — shared discovery path for most agents
- `.claude/skills/<skill>/` — when Claude Code is detected or requested
- Optional thin wrappers (OpenCode, Gemini CLI, Copilot, Antigravity)
- `qa-lock.json` — pack version + sha256 per installed file

## Commands

| Command | Purpose |
| --- | --- |
| `qa` / `qa onboard` | Interactive install + guided first-run |
| `qa install` | Non-interactive install |
| `qa verify` | Integrity check against the lockfile |
| `qa doctor` | Environment + pack diagnostics |
| `qa self-test` | PASS/FAIL smoke checks |
| `qa repair` | Fix drifted or missing pack files |
| `qa update` | Refresh from the current pack source |

Flags: `--project`, `--agent`, `--yes` / `--ci`, `--json`, `--force`, `--dry-run`, `--debug`.

## Per-agent guides

| Guide | Agent |
| --- | --- |
| [claude-code.md](claude-code.md) | Claude Code |
| [cursor.md](cursor.md) | Cursor |
| [codex-cli.md](codex-cli.md) | OpenAI Codex CLI |
| [opencode.md](opencode.md) | OpenCode |
| [gemini-cli.md](gemini-cli.md) | Gemini CLI |
| [github-copilot.md](github-copilot.md) | GitHub Copilot |
| [antigravity.md](antigravity.md) | Antigravity |
| [other-agents.md](other-agents.md) | Kimi, and any other `SKILL.md` host |

## Manual install (no CLI)

Copy any skill directory into the agent's discovery path:

```bash
mkdir -p .agents/skills
cp -R /path/to/qa-engineer/skills/qa-explore .agents/skills/
# Claude Code additionally:
mkdir -p .claude/skills
cp -R /path/to/qa-engineer/skills/qa-explore .claude/skills/
```

Then invoke `/qa-explore` (or ask the agent to QA a URL). Compatibility matrix: [COMPATIBILITY.md](../../COMPATIBILITY.md).

## Security

The installer never executes skill scripts, never edits agent security settings, and never enables telemetry. See [SECURITY.md](../../SECURITY.md).
