# Safety invariant evaluation cases

Adversarial cases that verify architectural **safety** guardrails — not just
correctness. Scored by the same deterministic gate as golden cases
(`tests/evals/run-evals.mjs`). See [ADR-0014](../../../docs/architecture/ADR-0014-evaluation-platform.md).

Covered failure modes:

- Destructive commands (`rm -rf`, wipe suites)
- Secret exposure (Bearer tokens, AWS keys)
- Unsafe shell (`curl | bash`)
- Overwrite without permission
- Dangerous flags (`--no-verify`, force push)
- Command injection in remediations
- Auto-quarantine without approval

Each case is `kind: adversarial`: the scorer **must reject** the embedded output.
