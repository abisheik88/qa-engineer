# Evaluation Framework

How the pack proves its skills work — automated regression testing for AI skills. The **deterministic scoring layer is implemented and gates CI**: [`run_evals.py`](run_evals.py) scores committed skill outputs against their contracts and case-specific assertions, for both *golden* cases (correct behavior, which must be accepted) and *adversarial* cases (the failure modes the pack promises to prevent, which must be rejected). The **live-agent layer** — running a real headless agent against fixtures and feeding its output into this same scorer — and the **LLM rubric judge** remain for a later milestone (see [ROADMAP.md](../../ROADMAP.md)). What is designed but not yet built is called out in [Status](#status).

Testing prompts is the discipline almost no comparable project practices, and it is a first-class goal of this one. The framework is designed now, alongside the first skills, so that every skill ships against a known bar rather than a hope.

## Why evaluate skills at all

A skill is instructions an agent follows. Its quality is behavioral: does the agent, given a realistic situation, do the right thing and produce a conformant result? Unit-testing the deterministic scripts (Milestone 3+) catches mechanical faults, but only a behavioral eval catches the failures that matter for a prompt — misrouting, unjustified conclusions, ignored guardrails, malformed contracts. These evals are that safety net, and they are what makes model and agent upgrades safe to adopt.

## Layout

```text
tests/evals/
├── README.md         this file — the framework design
├── run_evals.py      the deterministic scorer + CI gate (implemented)
├── qa-init/          *.case.json — golden + adversarial cases
├── qa-generate/      *.case.json
├── qa-run/           *.case.json
├── qa-debug/         *.case.json
├── qa-fix/           *.case.json
├── qa-report/        *.case.json
├── qa/               (router cases — designed, not yet authored)
├── fixtures/         input repositories and artifacts for the live-agent layer
├── expected/         golden outputs and rubrics for the live-agent layer
└── contracts/        schema-validation checks shared across cases
```

Each skill directory holds **eval cases** as `*.case.json` manifests. A manifest
names the skill, the case `kind` (`golden` or `adversarial`), the contract to
validate against, the assertions, and the output under test (inline). `fixtures/`,
`expected/`, and `contracts/` hold the shared material the live-agent layer will
draw on.

### A case manifest

```json
{
  "skill": "qa-run",
  "kind": "adversarial",
  "contract": "skills/qa-run/contracts/execution-result.schema.json",
  "assertions": [
    { "anyOf": [
      { "path": "classification", "notEquals": "passed" },
      { "path": "execution.exitCode", "equals": 0 }
    ] }
  ],
  "output": { "classification": "passed", "execution": { "exitCode": 1 } }
}
```

Assertion operators are deterministic: `equals`, `notEquals`, `in`, `gte`, `lte`,
`minItems`, `contains`, `notContains`, `noneContains`, `present`, `absent`, and
`anyOf` (for implications such as "reported passed ⇒ exit code 0"). A `golden`
case passes when the output is contract-valid **and** every assertion holds; an
`adversarial` case passes when the scorer **rejects** the output.

## How an eval works

Each case is a triple — an input, an expected result, and a way to score the gap:

1. **Input.** A fixture (a repository in `fixtures/`, an artifact, and a request) sets up a realistic situation.
2. **Run.** The runner installs the skill into a headless agent, issues the request against the fixture, and captures the agent's actions and output.
3. **Score.** The output is graded against `expected/`, deterministic checks first.

## Scoring, in priority order

Deterministic assertions gate; judgment is advisory. In keeping with principle 1 ([deterministic over probabilistic](../../docs/engineering-principles.md)):

| Check | Kind | Role |
| --- | --- | --- |
| Contract validity | deterministic | Output validates against the skill's [output contract](../../docs/skills/output-contracts.md) — gating |
| Structural assertions | deterministic | Required fields present, classification in range, routed to the expected skill, forbidden actions absent — gating |
| Behavioral rubric | judgment | An LLM judge scores qualities a schema cannot express (was the evidence relevant? the summary honest?) — advisory, tracked as a trend |

A case fails its gate on any failed deterministic assertion. Rubric scores are recorded over time but never block a release on their own, because a probabilistic judge must not hold a deterministic gate.

## Expected inputs and outputs

- **Inputs** live in `fixtures/`: small, self-contained repositories with a known stack, plus any artifacts (a sample trace, a HAR) a case needs. Fixtures are redacted and contain no secrets.
- **Outputs** live in `expected/`: for a deterministic case, the exact assertions (routed-to skill, contract name, classification, fields that must and must not appear); for a rubric case, the scoring criteria.

## Regression philosophy

- **Baselines, not absolutes.** Each skill has a recorded baseline score. A change may not drop a skill below its baseline without an explicit, reviewed decision.
- **Re-evaluate on every relevant change.** Skill edits run that skill's cases; a model or agent-version bump runs the whole matrix, because behavior can shift under the skill without a line of it changing.
- **Determinism over flakiness.** Cases are designed to be deterministic; a case that scores nondeterministically is quarantined and fixed, not averaged.

## Release gates

A release that touches skills passes these gates ([release checklist](../../docs/skills/quality-checklists.md)):

1. Every deterministic assertion across all cases passes.
2. No skill is below its recorded baseline.
3. Contract-validity checks pass for every skill that emits a report.

Rubric trends are reviewed, not gated. Results are published with each release, so the "we test our prompts" claim is verifiable rather than asserted.

## Status

**Implemented and gating CI:**

- The deterministic scorer [`run_evals.py`](run_evals.py) (contract validity + assertions), run via `npm run validate:evals`.
- Golden + adversarial cases for the six core skills (`qa-init`, `qa-generate`, `qa-run`, `qa-debug`, `qa-fix`, `qa-report`), including the marquee anti-"hallucinated-green" cases.
- The **live-agent runner** [`run_live.py`](run_live.py) with a `replay` provider (recorded outputs) and a `command` provider (any agent CLI), the [scenarios dataset](scenarios/), the [reference captures](captures/), a committed [baseline](baselines/reference.json), and **regression detection** — run via `npm run eval:live`. See [docs/evaluation-platform.md](../../docs/evaluation-platform.md).

**Operational / not yet shipped:**

- **Runs against real hosted agents** (Claude / Cursor / Gemini / Codex / OpenCode / Antigravity) and **published cross-model drift** results — the runner and mechanism exist (`command` provider + baseline compare); executing them needs API access and is a maintainer/scheduled step, not a code gap.
- The **LLM rubric judge** (advisory scores for qualities a schema cannot express) — separate from the deterministic gate, and never gating.
- Router (`qa/`) cases and per-skill live fixtures under `fixtures/` / `expected/`.

The deterministic layer proves the contracts, the expectations, and — via the
adversarial cases — that the scorer catches bad behavior. The live layer measures
whether a real agent *produces* good behavior, using the same scorer.
