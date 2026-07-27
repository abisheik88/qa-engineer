# Framework Detection and Adapter Selection

How the execution engine chooses which framework adapter to run. This is distinct from stack detection: `qa-init` already detected the framework and recorded it in `.qa/context.md`. This module turns that recorded fact into an adapter selection, resolves conflicts when a repository shows more than one framework, and defines what happens when the selected framework is not yet executable.

The rule that governs everything here: never re-detect by guessing. The fact lives in the context file; this module selects and confirms, it does not re-derive.

## Selecting the adapter

1. Read `testFramework.e2e` from `.qa/context.md`. This is the authoritative fact.
2. Select the adapter for that framework.
3. Confirm the framework is actually runnable — its dependency is installed and its config resolves — per the adapter's detect-and-confirm responsibility. A recorded framework whose tooling is absent is a stop-and-explain, not an assumption that it will work.

If `testFramework.e2e` is `null`, the engine stops and recommends running `qa-init`. It never scans the repository itself to guess a framework at execution time; a wrong guess runs the wrong tool.

## Resolving conflicts

A repository can show signals for more than one framework (a migration in progress, a monorepo with mixed packages). Resolution, in order:

1. **Explicit user intent wins.** If the request names a framework or targets files under one framework's directory, use it.
2. **The context's primary wins.** `qa-init` records the dominant e2e framework; prefer it.
3. **Monorepo scope narrows it.** If the request targets one package, use that package's recorded framework.
4. **Otherwise, ask one question.** Two frameworks equally plausible and no narrowing signal is the one case that warrants a single clarifying question, naming the candidates.

The conflict resolution is recorded as evidence in the result: which framework was chosen and which signal decided it.

## Supported versus unsupported

Support is defined by whether a framework's adapter implements the [adapter contract](execution-contract.md) for the requested execution path.

| Framework | This milestone |
| --- | --- |
| Playwright | Supported — executes locally (Chromium, Firefox, WebKit) |
| Selenium | Detected, not executable — plan only |
| Cypress | Detected, not executable — plan only |
| WebdriverIO | Detected, not executable — plan only |

For a detected-but-not-executable framework, the engine produces the execution plan, marks the execute and validate phases deferred, classifies the result as blocked, and explains plainly that execution for that framework arrives in a later milestone. It never partially runs or improvises a run for an unsupported framework.

## Unknown or absent frameworks

A framework not in the table above, or no framework at all, is a stop-and-explain: state what was found in the context, state that no adapter covers it, and stop. Unknown is preferable to incorrect.
