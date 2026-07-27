<!-- synced-from: shared/domains/performance.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# Performance

How to audit front-end performance meaningfully in a QA context. Consumed by the audit skill.

## Best practices

- **Best practice:** measure Core Web Vitals — Largest Contentful Paint, Cumulative Layout Shift, Interaction to Next Paint — against explicit budgets, rather than eyeballing "feels slow".
- **Best practice:** compare against a baseline and gate on *regression*, not an absolute number, because absolute timings vary with hardware and network; a regression is signal, a raw number is noise.
- **Recommendation:** control the environment (throttling profile, cold vs warm cache, viewport) so measurements are comparable run to run; report the conditions with the numbers.
- **Known limitation:** synthetic lab measurement is not field (real-user) data; a lab audit informs, it does not replace RUM.

## Common failures

- Comparing timings across different hardware or network and calling the difference a regression.
- A single unthrottled run treated as authoritative — high variance, low signal.
- Reporting a raw millisecond value with no baseline or budget, so no one can act on it.

## Detection signals

- LCP/CLS/INP outside budget on a controlled run.
- A metric materially worse than a recorded baseline (a regression).
- Large layout shifts or long tasks in a performance trace.

## Repair guidance

- Attribute a regression to its cause (a heavier asset, a new blocking script, a layout shift source) from the trace, and recommend the specific remediation.
- Report each finding with the measurement conditions and the baseline delta.
- **Recommendation only:** the audit reports; it does not change the app.

## Framework notes

- **Playwright:** integrates with the Chrome DevTools Protocol and Lighthouse for metrics and traces — the strongest **framework** support for performance.
- **Cypress:** performance auditing is limited; Lighthouse via a plugin, or CDP for Chromium.
- **Selenium / WebdriverIO:** CDP access on Chromium for metrics; **known limitation:** cross-browser performance depth is uneven, and non-Chromium engines expose less.

## Anti-patterns

- **Anti-pattern:** absolute-threshold gates on shared CI hardware — flaky and uninformative; gate on regression against a baseline.
- **Anti-pattern:** one uncontrolled run as a verdict — measure repeatedly under fixed conditions.

## Future extension

Baseline management across runs, budget-per-route configuration, and trace-driven attribution of regressions would deepen this domain.
