# ADR-0002: Author skills in the open Agent Skills standard with no compile step

- **Status:** Accepted
- **Date:** 2026-07-17

## Context

The pack targets seven AI coding agents: Claude Code, Cursor, Antigravity, OpenAI Codex CLI, GitHub Copilot, Gemini CLI, and OpenCode. Verification against official documentation (July 2026) established:

- All seven natively parse skills in the open Agent Skills format — a directory containing `SKILL.md` with YAML frontmatter (`name`, `description`, optional `license`, `compatibility`, `metadata`) plus optional `references/` and `scripts/`.
- Six of seven discover skills from `.agents/skills/`; Claude Code uses `.claude/skills/`. Installation is therefore a copy problem, not a conversion problem.
- The specification requires runtimes to ignore unknown frontmatter keys, so vendor-specific extras can coexist in one canonical file.
- Description-driven auto-activation works on all seven agents; explicit slash invocation does not — Gemini CLI, OpenCode, and Antigravity need small companion files for slash ergonomics.
- Argument-substitution syntax inside skill bodies is portable on no agent except one; shell-injection and execution-directive syntax is single-agent and renders as noise elsewhere.
- At least one agent budgets installed skill descriptions to a small fraction of context and silently drops the rest; two agents deprecated their proprietary prompt formats in favor of the standard within the last year.

The contested question was whether to author in a richer canonical superset compiled per agent, or to author directly in the portable standard.

## Decision

Skills are authored directly in the open Agent Skills standard, in `skills/<name>/`, and are runtime-valid exactly as committed. The rules that make this hold:

1. **No transformation, ever.** No build step may rewrite a skill body or frontmatter. What a reviewer sees on GitHub is byte-for-byte what every agent executes.
2. **Spec-pure frontmatter, tolerated extras.** Required fields follow the specification exactly (kebab-case `name` matching the directory, keyword-rich `description` within limits). Vendor extras may appear only where every other runtime safely ignores them, and no behavior may depend on them.
3. **Placeholder-free, agent-syntax-free bodies.** No substitution tokens, no shell-injection syntax, no agent-specific execution directives. Bodies address arguments with "the user's request follows in the conversation."
4. **Shared knowledge is materialized by copy.** A sync tool copies declared `shared/` modules into each skill's `references/` and shared script libraries into each skill's `scripts/lib/`; the copies are committed and CI fails on drift. Cross-skill relative paths are banned so every installed skill is self-contained.
5. **Per-agent variance is confined to generated wrappers.** Where slash ergonomics need a companion file, the installer renders one from skill frontmatter alone — at most 15 lines, zero knowledge content.
6. **Size and budget discipline is CI-enforced**: body line/token ceilings per the specification's progressive-disclosure guidance, and a hard cap on the sum of all skill descriptions.

## Alternatives considered

- **Canonical superset plus per-agent compiler** (extension frontmatter namespace, build-time include splicing, per-agent overrides, committed `dist/` trees): rejected. It scores higher on per-agent polish, but every point of that ceiling is bought with structural costs: contributors must learn a private format and build pipeline; bugs get reported against generated line numbers that exist nowhere in source; and eight adapters sit directly in the blast radius of agent-format churn. The contributor-experience and churn-resilience losses are unrecoverable, while the fidelity gains are marginal in an ecosystem that already parses the standard natively.
- **MCP-server-first** (ship the intelligence as a server exposing tools and prompts; skills as thin wrappers): rejected. It converts a Markdown-contribution project into a server project, requires a running process, depends on the least-standardized configuration surface across the seven agents, and hides the pack's knowledge from description-driven activation — the only universal channel.
- **Hand-maintained per-agent asset sets**: rejected without prototyping; it is the duplication problem this project exists to end.

## Consequences

- Contribution is "edit one Markdown file, test it live in your own agent, open a pull request" — the lowest possible barrier for the QA engineers the project needs.
- Agent-format churn lands on the agents (which converge on the standard), not on a conversion layer; only 15-line wrappers can break, and they contain nothing worth losing.
- The pack forgoes single-agent power features (execution directives, context forking, pre-invocation injection) and per-agent description tailoring. One narrow escape hatch is permitted if description budgets prove too tight on one agent: an alternate short description consumed at install time. Body variants remain forbidden.
- The sync tool is deliberately the only build machinery in the project and must stay copy-only; any pressure to make it transform content is pressure to reopen this ADR, not to extend the tool.
- Five integration questions remain open for validation during implementation (duplicate discovery, description budgets, Antigravity workflow paths, trailing-argument handling, reference-following reliability); they are recorded in [overview.md](overview.md) and must be resolved before the affected milestone ships.
