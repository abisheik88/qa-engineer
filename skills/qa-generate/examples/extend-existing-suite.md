# Example: extend with live locators and step definitions

Mode 1 — suite exists. Generation reviews it, harvests locators from the live site, and adds scenario + steps + page methods.

## Request

```text
/qa-generate add a Cucumber scenario for applying a promo code on https://staging.example.com/checkout
```

## Context

Playwright + Cucumber suite: features under `e2e/features/`, steps under `e2e/steps/`, page objects under `e2e/pages/`. Checkout page object exists but has no promo methods.

## Expected behavior

1. **Discover.** Existing Playwright+Cucumber → Mode 1; stay on Playwright (no framework picker).
2. **Review.** Map existing steps and `CheckoutPage`.
3. **Live locators.** Open the staging checkout URL; capture stable selectors for promo field and Apply button into `CheckoutPage`.
4. **Plan.** New (or extended) `.feature` scenario; new step defs only where phrases are new; page methods for applyPromo; propose edits to existing page/step files.
5. **Generate non-destructively.** Write new feature/steps as needed; pending permission for page-object edits.
6. **Report.** `extended`; recommend `/qa-run` for the new scenario.

## Expected output

Files may include a feature snippet, step definitions calling page objects, and concrete locators sourced from the live DOM (not invented). Skipped: reused auth steps and login page.
