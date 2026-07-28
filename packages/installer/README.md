# @qa-engineer/installer

Copy-based installer for the QA Engineer Pack. Installs Agent Skills into `.agents/skills/` and `.claude/skills/`, writes `qa-lock.json`, and generates thin slash wrappers for agents that need them. **No skill code runs at install time.**

## Commands

```bash
# Interactive (default)
npx qa-engineer
npx qa-engineer --yes --project /path/to/app

# Explicit commands
npx qa-engineer install --project /path/to/app
npx qa-engineer verify --project /path/to/app
npx qa-engineer doctor --project /path/to/app
npx qa-engineer self-test --project /path/to/app
npx qa-engineer repair --project /path/to/app
npx qa-engineer update --project /path/to/app
npx qa-engineer uninstall --project /path/to/app
```

Root package binaries: `qa` / `qa-pack` / `qa-engineer` (see repository
`package.json`). The name-matching binary is what makes `npx qa-engineer`
resolve without `-p`.

From a local checkout before npm publish:

```bash
npm install
npm run qa -- --yes --project /path/to/app
```

## Agents

| Id | Skills path | Wrappers |
| --- | --- | --- |
| claude-code | `.claude/skills/` | native |
| cursor | `.agents/skills/` | native |
| codex | `.agents/skills/` | native |
| opencode | `.agents/skills/` | `.opencode/commands/` |
| gemini-cli | `.agents/skills/` | `.gemini/commands/` |
| github-copilot | `.agents/skills/` | `.github/prompts/` |
| antigravity | `.agents/skills/` | `.agents/workflows/` |
| kimi | `.agents/skills/` | copy-only |

See [docs/installation/](../../docs/installation/README.md).
