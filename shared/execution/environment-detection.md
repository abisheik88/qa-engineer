# Environment Detection

How a run's environment is decided: local versus CI, headed versus headless, the base URL the tests target, and the environment variables the run needs. These decisions feed the browser lifecycle and the command builder, and every one of them is recorded in the result so a reader knows the exact conditions a run executed under.

## What is decided

| Decision | Default | Overridden by |
| --- | --- | --- |
| Location | Local | An explicit request; a detected CI environment |
| Display | Headless | An explicit headed request (never honored in CI) |
| Base URL | The project's configured base URL | An explicit request or a named environment |
| Environment variables | The project's declared set | The user, by reference — never by value in any recorded output |

## Local versus CI

CI is detected from the environment, not assumed: the presence of the standard CI environment variables, or an explicit signal from the user. The distinction matters because it changes safe defaults — headed mode and interactive prompts are disabled in CI, and timeouts and retry budgets are typically different. The context file's recorded `ci.provider` describes what the project *uses*; this module decides where the *current run* is happening, which can differ (a developer running locally against a CI-configured project).

## Base URL and target environment

Tests run against something — a local dev server, a preview deployment, a staging environment. The base URL comes from the project's configuration by default. When the user names an environment or URL, it overrides, and the actual target is recorded in the result. The engine never invents a URL; if tests require a base URL and none can be determined, it stops and explains rather than running against a wrong or missing target.

## Environment variables and secrets

Runs often need environment variables (a base URL, an auth token, a feature flag). The rules:

- Variables are passed to the run by reference to their names, resolved from the actual environment at run time.
- Secret values never appear in the built command, the plan, the result, or any log the pack produces — only names appear.
- A required variable that is absent is a stop-and-explain: the run does not proceed against missing configuration, and the missing variable is named (by name, never guessing its value).

## Recorded in the result

The result's environment block records what actually applied: location, display mode, browser, base URL, and the names (not values) of the environment variables the run depended on. This is evidence — the result never describes an environment that was requested but not achieved.

## Extension

Remote and containerized targets, per-environment configuration matrices, and richer secret sourcing are later-milestone additions. Broad environment and secret *management* across a project is a domain concern for a future knowledge module; this module covers only the environment decisions a single run must make.
