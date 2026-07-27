# Selenium: Conventions

The structural conventions the pack relies on to locate, select, and generate Selenium tests. This module records what the platform needs to know across Selenium's language bindings; it is not a Selenium tutorial.

## Layout by binding

Selenium projects vary by language, and the pack reads the convention from `.qa/context.md` and the build files rather than assuming:

| Binding | Tests live in | Results in |
| --- | --- | --- |
| Java (Maven) | `src/test/java/**/*Test.java` | `target/surefire-reports/` |
| Java (Gradle) | `src/test/java/**/*Test.java` | `build/test-results/test/` |
| Python | `tests/**/test_*.py` | the `--junitxml` path |
| JavaScript | `test/` or `e2e/` | the reporter's configured path |

## Selection surface

Each binding offers its own way to select tests, which the shared command builder maps scope onto:

- Java: class and method filters (`-Dtest=`, `--tests`), and TestNG groups or JUnit tags.
- Python: pytest node ids, `-k` expressions, and markers.
- JavaScript: the runner's grep/filter.

Tag-based and smoke strategies rely on the project's existing grouping convention (TestNG groups, pytest markers, naming); when a strategy depends on a convention the project does not have, the platform stops and explains rather than running an empty selection — the same discipline applied to every framework.

## Waiting and locators

The conventions the pack cares about most for Selenium, because they drive quality:

- **Explicit waits.** Robust Selenium suites use `WebDriverWait` with expected conditions, not fixed sleeps. The pack reads whether a suite follows this, and generation always produces explicit waits.
- **`By` strategies.** Locators use `By` with stable strategies (id, name, CSS, accessible attributes) defined in page objects. The pack prefers stable strategies and flags brittle absolute XPath, consistent with its cross-framework locator discipline.

## Boundary

This module documents conventions the platform reads and generation follows; the deep "how to write excellent Selenium" guidance belongs with the generation and review skills that need it. Here, conventions exist so selection targets the right tests and generated code matches the project.
