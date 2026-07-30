# WebdriverIO: Execution Planning

How a WebdriverIO run is built, against the shared execution adapter contract. This milestone delivers the plan; live execution is gated by `qa-run`'s current guardrail, which the adapter does not change.

## The six responsibilities, for WebdriverIO

| Responsibility | WebdriverIO |
| --- | --- |
| Detect and confirm | `@wdio/cli` resolves and a `wdio.conf` is present |
| Discover configuration | `wdio.conf` — the runner, services, capabilities, base URL, and specs |
| Build the command | `wdio run wdio.conf.ts` with spec and capability selection and a JUnit reporter — planned, not executed |
| Launch and run | Deferred: WebdriverIO manages the driver/session via its config; the shared browser lifecycle applies |
| Collect artifacts | JUnit results, screenshots, and logs, per webdriverio-artifacts |
| Normalize the result | The shared JUnit parser — identical output shape to any framework |

## Command shape

The command builder maps scope onto WebdriverIO's selection: `--spec <path>` for path/targeted scope, capability selection for the browser, and suite definitions (`--suite <name>`) for tagged/smoke groupings. A JUnit reporter (`@wdio/junit-reporter`) is configured so the result normalizes. Smoke/regression/directory strategies map to specs and suites as the shared execution-strategy defines.

## Failure evidence floor

As with Selenium, WebdriverIO captures a failure screenshot only where the project asks it to — conventionally an `afterTest` hook in `wdio.conf` that saves on `!passed`. The adapter confirms that hook exists and where it writes, or records the screenshot row of the shared failure evidence floor as unavailable; it does not edit the config to add one. **Known gap:** there is no trace equivalent, so failure depth is the screenshot plus the JUnit message and the run log.

## Browser and mode

WebdriverIO drives browsers through the WebDriver protocol, locally or via a Grid/cloud, headed or headless per capabilities. The shared browser lifecycle applies; **known limitation:** as with Selenium, driver/browser version alignment is a real operational concern the adapter must surface.

## Why no change to qa-run

`qa-run` asks the adapter what to run and how; it names no framework in its logic. WebdriverIO plans through the existing `qa-run` unchanged.
