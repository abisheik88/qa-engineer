# Selenium: Generation

How Selenium fills the shared generation template categories. When a repository already uses Selenium — or the user picks Selenium at bootstrap — `qa-generate` **generates Selenium** in the project's language. It must not emit Playwright as a substitute.

## The template categories, in Selenium

| Category | Selenium realization |
| --- | --- |
| Configuration | Build-tool test configuration (Maven surefire, Gradle test, pytest.ini) plus a WebDriver/Grid setup |
| Page object | Page Object pattern — `By` locators defined once, actions as methods |
| Fixture | Setup/teardown (JUnit `@BeforeEach`, pytest fixtures) providing the driver and pages |
| API helper | HTTP client in the project's language |
| Test data | Language-idiomatic factories, dependency-light |
| Utility | Explicit `WebDriverWait` wrappers — never raw sleeps |
| Example test | Wires a page object through the fixture with the binding's assertions |
| Environment | Base URL and credential **names** only |
| README | How to run and extend |

## Conventions

- Explicit waits, never sleeps.
- Locators centralized in page objects; prefer stable strategies; harvest from the live site when a URL is available.
- Match detected language and assertion library (JUnit/TestNG/AssertJ, pytest, etc.).

## Bootstrap

If the user selects Selenium + a language at intake, produce the category set above in that language's idiomatic layout.
