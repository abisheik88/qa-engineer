# tests/

The pack's validation and evaluation harness. The [evaluation framework](evals/README.md) — how the pack proves its skills behave correctly — is **designed** here now; its runner, fixtures, and cases are **implemented** in a later milestone (see [ROADMAP.md](../ROADMAP.md)).

## Contents

| Path | Purpose | Status |
| --- | --- | --- |
| [evals/](evals/README.md) | Automated skill regression testing: cases, fixtures, expected outputs, scoring, release gates | Design complete; implementation later |

Analyzer unit tests (for the deterministic scripts introduced with the tooling layer) will live beside the scripts they test, inside each skill's `tests/` directory, per [skill anatomy](../docs/skills/skill-anatomy.md) — not here. This directory holds cross-skill behavioral evaluation; a skill's own script tests stay with the skill so it remains self-contained.

## Rules that govern this directory

- Deterministic assertions gate releases; judge-model scores are advisory only ([evals design](evals/README.md)).
- Fixtures containing deliberate defects are clearly marked and excluded from every published artifact, per [SECURITY.md](../SECURITY.md).
- Repository-hygiene checks (Markdown lint, formatting, links, structure) and skill-platform validation run from [.github/workflows/](../.github/workflows/ci.yml), not here; this directory is for evaluating the pack's *behavior*, not its formatting.
