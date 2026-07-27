# Execution Strategies

The strategies a run can take, and how one is chosen. A strategy is the answer to "how much, and which tests, and how" — it determines scope, which the command builder turns into a command. Choosing the narrowest strategy that satisfies the intent is the rule: running more than asked wastes time and buries signal.

## The strategies

| Strategy | Intent | Scope it resolves to |
| --- | --- | --- |
| `smoke` | Fast confidence check | The tests tagged or configured as smoke |
| `regression` | Thorough pre-merge or pre-release pass | The full regression set |
| `full-suite` | Everything | Every test |
| `changed` | Only what a diff touched | Tests mapped to changed files |
| `single-spec` | One named spec | That file |
| `targeted` | Several named specs | Exactly those files |
| `tag-based` | Tests carrying a tag or label | The tag's matching set |
| `directory-based` | Tests under a path | That directory |
| `failed-only` | Re-run last run's failures | The failures recorded in the previous result |
| `retry` | Re-run with test-level retries to observe flakiness | The same scope as the prior run, with retries enabled |

## Inputs and outputs

- **Inputs:** the user's intent (from the request), the project conventions and tags (from `.qa/context.md`), and, for `changed`, `failed-only`, and `retry`, prior state — a diff, or a previous execution result.
- **Outputs:** a strategy name (the result's classification of *what kind of run this is*), an include set, an optional exclude set, and the evidence level to capture. These feed the command builder and the artifact collector.

## Decision tree

Applied top to bottom; the first match wins:

```text
  named spec files present?            → single-spec (one) / targeted (several)
  a tag or label named?                → tag-based
  a directory or path named?           → directory-based
  request references a diff or branch? → changed
  request says re-run failures?        → failed-only   (needs a prior result)
  request says smoke / quick?          → smoke
  request says regression / full?      → regression / full-suite
  retries requested to check flake?    → retry
  none of the above, suite is small?   → full-suite
  none of the above, suite is large?   → ask one question (smoke or full?)
```

`changed`, `failed-only`, and `retry` depend on state that must exist. If the diff, prior result, or mapping is unavailable, the strategy cannot run: the engine stops and explains what is missing rather than silently widening to a full run.

## Dependencies and current limits

- `changed` needs a file-to-test mapping. The mapping is a later-milestone capability; until it exists, `changed` stops and explains that impact mapping is not yet available, and offers the nearest runnable strategy (for example, `directory-based` on the changed area).
- `failed-only` needs a previous execution result to read failures from; without one it stops and recommends a prior run.

Recording, as evidence, the signal that selected the strategy is required — a strategy is a conclusion and needs support.

## Extension

New strategies are added here, as a row and a decision-tree branch, and consumed by the command builder through scope. They are framework-agnostic: a strategy describes intent, and each framework's adapter already knows how to realize any scope. Adding a strategy therefore never touches a framework module.
