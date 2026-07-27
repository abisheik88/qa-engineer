# Cypress: Execution Planning

How a Cypress run is built, against the shared execution adapter contract. This milestone delivers the plan; live execution is gated by `qa-run`'s current guardrail, which the adapter does not change.

## The six responsibilities, for Cypress

| Responsibility | Cypress |
| --- | --- |
| Detect and confirm | The `cypress` dependency resolves and a config is present |
| Discover configuration | `cypress.config`, the e2e/component split, and base URL |
| Build the command | `cypress run` with spec, browser, and a JUnit reporter — planned, not executed |
| Launch and run | Deferred: Cypress drives its own browser; the shared browser lifecycle applies |
| Collect artifacts | Videos, screenshots, and the JUnit report, per cypress-artifacts |
| Normalize the result | The shared JUnit parser — identical output shape to any framework |

## Command shape

The command builder maps strategy and scope onto Cypress's selectors: `cypress run --spec <glob>` for path/targeted scope, `--browser <name>` for the browser, `--env grep=<tag>` (with the grep plugin) for tags, and a JUnit reporter (`--reporter junit`) so the result normalizes. Smoke/regression/directory strategies map to spec globs, exactly as the shared execution-strategy defines.

## Browser and mode

Cypress runs headed or headless (`--headed`), on its supported browsers (Chrome family, Firefox, WebKit experimental). The shared browser lifecycle (timeout, retry, cleanup, cancellation) applies; **known limitation:** Cypress's browser support is narrower than Playwright's, and it runs inside the browser's event loop, which shapes how some waits behave.

## Why no change to qa-run

`qa-run` asks the adapter what to run and how; it names no framework in its logic. Cypress plans through the existing `qa-run` unchanged — the adapter supplies the command shape and artifact locations, the skill supplies the framework-agnostic flow.
