<!-- synced-from: shared/frameworks/playwright/playwright-project-discovery.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# Playwright: Project Discovery

How the Playwright adapter finds what is runnable before a run: the config, the projects it defines, the test directory, and the runner invocation. Discovery reads the repository; it does not assume. Everything found here is recorded as evidence in the plan and result.

## Configuration

Playwright's configuration is the source of truth for how tests run. Discover it in this order:

1. A config file at the repository root or a package root: `playwright.config.ts`, `playwright.config.js`, or `playwright.config.mjs`. The path is recorded in `.qa/context.md` under `conventions.configFiles`; confirm it still exists.
2. If no config file exists but `@playwright/test` is a dependency, Playwright runs with defaults; note the absence of an explicit config as an assumption.
3. If neither a config nor the dependency is present, Playwright is not runnable here — stop and explain (this contradicts a recorded Playwright detection and should be surfaced, not worked around).

## Projects

Playwright config defines *projects* — named configurations that typically pin a browser and settings. Discovery reads the configured projects so the run can target the right one:

- Read the project names and the browser each pins.
- A request for a browser maps to the project that uses it.
- When no project is named and several exist, the run targets the config's default project, and the choice is recorded.
- A repository with no explicit projects runs Playwright's single default; note it.

## Runner invocation

The runner is invoked through the project's package manager, taken from `.qa/context.md`:

| Package manager | Invocation |
| --- | --- |
| pnpm | `pnpm exec playwright test` |
| npm | `npx playwright test` |
| yarn | `yarn playwright test` |

Discovery produces the base invocation; the command builder adds selection, browser, reporter, and evidence flags.

## Test directory and selection surface

- The test directory and spec glob come from `.qa/context.md` conventions, confirmed against the config's `testDir` if set.
- The selection surface Playwright offers — path filters, the `--grep` tag filter, `--project`, and named files — is what the shared command-builder module maps scope onto. Which selection realizes which strategy is the shared platform's concern; that these are the available levers is Playwright's.

## Recorded as evidence

Discovery records the config path, the chosen project and browser, the package manager, and the resolved test directory. A run never proceeds on a discovery it could not confirm; an unconfirmable config is a stop-and-explain.
