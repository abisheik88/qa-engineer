# Expected outputs

The other half of each eval case: what a skill should produce for a given fixture, and how the gap is scored. Implemented with the runner in a later milestone; this README specifies the format.

## Two kinds of expectation

- **Deterministic expectations** — the exact, checkable facts a correct output must contain: the skill routed to, the contract name, the classification value, fields that must appear, and fields or actions that must *not* (a forbidden-action list). These gate a case.
- **Rubric expectations** — criteria for an LLM judge to score qualities a schema cannot express: the honesty of a summary, the relevance of chosen evidence, the sensibleness of a scope. These are advisory and tracked as trends.

## Keying

Each expectation file is keyed to its case and fixture, so a case is the join of three things: a [fixture](../fixtures/README.md) (input), an expectation here (output), and the scoring kind. This separation lets one fixture serve several cases and one expectation be reviewed independently of the fixture.

## Rules

- **Derived from truth, not from output.** Deterministic expectations come from the fixture's documented stack, never from running the skill and recording what it happened to say — that would make the eval validate the skill against itself.
- **Minimal and specific.** Assert the facts that matter for the case, not the entire output; over-broad expectations turn benign wording changes into false failures.
- **Baselines live here too.** Each skill's recorded baseline score sits alongside its expectations, so a regression is visible in review.
