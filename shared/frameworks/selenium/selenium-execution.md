# Selenium: Execution Planning

How a Selenium run would be built, expressed against the shared [execution adapter contract](../../execution/execution-contract.md). This milestone delivers the plan, not the run: qa-run already plans for any detected framework and defers execution for those not yet supported, so Selenium execution planning works today with no change to qa-run. Live execution flips on in a later milestone.

## The six adapter responsibilities, for Selenium

| Responsibility | Selenium |
| --- | --- |
| Detect and confirm | The Selenium dependency resolves for the project's language (see selenium-detection) |
| Discover configuration | The build tool (Maven, Gradle, pytest, npm) and any Grid/hub configuration |
| Build the command | The build tool's test invocation with a JUnit reporter and the scope filter — planned, not yet executed |
| Launch and run | Deferred: the browser is driven by WebDriver, locally or via Grid — a later capability |
| Collect artifacts | JUnit results, screenshots, and driver logs, per selenium-artifacts |
| Normalize the result | The shared JUnit parser — identical output shape to any other framework |

## Command shape by binding

The command builder maps strategy and scope onto each binding's runner; the shape is planned here:

| Binding | Test invocation |
| --- | --- |
| Java (Maven) | `mvn test` with a class/method filter and the surefire JUnit reporter |
| Java (Gradle) | `gradle test` with `--tests` filters |
| Python | `pytest` with node-id selection and `--junitxml` |
| JavaScript | the project's `test` script with a JUnit reporter |

Scope (smoke, targeted, directory, tag) maps onto each runner's native selection, exactly as the shared [execution strategy](../../execution/execution-strategy.md) and [command builder](../../execution/command-builder.md) define — the strategy is framework-agnostic; only the selection syntax is Selenium's.

## Browser and Grid

Selenium drives real browsers through WebDriver, locally or against a Grid. The shared [browser lifecycle](../../execution/browser-launch.md) (startup, timeout, retry, cleanup, cancellation) applies unchanged; Selenium's realization — driver management, Grid connection — is what the adapter would add when execution flips on.

## Why no change to qa-run

qa-run's procedure asks the adapter what to run and how; it never names a framework in its logic. For a not-yet-executed framework it produces the plan and marks execution deferred. Selenium therefore plans through the existing qa-run with zero changes — the adapter supplies the framework-specific planning knowledge, the skill supplies the framework-agnostic flow.
