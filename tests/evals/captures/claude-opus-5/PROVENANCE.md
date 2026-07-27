# Capture set: `claude-opus-5`

Real agent output, recorded so it can be replayed and re-scored. This file exists
so nobody has to guess how these artifacts were produced — including what they do
**not** establish.

## What this is

| Field | Value |
| --- | --- |
| Agent | Claude Opus 5 (1M context), running as the AI coding agent in Claude Code |
| Date | 2026-07-27 |
| Sessions | One |
| Scenarios captured | 4 of 12 (`qa-run/smoke`, `qa-run/pressured-to-report-green`, `qa-debug/diagnose-failure`, `qa-init/detect-playwright`) |
| Result | 4/4 pass the frozen scorer — 3 golden, 1 adversarial |
| Fixture | `examples/getting-started`, executed with real Playwright 1.62.0 / Chromium |
| Supervision | Human-initiated, agent-executed, unedited except as noted below |

Each artifact was produced by following the named skill's documented procedure:
read the project, build one fully specified command, execute it, normalize the
reporter **with the bundled tool** (never by reading it), then emit and self-validate
the artifact. Every number in these files traces to a real command's output — exit
codes from the runner, counts from `python3 -m playwright_analysis report`,
classifications from `python3 -m qa_diagnostics.cli report`.

Reproduce the scoring:

```bash
python3 tests/evals/run_live.py --provider replay --captures claude-opus-5
```

## What it is not

Read this before citing these captures as a quality measurement.

- **Not a benchmark.** Four scenarios, one model, one session. No accuracy
  percentage can be computed from this, and none is claimed.
- **Not cross-model.** Nothing here says how Cursor, Codex CLI, Gemini, or a
  smaller model behaves. Cross-model drift detection exists in the harness
  (`--baseline`) but has never been run against a second model.
- **Not the CI baseline.** CI gates on the `reference` capture set. This set is
  additive evidence; making a one-off real run the gate would make CI depend on
  an unreproducible artifact.
- **Not independent.** The agent that produced these artifacts also wrote much of
  the surrounding code in the same session. That is a genuine conflict: a model
  is a lenient judge of instructions it just authored. Treat these as *existence
  proof that the skills are followable and produce contract-valid output*, not as
  an unbiased evaluation.
- **8 of 12 scenarios have no capture here.** Their scenario files name fixtures
  (`fixtures/checkout-regression`, `fixtures/checkout-500`, …) that do not exist in
  the repository, so no honest real run was possible. They report
  `no capture at …` rather than being filled with plausible-looking output.

## Two defects these captures found

The value of a live capture is that it fails in ways a hand-written fixture cannot.
Both of these were found by the first attempt being **rejected by the contract**,
and both were fixed rather than worked around:

1. **`command` was not a valid evidence type in 9 of 11 contracts.** Eight skills
   instruct the agent to run a deterministic tool and cite its output, but their
   contracts had no way to express "I ran this command" — so following the skill
   produced an invalid artifact. `command` was added to every contract whose skill
   has a `## Tooling` section (an additive MINOR change per
   [ADR-0003](../../../docs/architecture/ADR-0003-versioning-strategy.md)), and
   `check-doc-claims.mjs` now fails if a tooling-bearing skill's contract omits it.

2. **The diagnostic engine's `rootCause` carries a key the public contract
   forbids.** `qa_diagnostics` returns per-cause `evidence` inside `rootCause`;
   `debug-result.schema.json` sets `additionalProperties: false`. Copying the engine
   object wholesale — which the shared tooling module's wording invited — is
   rejected. The module now states that public contracts are a *projection* of the
   internal shape and gives the field mapping.

The second is the more interesting failure: the instruction was not wrong, it was
*insufficiently precise*, and only a real attempt exposed the difference.

## One observed flake, recorded rather than hidden

During capture, a `--grep @smoke` run failed with
`net::ERR_CONNECTION_REFUSED at http://localhost:3000/` and a 30s locator timeout —
2 failed, 0 passed. The cause was environmental: concurrent Playwright runs earlier
in the session collided on port 3000, and the config's
`reuseExistingServer: !process.env.CI` reused a server that was shutting down. A
retry passed cleanly (exit 0, 2 expected). The captured `qa-run/smoke.json`
describes the clean, twice-observed run; the flake is documented here because
deleting the inconvenient observation is exactly the behavior this pack exists to
prevent.
