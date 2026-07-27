# Page Objects

How to structure the layer between tests and the UI so a suite scales. Consumed by generation and review.

## Best practices

- **Best practice:** one page object (or component object) per page or significant component; it owns that surface's locators and exposes intention-revealing actions (`login(user, pass)`), not raw element handles.
- **Best practice:** page objects return meaningful state or the next page object, so tests read as user journeys, not DOM manipulation.
- **Recommendation:** favor composition over inheritance — a deep page-object class hierarchy is harder to change than small composed components. The screenplay pattern (actors, tasks, questions) is a reasonable alternative for large suites.
- **Recommendation:** keep assertions out of page objects; they model the page, tests make the claims. (A small number of self-verifying navigation checks are acceptable.)

## Common failures

- Locators duplicated across tests because there is no page object — a UI change becomes an N-file edit.
- A "god" page object covering the whole app, which every test imports and nothing can change safely.
- Page objects that expose raw locators, letting tests reach past the abstraction.

## Detection signals

- The same locator string in multiple test files — missing or bypassed page object.
- A page-object file far larger than its peers — a god object.
- Tests importing element handles or calling framework locator APIs directly — leaky abstraction.

## Repair guidance

- Extract duplicated locators into (or add a method to) the owning page object; have tests call the method.
- Split a god object along page or component boundaries.
- **Repair rule:** extend an existing page object with a method rather than creating a second object for the same page (the non-destructive, no-duplication rule generation and fix both follow).

## Framework notes

- **Playwright:** page objects hold `Locator`s built in the constructor from a `Page`; fixtures provide instantiated page objects to tests.
- **Selenium:** the Page Object Model is long-established; `PageFactory` exists but explicit locators are clearer. Applies across language bindings.
- **Cypress:** page objects are less idiomatic than custom commands/app actions; both are valid — a **trade-off** between familiarity (POM) and Cypress-native ergonomics (commands).
- **WebdriverIO:** classic POM with `$` selectors in getters.

## Anti-patterns

- **Anti-pattern:** assertions embedded throughout page objects — couples modeling to verification and hides what a test checks.
- **Anti-pattern:** page objects that wrap every element in a trivial getter with no actions — ceremony without abstraction.

## Future extension

Component-object guidance for component-testing frameworks, and screenplay-pattern scaffolds, would extend this domain.
