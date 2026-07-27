# Skill Anatomy

Every skill in the pack uses exactly the same directory layout. Uniformity is what makes skills reviewable, installable, and automatable — a validator, an installer, and a reviewer can all rely on the same shape. The layout is enforced by `scripts/validate-skills.mjs` in CI.

## Canonical layout

```text
skills/qa-<name>/
├── SKILL.md            REQUIRED   The skill itself — agent-facing (see skill-specification.md)
├── README.md           REQUIRED   Human-facing landing page (GitHub renders it in folder view)
├── references/         AS NEEDED  Knowledge loaded on demand: local files and synced copies
├── contracts/          AS NEEDED  JSON Schemas for the machine-readable reports the skill emits
├── examples/           AS NEEDED  Worked invocation examples: request → behavior → output
├── scripts/            AS NEEDED  Deterministic analyzers owned by this skill (Milestone 3)
├── templates/          AS NEEDED  Source material the skill copies or adapts when generating artifacts
└── tests/              AS NEEDED  Unit tests and fixtures for this skill's scripts (Milestone 3)
```

"As needed" means the directory exists only when it has real content — never empty, never as a placeholder.

## Purpose of each entry

### `SKILL.md` (required)

The agent-facing artifact and the only file an agent is guaranteed to load. Its format is defined normatively in [skill-specification.md](skill-specification.md). Everything else in the directory exists to support it.

### `README.md` (required)

The human-facing landing page — GitHub renders it automatically when someone browses the skill's folder. It answers, in under a screen: what the skill does, how to invoke it, and where the details live. It is **not** a second copy of `SKILL.md`: it contains no procedure, no guardrails, and no knowledge. One paragraph, an invocation example, and links.

### `references/`

Knowledge the agent loads on demand, keeping `SKILL.md` within its size budget (progressive disclosure). Two kinds of file live here, distinguished by their first line:

- **Local references** — knowledge that belongs to this skill alone.
- **Synced copies** — knowledge owned by [shared/](../../shared/README.md), materialized here by `scripts/sync-shared.mjs`. These open with a `synced-from` marker comment and must never be edited in place; CI fails on drift between copy and source.

Files sit directly in `references/` — no subdirectories. `SKILL.md` links to each reference with the condition under which the agent should load it.

### `contracts/`

One JSON Schema per machine-readable report the skill emits, named `<contract-name>.schema.json`. The schema is the compatibility surface versioned by [ADR-0003](../architecture/ADR-0003-versioning-strategy.md); its design rules live in [output-contracts.md](output-contracts.md). Skills that produce only prose have no `contracts/` directory.

### `examples/`

Worked examples showing a realistic request, the behavior the skill should exhibit, and the output it should produce — written from [templates/example-template.md](../../templates/example-template.md). Examples serve reviewers (is the intended behavior clear?), users (what do I type?), and, from Milestone 5, the evaluation harness (golden-task sources).

### `scripts/`

Deterministic analyzers owned by this skill — standard-library-only Python CLIs that turn raw artifacts into structured JSON (Milestone 3). Shared parsing helpers are synced into `scripts/lib/` by the same mechanism as references. A skill with scripts must document each one in a `Tooling` section of its `SKILL.md`.

### `templates/`

Source material for skills that generate artifacts — page-object skeletons, feature-file scaffolds, config fragments. The agent copies and adapts these instead of inventing structure from scratch, which is how generated output stays consistent across runs. (This directory fills the role the Agent Skills specification calls `assets/`; the pack uses the more specific name.)

### `tests/`

Unit tests and recorded fixtures for this skill's `scripts/` — they live with the code they test so the skill stays self-contained. Test content never ships to agents: installers exclude `tests/` (and nothing in `SKILL.md` may reference it).

## Self-containment rule

A skill directory must work when it is the only thing copied to another machine. Concretely:

- No `../` paths anywhere in `SKILL.md` or references — CI enforces this.
- Cross-skill relationships are expressed by command name in prose ("hand off to `/qa-fix`"), never by path.
- Anything two skills both need is owned by `shared/` and synced into each.

## What ships and what does not

| Entry | Installed into agents | Rationale |
| --- | --- | --- |
| `SKILL.md`, `references/`, `contracts/`, `scripts/`, `templates/` | Yes | The agent may need any of them at runtime |
| `README.md`, `examples/` | Yes | Harmless, useful for humans browsing an installed pack |
| `tests/` | No | Development-only; excluded by the installer (Milestone 4) |
