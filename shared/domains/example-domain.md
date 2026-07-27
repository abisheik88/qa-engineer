# Example Domain Module

> **Note:** this module exists to validate the shared knowledge engine — the sync mechanism, the module format, and the review flow. It is consumed by the `qa-example` reference skill and is superseded by the real domain catalog in Milestone 3.

## Scope

Demonstrates the structure every knowledge module follows: a scope statement, normative rules an agent can execute, and the boundaries of the topic. A module covers one bounded topic; if a section outgrows the topic, it becomes its own module.

## Rules

1. State rules in the imperative, numbered, most important first — an agent should be able to apply them in order.
2. Make each rule verifiable: pair every "prefer X" with what disqualifies X, so the agent can tell when the rule was followed.
3. Keep judgment separable from mechanics: what to decide lives in domain modules; how to express the decision in a specific tool lives in framework modules that cross-reference this one.

## Decision table

Modules prefer tables and decision trees over prose, because agents execute them more reliably:

| Situation | Do | Because |
| --- | --- | --- |
| Rule applies cleanly | Apply it and cite the module in your reasoning | Users can trace advice to its source |
| Rules conflict | Apply the lower-numbered rule | Modules order rules by priority |
| No rule covers the case | Say so explicitly and reason from evidence | An honest gap beats a confident guess |

## Boundaries

Out of scope for this module: everything — it demonstrates format, not knowledge. A real module states here which neighboring modules own the adjacent topics, with links.
