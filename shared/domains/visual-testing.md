# Visual Testing

How to do visual regression that catches real changes without drowning in false positives. Noise is the reason most visual suites are abandoned; controlling it is the whole discipline. Consumed by the audit skill.

## Best practices

- **Best practice:** stabilize before snapshotting — freeze animations, fix the clock, seed data, and load fonts — so a diff means a real visual change, not nondeterminism.
- **Best practice:** mask or exclude inherently dynamic regions (timestamps, avatars, ads, carousels) rather than letting them fail every run.
- **Recommendation:** snapshot components and key states rather than whole pages where possible — smaller surfaces produce smaller, more actionable diffs and fewer incidental failures.
- **Recommendation:** pin the rendering environment (browser, viewport, device-scale, OS font rendering) because pixel output varies across them; run visual checks in a controlled, ideally containerized, environment.

## Common failures

- Constant false positives from unmasked dynamic content or animations — the suite gets ignored, then deleted.
- Cross-environment diffs (a developer's macOS vs CI Linux font rendering) treated as regressions.
- Whole-page snapshots where one small dynamic element fails the entire comparison.

## Detection signals

- A visual suite with a high or fluctuating failure rate and frequent baseline re-approvals — noise, not signal.
- Baselines captured on a different OS/browser than CI runs.
- Snapshots of full pages containing timestamps or other volatile regions.

## Repair guidance

- Add masks for dynamic regions; stabilize animations, time, and data before capture.
- Move baseline capture into the same controlled environment CI uses; narrow snapshots to components.
- **Repair rule:** re-approving a baseline is a deliberate, reviewed act — never an automatic step to make the suite green (that hides real regressions).

## Framework notes

- **Playwright:** built-in `toHaveScreenshot` with masking, animation disabling, and per-project baselines — the strongest **framework** support; run in Docker for stable rendering.
- **Cypress:** via plugins (e.g., a snapshot plugin) or a third-party visual service.
- **Selenium / WebdriverIO:** through services/plugins or a hosted visual platform; **known limitation:** no native visual comparison, so tooling choice matters more.

## Anti-patterns

- **Anti-pattern:** unmasked full-page snapshots — perpetual false positives.
- **Anti-pattern:** auto-approving new baselines on failure — turns visual testing into a rubber stamp.

## Future extension

Perceptual (anti-aliasing-tolerant) diffing guidance and per-component baseline governance would deepen this domain.
