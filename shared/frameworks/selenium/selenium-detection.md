# Selenium: Detection

How a Selenium project is recognized and its adapter selected. As with every framework, the fact of "this is Selenium" is recorded in `.qa/context.md` by qa-init; this module documents the signals that establish it and how selection resolves.

## Signals

Selenium has no single canonical config file, so detection rests on dependencies, per language binding:

| Binding | Primary signal |
| --- | --- |
| Java | `org.seleniumhq.selenium:selenium-java` in `pom.xml` or `build.gradle` |
| Python | `selenium` in `requirements.txt`, `pyproject.toml`, or `poetry.lock` |
| JavaScript / TypeScript | `selenium-webdriver` in `package.json` |
| C# | `Selenium.WebDriver` in a `.csproj` |

A directory merely named `selenium` is not a signal — the dependency is. Its absence from dependencies means "not detected", however suggestive the folder names.

## Selection and conflict

Selection follows the shared rules ([execution framework-detection](../../execution/framework-detection.md), [generation framework-selection](../../generation/framework-selection.md)): explicit intent wins, then the recorded framework, then monorepo scope, then a single clarifying question. A repository mid-migration from Selenium to Playwright is a conflict resolved by intent or scope, never guessed.

## Grid and remote

Selenium is often driven against a remote Grid. Detection notes a Grid configuration (a hub URL in config or environment) because it changes how execution would connect — but Grid execution is a later capability; this milestone records its presence, it does not drive it.

## Status

Selenium is a **planned** framework for execution and generation: detected and adapter-complete, but not yet run or generated. Detection is real and reused by the shared selectors; the downstream execution and generation remain planning until a later milestone flips them on.
