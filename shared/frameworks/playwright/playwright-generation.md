# Playwright: Generation

How the Playwright adapter fills the template-category contract — the reference implementation of generation for the pack's first framework. It covers both modes: bootstrapping a new Playwright framework, and extending an existing one. The code templates this module directs live with the `qa-generate` skill; this module is the guidance for adapting them into production-quality Playwright.

Scope is what generation requires. This is not a Playwright authoring manual; it is how to produce and extend a Playwright suite that an experienced SDET would recognize as their own.

## Template categories, in Playwright

| Category | Playwright realization |
| --- | --- |
| Configuration | `playwright.config.ts`: projects per browser, the JSON and HTML reporters, retries, `trace: on-first-retry`, and parallelism |
| Page object | A class per page, locators defined once as role/label/text-first queries, actions as methods returning meaningful state |
| Fixture | `test.extend` providing page objects and shared state; an authenticated fixture using `storageState` when the app requires login |
| API helper | A typed wrapper over Playwright's `request` context for API setup and API tests |
| Test data | A dependency-light factory producing valid entities; no heavy data libraries pulled in |
| Utility | The few shared helpers a suite genuinely needs, no speculative kitchen sink |
| Example test | A spec that uses a page object through a fixture and asserts with web-first assertions |
| Environment | An `.env`-style example referencing `BASE_URL` and credential *names* only |
| README | How to run, where things live, and how to extend the suite |

## Playwright best practices generation follows

- **Web-first assertions.** Generated assertions use auto-retrying expectations (`toBeVisible`, `toHaveText`), never manual waits or `waitForTimeout`.
- **Role/label/text-first locators.** Prefer `getByRole`, `getByLabel`, `getByText`; avoid brittle CSS or XPath. Locators live in page objects, not scattered through tests.
- **Fixtures over hooks.** Shared setup is a fixture, not a pile of `beforeEach` blocks; authenticated state is reused via `storageState`, not re-logged-in per test.
- **Projects for browsers and setup.** Cross-browser coverage and setup/teardown are configured as projects, not improvised.
- **Isolation.** Each test is independent; no shared mutable state across tests.
- **Tags for suites.** Smoke and critical-path subsets are expressed as title tags the runner selects with `--grep`, matching whatever tag vocabulary the suite already uses.

## Bootstrap (Mode 2)

Produce the spine — config, a page-object base with one real page, fixtures (including auth if the app logs in), an API helper if an API is under test, test data, the few needed utilities, one or two passing example tests, an environment example, and a README. The suite must run under `qa-run` immediately. Any dependency the generated code needs beyond what the project has is stated in the result and the README, never assumed installed.

## Extension (Mode 1)

Reuse relentlessly: extend the existing page objects, use the existing fixtures and auth, call the existing utilities, and match the existing config, naming, and folders. Add a method to a page object rather than a second object for the same page. Modifying an existing file requires permission; creating a new spec that follows the suite's conventions does not. Never introduce a second assertion style, a parallel login flow, or a duplicate helper.

## Validity

Every generated Playwright file must be syntactically valid TypeScript and consistent with the project's `tsconfig`. Generated tests must follow the suite's conventions closely enough to run without modification. Where the project has a formatter or linter, generated code conforms to it.
