# Accessibility

How to audit accessibility, and — crucially — what automation can and cannot verify. Consumed by the audit skill.

## Best practices

- **Best practice:** run automated checks (axe-core or equivalent) against WCAG 2.1/2.2 AA as a floor, on representative pages and key states (modals open, forms in error).
- **Known limitation:** automated tools catch roughly a third of WCAG issues. Keyboard operability, focus order, meaningful alt text, and screen-reader comprehensibility need human checks — an audit that reports only automated results and implies full coverage is misleading.
- **Best practice:** the semantic locators the pack already prefers (role, label) double as an accessibility signal — if a role/name locator cannot find a control, that control is likely inaccessible.
- **Recommendation:** gate on no *new* violations rather than demanding zero on a legacy app, so accessibility improves monotonically.

## Common failures

- Missing form labels, images without alternatives, insufficient color contrast, and controls with no accessible name — the high-frequency automated findings.
- Keyboard traps and unmanaged focus in dynamic UI — often missed by automation.
- Reporting automated pass as full accessibility compliance.

## Detection signals

- axe-style violations by rule id and impact (critical/serious/moderate/minor).
- Interactive elements the pack's role/name locators cannot resolve — an accessibility smell.
- Contrast failures from computed styles.

## Repair guidance

- Map each violation to its fix (add a label, alt text, an accessible name; fix contrast; manage focus) and rank by impact.
- Flag the manual-check areas explicitly so they are not assumed covered.
- **Recommendation only:** the audit skill reports findings with severity and evidence; it does not edit the app.

## Framework notes

- **Playwright:** integrates axe via `@axe-core/playwright`; can snapshot the accessibility tree — the strongest **framework** support.
- **Cypress:** `cypress-axe` wraps axe-core.
- **Selenium / WebdriverIO:** axe-core is injectable into the page via the driver; **framework requirement:** the audit runs in-page, so it needs a live browser session.

## Anti-patterns

- **Anti-pattern:** reporting an automated scan as "accessible" — overstates coverage; state the manual gaps.
- **Anti-pattern:** asserting zero violations on a large legacy app in one step — unactionable; gate on no new violations.

## Future extension

Keyboard-navigation and focus-order heuristics, and per-component accessibility checklists, would extend beyond what axe covers.
