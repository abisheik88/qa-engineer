<!-- synced-from: shared/domains/assertion-patterns.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# Assertion Patterns

How to assert so a test proves something and fails informatively. Consumed by generation and review.

## Best practices

- **Best practice:** assert on user-observable outcomes, not implementation detail — the confirmation message appears, not that an internal flag flipped.
- **Best practice:** use web-first, auto-retrying assertions for UI state so the assertion itself handles timing (see the waiting-strategies domain).
- **Recommendation:** one behavior per test, with the assertion that would catch the regression you care about. Several weak assertions do not add up to one meaningful one.
- **Recommendation:** assert specific expected values (`toHaveText('$41.00')`), not mere presence (`toBeVisible()`), when the value is the point.

## Common failures

- A test that passes because its assertion is too weak to catch the bug (a visibility check where a value check was needed).
- A brittle assertion on volatile content (timestamps, generated ids) that fails on correct behavior.
- A missing assertion — the test drives the app but never checks the result.

## Detection signals

- A test body with actions but no `expect`/`assert` — proves nothing.
- Assertions only on presence/visibility where a value or state is the actual requirement.
- Assertions on dynamic values without normalization or masking — a correctness-agnostic flake.

## Repair guidance

- Strengthen a weak assertion to check the value or state that defines correct behavior.
- Normalize or mask volatile content (mask a timestamp region, compare a parsed number) rather than asserting the raw string.
- **Anti-pattern to avoid during repair:** deleting an assertion to make a test pass — the diff guard rejects removed expectations; a failing assertion usually means the app or the expectation is wrong, and one of those must be fixed.

## Framework notes

- **Playwright:** `expect` is auto-retrying for locators (`toBeVisible`, `toHaveText`) and immediate for values; matcher choice signals intent.
- **Selenium:** assertions come from the language's library (JUnit/TestNG/AssertJ, pytest); **known limitation:** no built-in ret/rying assertion, so pair with an explicit wait.
- **Cypress:** `.should()` retries the assertion and the query together — a **framework requirement** to leverage rather than fight with manual waits.
- **WebdriverIO:** `expect-webdriverio` provides auto-retrying matchers similar to Playwright.

## Anti-patterns

- **Anti-pattern:** `expect(true).toBe(true)` or asserting a value the test itself just set — a tautology that always passes.
- **Anti-pattern:** snapshotting an entire response or DOM as the assertion — noisy, and it obscures which change mattered.

## Future extension

Assertion-strength scoring (does this assertion actually gate the behavior under test?) would make review sharper.
