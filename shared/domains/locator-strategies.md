# Locator Strategies

How to select elements so tests are stable across UI change. Consumed by generation (writing locators), fix (healing them), and review (judging them).

## Best practices

- **Best practice:** prefer user-facing, semantic locators in this order — role with accessible name, label, text, then test id. They survive restyling and refactors because they track what the user perceives, not how the DOM is built.
- **Recommendation:** reserve an explicit test id (`data-testid`) for elements with no stable semantic handle (icon-only buttons, chart regions). It is honest coupling — the app opts a node into testing — and more stable than structural selectors.
- **Best practice:** define each locator once, in a page object, not inline in tests, so a UI change is a one-line fix.

## Common failures

- A locator matches zero elements after a rename or restructure (the classic post-redesign break).
- A locator matches several elements because it is too broad, and acts on the wrong one.
- A locator depends on position (`nth-child`, an array index) and breaks when order or surrounding markup changes.

## Detection signals

- An error naming an unresolved or timed-out locator, with the element present under a different name in the DOM snapshot — a `locator-failure`.
- A selector string containing absolute XPath, deep CSS descendant chains, or `nth`/index positioning — brittle by construction.
- The same element located differently in different tests — a missing shared page object.

## Repair guidance

- Re-derive the locator from the current DOM to the same element, preferring the semantic hierarchy above; confirm it resolves to exactly one node.
- Move a repeated locator into the page object rather than fixing it in each test.
- **Anti-pattern to avoid during repair:** loosening a locator until it matches *something* to make the test pass — that is exactly what the diff guard and the pack's guardrails forbid.

## Framework notes

- **Playwright:** `getByRole`/`getByLabel`/`getByText`/`getByTestId`, auto-waiting and strict-by-default (a multi-match throws) — a **framework requirement** that surfaces over-broad locators early.
- **Selenium:** `By` strategies; prefer `By.cssSelector` with stable attributes over XPath. **Known limitation:** no built-in accessible-name query, so a role+name lookup is a helper, not a primitive.
- **Cypress:** `cy.get`/`cy.contains`; `cy.findByRole` via Testing Library. Retry-ability makes waits implicit but does not make a brittle selector stable.
- **WebdriverIO:** `$`/`$$` with selector strategies including ARIA and text; similar guidance to Selenium.

## Anti-patterns

- **Anti-pattern:** XPath tied to document structure (`//div[2]/span`) — breaks on any layout change; use a semantic or test-id locator.
- **Anti-pattern:** locating by CSS classes that are styling-derived or framework-generated (hashed CSS-module names) — they change on rebuilds.

## Future extension

Per-framework locator-quality scoring, and heuristics that rank candidate locators for the healer by stability, would deepen this domain.
