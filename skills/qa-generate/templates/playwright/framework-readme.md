<!-- Template: readme. qa-generate writes this into the generated suite
     (for example, e2e/README.md), adapting paths and the run command to the
     project's package manager. It orients a developer in under a screen. -->
# End-to-End Tests

Playwright end-to-end tests for this project.

## Layout

```text
e2e/
├── pages/       Page objects — one class per page, locators defined once
├── fixtures.ts  Custom fixtures, including an authenticated page
├── support/     API client, test-data factory, shared utilities
└── *.spec.ts    Tests, grouped by feature and tagged for suites
```

## Running

```sh
# All tests
<pkg> exec playwright test

# A tagged suite (for example, smoke)
<pkg> exec playwright test --grep @smoke

# One browser
<pkg> exec playwright test --project=chromium
```

Replace `<pkg>` with the project's package-manager runner (`pnpm`, `npm run`, or `yarn`). Or drive runs through the QA pack with `/qa-run`.

## Configuration

`playwright.config.ts` defines the browser projects, reporters, retries, and tracing. Copy `.env.example` to `.env` and fill in the base URL and credentials before the first run.

## Extending

Add a page object under `pages/`, wire it through `fixtures.ts` if it needs shared setup, and add a `*.spec.ts` that drives it. Follow the existing patterns — reuse page objects and the auth fixture rather than duplicating them.
