# Playwright Framework Adapter

The reference implementation of the [framework adapter contract](../../execution/execution-contract.md). Playwright is the one framework the pack actually executes in the current milestone; these modules are what make that execution reliable. They answer the adapter's six responsibilities for Playwright and are synced into every execution skill that runs Playwright.

Scope is deliberately narrow: only what execution requires. This is not a Playwright manual — broader Playwright knowledge (advanced APIs, authoring patterns) arrives when the skills that need it do.

## Modules

| Module | Adapter responsibility | Synced into execution skills |
| --- | --- | --- |
| [playwright-project-discovery.md](playwright-project-discovery.md) | Discover configuration | Yes |
| [playwright-execution.md](playwright-execution.md) | Detect, build command, launch and run | Yes |
| [playwright-artifacts.md](playwright-artifacts.md) | Collect artifacts | Yes |
| [playwright-conventions.md](playwright-conventions.md) | Structural conventions execution relies on | No — authoring-facing, kept for future skills |

Report normalization for Playwright is specified within [playwright-execution.md](playwright-execution.md), against the mapping the shared report-normalization module defines.

Files carry the `playwright-` prefix so their basenames stay unique when the [shared knowledge engine](../../README.md) flattens them into a skill's `references/` directory alongside other frameworks' modules.

## The reference role

Because Playwright is built first and completely, it sets the shape every later adapter follows: Selenium, Cypress, and WebdriverIO will each have a directory like this one, answering the same responsibilities in their own terms. When those land, `qa-run` runs them without a single change — that is the test of whether this adapter was built as a reference rather than a special case.
