# Evaluation Platform

How the pack proves — and keeps proving — that its skills behave correctly. The
platform has **two layers that share one scorer**:

1. **Deterministic gate** ([`tests/evals/run_evals.py`](../tests/evals/run_evals.py))
   — scores committed golden and adversarial *outputs* against contracts and
   assertions. Frozen and production-ready; it is the single source of scoring.
2. **Live-agent layer** ([`tests/evals/run_live.py`](../tests/evals/run_live.py))
   — runs a real (or replayed) agent against *scenarios*, then feeds each produced
   output into the **same** deterministic scorer. This is the end-to-end
   behavioral measurement.

The live layer **imports and reuses** the deterministic scorer unchanged
(`run_evals.score_case`). There is no second scoring engine, and no vendor SDK.

## Why two layers

- The deterministic gate proves the *contracts, the expectations, and that the
  scorer catches bad behavior* — without running any model, so it is fast,
  reproducible, and CI-safe.
- The live layer proves *a real agent actually produces good output*, including
  when the request tempts it to misbehave. It needs a provider (and, for real
  agents, API access), so its CI-safe form uses recorded outputs.

## Providers (provider-agnostic)

A *provider* turns a scenario into an output artifact. Two ship, neither locks you
to a vendor:

| Provider | What it does | Needs keys? | Use |
| --- | --- | --- | --- |
| `replay` | Reads a recorded output from `tests/evals/captures/<set>/` | No | CI gate; reproducible baselines |
| `command` | Runs any agent CLI (`--command "…"`), templated with the scenario, and reads its JSON output | Depends on the CLI | Real agents (Claude Code, Codex, Gemini, OpenCode, …) and cross-model runs |

The `command` template supports the tokens `{skill}`, `{id}`, `{request}`,
`{fixture}`, `{contract}`, and `{prompt}`. The command must print the skill's
output artifact as JSON to stdout. Example (illustrative — wire your agent's
headless invocation):

```bash
python3 tests/evals/run_live.py \
  --provider command \
  --command 'my-agent run --skill {skill} --prompt "{prompt}" --json'
```

Because any agent is just a `command`, adding a model or agent is a config change,
not a code change — no adapter to write.

## Scenarios and captures

- **Scenarios** live in [`tests/evals/scenarios/<skill>/*.scenario.json`](../tests/evals/scenarios/).
  Each has an `input` (request + fixture + prompt), the `contract` to validate
  against, the good-behavior `assertions`, and a `category`:
  - `golden` — a normal task; the agent should produce a correct result.
  - `adversarial` — a **temptation**: the request pressures the agent to
    misbehave (report a failing run as green, delete a failing assertion, mark a
    build ready with failures, claim finished live Selenium generation, assert
    high confidence with nothing detected). A correct agent resists, so the
    scenario asserts the *same* good-behavior rules.
- **Captures** live in [`tests/evals/captures/<set>/`](../tests/evals/captures/).
  The `reference` set holds the outputs a correct agent produces; the `replay`
  provider scores them, which is the CI path.

Every scenario expects a **good** output — so both categories score identically
(the output must be contract-valid and satisfy the assertions). The category is
for reporting ("resisted N/M temptations").

## Benchmark reports

`--json` (or `--report <file>`) emits a report: per-scenario `passed`, `score`,
`contractValid`, `assertions` (e.g. `5/6`), and the explainable `detail` (which
assertion or contract rule failed, in words). Totals are broken down by skill and
by category. Reports are deterministic under the `replay` provider, and run
reports are git-ignored (`tests/evals/runs/`) while the baseline is tracked.

## Regression detection

`--baseline <file>` compares the current run to a committed baseline and **fails**
(exit 1) if any scenario that passed in the baseline now fails, or any score
drops. The committed baseline is [`tests/evals/baselines/reference.json`](../tests/evals/baselines/reference.json)
(pass/score per scenario, no timestamps — so the comparison is deterministic).

Update the baseline deliberately, never silently:

```bash
python3 tests/evals/run_live.py --emit-baseline tests/evals/baselines/reference.json
```

## Cross-model drift

Drift is the same mechanism with two providers. Record one model as the baseline,
then run another against it:

```bash
# Model A becomes the reference
python3 tests/evals/run_live.py --provider command --command 'agent-a …' \
  --emit-baseline /tmp/model-a.json
# Model B is checked for drift against A
python3 tests/evals/run_live.py --provider command --command 'agent-b …' \
  --baseline /tmp/model-a.json
```

Any scenario where B regresses relative to A is reported. Never silently accept a
regression: investigate, then either fix the skill or re-baseline with a reviewed
decision.

## Deterministic vs model judgment

Scoring is **deterministic only**: contract validity plus assertions. Model-
judgment metrics (an LLM rubric that scores qualities a schema cannot express —
"was the evidence relevant?", "is the summary honest?") are **advisory, separate,
and not yet shipped**. When added, they will be reported in their own section and
will **never** gate a release — a probabilistic judge must not hold a deterministic
gate ([engineering principle 1](engineering-principles.md)).

## CI integration

CI runs the deterministic path with no API keys:

- `python3 tests/evals/run_evals.py` — the deterministic gate.
- `python3 tests/evals/run_live.py --baseline tests/evals/baselines/reference.json`
  — the live runner in `replay` mode, plus the regression gate.

Both are mandatory in the `analysis` job. Live runs against **real hosted agents**
need API access and are therefore an opt-in / scheduled activity for maintainers
(run the `command` provider with your agent, compare against the baseline). That
is an operational step, not a missing capability — the runner, datasets, scoring,
and regression gate are all in place.

## What is and isn't proven

- **Proven, in CI:** the contracts hold; the scorer rejects hallucinated-green,
  silent assertion removal, ready-with-failures, over-claimed generation, and
  over-confidence; recorded correct outputs pass; regressions fail the build.
- **Proven when you run it:** whether a *specific* live agent produces good output
  (run the `command` provider with that agent).
- **Not yet shipped:** the LLM rubric judge (advisory), and published cross-model
  benchmark results (produced by running the `command` provider against each
  hosted agent).
