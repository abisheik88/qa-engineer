# WebdriverIO: Generation Planning

How WebdriverIO fills the shared generation template categories, as a plan. `qa-generate` still generates Playwright only; this documents how WebdriverIO generation would work so it plugs in without changing the skill.

## Template categories, in WebdriverIO

| Category | WebdriverIO realization |
| --- | --- |
| Configuration | `wdio.conf.ts`: runner, capabilities, services, reporters, base URL |
| Page object | Classic Page Object Model with `$`/`$$` selectors in getters |
| Fixture | Setup via hooks (`before`, `beforeEach`) in the config; session/cookie reuse for auth |
| API helper | An HTTP client in the project's language alongside the UI suite |
| Test data | Language-native factories; hooks for setup and cleanup |
| Utility | Shared helpers, including explicit `waitUntil` wrappers |
| Example test | A spec driving a page object with `expect-webdriverio` auto-retrying assertions |
| Environment | Env vars / capability config — names only, never secrets |
| README | How to run and extend the WebdriverIO suite |

## Conventions WebdriverIO generation follows

- **Auto-retrying assertions and waits.** `expect-webdriverio` matchers and `waitUntil` over fixed sleeps — the waiting-strategies discipline in WebdriverIO terms.
- **Page Object Model.** The idiomatic structure; locators in getters, actions as methods.
- **Config-driven setup.** Shared setup lives in the config's hooks and services, not scattered in specs.

## Why no change to qa-generate

The template categories are framework-agnostic; WebdriverIO fills them like the others. When generation flips on for WebdriverIO, `qa-generate` runs unchanged.
