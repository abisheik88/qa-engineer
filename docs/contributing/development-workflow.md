# Development Workflow

The day-to-day loop for working on this repository: environment setup, the authoring cycle, local validation, and debugging. Process rules (branches, commits, review) live in their own [standards](README.md); this document is the practical path through them.

## Environment

Requirements: git, Node.js 18+ (used via `npx` and for the repository tooling — nothing to install), and any editor. Python 3.8+ joins the list in Milestone 3 for analyzer development.

```bash
git clone <your-fork-url>
cd qa-engineer
```

### VS Code

The repository ships workspace configuration under `.vscode/`:

- **Recommended extensions** (`extensions.json`) — VS Code offers to install them on first open: markdownlint (live feedback on the same rules CI enforces), EditorConfig (applies formatting rules as you type), and YAML (validates workflows and issue forms).
- **Settings** (`settings.json`) — final newlines, rulers, and Markdown defaults aligned with CI, so the editor never fights the checks.
- **Snippets** (`qa-pack.code-snippets`) — type `qa-skill` in a Markdown file for a complete `SKILL.md` scaffold; `qa-module` for a knowledge module header; `qa-note` / `qa-warning` for standard admonitions; `qa-adr` for an ADR skeleton.

Other editors work fine: EditorConfig support plus a markdownlint plugin reproduces the same experience.

## The validation loop

Run what CI runs, locally, before every push:

```bash
# Markdown style (all documentation)
npx --yes markdownlint-cli2 "**/*.md"

# Formatting: line endings, final newlines, indentation
npx --yes editorconfig-checker

# Skill platform: structure, frontmatter, sections, prohibitions, budgets
node scripts/validate-skills.mjs

# Shared-knowledge sync integrity
node scripts/sync-shared.mjs --check

# Description keyword collisions (advisory)
node scripts/check-keywords.mjs
```

All five are green on `main` at all times; a red check on your branch is yours. What each skill check enforces — and the error messages' meaning — is documented in [scripts/README.md](../../scripts/README.md).

## Authoring loop for skills

The full workflow is in the [authoring guide](../skills/authoring-guide.md); the tight loop looks like:

```bash
cp -r templates/skill-template skills/qa-<name>   # 1. scaffold
$EDITOR skills/qa-<name>/SKILL.md                 # 2. write
node scripts/validate-skills.mjs                  # 3. validate — fix, repeat
```

Then test it live in your own agent:

```bash
# Claude Code discovers project skills from .claude/skills/
mkdir -p .claude/skills
cp -r skills/qa-<name> .claude/skills/

# Most other agents discover from .agents/skills/
mkdir -p .agents/skills
cp -r skills/qa-<name> .agents/skills/
```

Both paths are gitignored in consumer repositories; in *this* repository, copy — do not commit the copies. Re-copy after each edit, start a fresh agent conversation (agents cache loaded skills per session), and test activation with realistic phrasing before testing the explicit command.

## Editing shared knowledge

Edit the module under `shared/`, never the synced copy inside a skill, then:

```bash
node scripts/sync-shared.mjs --write   # refresh all synced copies
node scripts/sync-shared.mjs --check   # confirm clean (CI runs this)
```

Commit the module and the refreshed copies together — CI fails the pull request if they drift.

## Debugging

**A validator error you don't understand** — every rule it enforces traces to a section of the [skill specification](../skills/skill-specification.md); the error message names the rule. If the message doesn't make the fix obvious, that's a tooling defect: file a bug with the output.

**Skill doesn't activate in your agent** — in descending order of likelihood: the copy in the discovery path is stale (re-copy); the conversation predates the copy (start a new one); the description lacks the keywords your test request uses (fix the description, not the request); another installed skill's description is winning the route (run `check-keywords`, check your globally installed skills).

**Skill activates but behaves wrong** — read the body as the agent would, cold: the defect is almost always a step that assumes context the skill never provided. The [prompt review checklist](../skills/quality-checklists.md) is the systematic version of this reading.

**Markdown lint failure you disagree with** — the configuration is [.markdownlint-cli2.jsonc](../../.markdownlint-cli2.jsonc); rules are deliberate. Propose a configuration change in its own pull request; never disable rules inline.

## Hygiene

- Never commit `.claude/`, `.agents/`, or `qa-artifacts/` content produced while testing (already gitignored — don't force-add).
- Test artifacts from live sessions (traces, screenshots) stay out of the repository entirely; recorded fixtures belong in `tests/` (Milestone 3+) and are added deliberately, redacted.
