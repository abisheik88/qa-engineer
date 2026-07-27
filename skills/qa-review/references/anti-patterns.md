<!-- synced-from: shared/domains/anti-patterns.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# Test Anti-Patterns

The cross-cutting anti-patterns that make a suite slow, flaky, or untrustworthy — the checklist the review skill judges against. Each domain has its own anti-patterns section; this collects the ones that span domains and most damage a suite.

## Best practices

- **Best practice:** a test proves a behavior, is independent of other tests, and fails informatively. Anything that erodes one of those three is an anti-pattern.
- **Recommendation:** review for these anti-patterns as a set — they compound, and a suite usually has several.

## Common failures

The recurring anti-patterns, each with why it harms and the fix:

- **Green-washing:** deleting assertions, adding `skip`/`only`, forcing a pass, or inflating timeouts to make a suite pass. The most dangerous anti-pattern — a green suite that verifies nothing. The diff guard exists to block exactly this.
- **Fixed sleeps:** `sleep(n)` instead of waiting on a condition — flaky and slow (see the waiting-strategies domain).
- **Brittle locators:** XPath and structural CSS tied to layout (see the locator-strategies domain).
- **Test interdependence:** shared mutable state or order dependence, so tests fail only together (see the fixtures and test-data domains).
- **Weak assertions:** presence checks where a value check was needed; tautologies (see the assertion-patterns domain).
- **UI login everywhere:** per-test UI authentication instead of a session fixture (see the authentication domain).
- **Duplication:** copied locators/helpers instead of shared page objects/utilities (see the page-objects domain).
- **Over-broad snapshots:** whole-page/whole-response snapshots as the assertion — noisy and uninformative.
- **Logic in tests:** conditionals and loops that make a test's behavior depend on runtime state — a test should be a straight line.

## Detection signals

- Removed `expect`/`assert`, added `.skip`/`.only`, `assert True`, or a timeout raised sharply — green-washing; the diff guard flags these.
- `sleep`/`waitForTimeout` with a literal duration.
- XPath/structural selectors; duplicated locator strings across files.
- Tests that pass alone but fail in a suite; global mutable state.
- Branching (`if`/`for`) around assertions in a test body.

## Repair guidance

- Map each anti-pattern to its domain's repair guidance and apply it.
- **Repair rule above all:** never remove the anti-pattern by removing the check — replacing a fixed sleep with a real wait is a fix; deleting the assertion it guarded is green-washing.

## Framework notes

- The anti-patterns are framework-agnostic; their *signatures* differ (a Cypress `cy.wait(ms)` vs a Selenium `Thread.sleep` vs a Playwright `waitForTimeout`), which the review and diff-guard tooling recognizes per framework.
- **Framework requirement:** none — this domain is about test design, which holds across every framework the pack supports.

## Anti-patterns

This whole document is the anti-pattern catalog; the meta-anti-pattern is treating a passing suite as proof without asking whether its tests actually assert anything.

## Future extension

A weighted anti-pattern scoring model feeding the review skill's quality score, and per-framework signature libraries, would deepen this domain.
