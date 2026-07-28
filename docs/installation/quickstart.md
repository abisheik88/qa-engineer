# Quickstart — five minutes to QA

Install the QA Automation Pack into any project without reading the repository.

## Prerequisites

- Node.js 18.18+
- An AI coding assistant that reads [Agent Skills](https://agentskills.io) (Cursor, Claude Code, OpenCode, Codex, …)

## Install

From your application directory:

```bash
# After the package is published to npm:
npx qa-engineer

# From a local checkout of this repo (today):
npm install
npx qa-engineer --yes
# or:
npm run qa -- --yes --project /path/to/your-app
```

The interactive wizard scans your environment, recommends components, installs skills, validates the install, and walks you through a guided first run.

Non-interactive (CI / scripts):

```bash
npx qa-engineer --yes --project .
```

## Verify

```bash
npx qa-engineer self-test
npx qa-engineer doctor
```

## Use it

Open your AI coding assistant and try:

1. `/qa-init` — or ask: *Analyze this repository.*
2. `/qa-run` — run your suite (Playwright is Production-ready).
3. `/qa-explore <url>` — live product QA with evidence.

## Repair and update

```bash
npx qa-engineer repair    # fix drifted or missing pack files
npx qa-engineer update    # refresh from the current pack source
```

## More

- Per-agent notes: [Installation index](README.md)
- Compatibility: [COMPATIBILITY.md](../../COMPATIBILITY.md)
