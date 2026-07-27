<!-- synced-from: shared/domains/retry.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# Retry

How to use retries to *observe* instability without *hiding* it. Consumed by flaky analysis and run planning.

## Best practices

- **Best practice:** retry to detect flakiness, not to manufacture a pass. A test that passes only on retry is recorded as flaky and surfaced — not counted as a clean pass.
- **Recommendation:** enable a small retry count in CI (often 1–2) to keep a pipeline moving while flaky signal is collected; keep retries at 0 locally so races surface during development.
- **Best practice:** retry at the test level, not by wrapping actions in retry loops — action-level retry hides the race inside the test.

## Common failures

- A high retry count masking a genuine, reproducible failure — the pipeline is green but the software is broken intermittently.
- Retrying a test whose failure is deterministic (a real bug), wasting time before the inevitable failure.
- Action-level retry loops that make a flaky step look stable while the underlying race remains.

## Detection signals

- A retry configuration with a high count (3+), especially locally — likely masking rather than measuring.
- Tests recorded as passed-on-retry — flaky, per the flakiness domain.
- Custom retry loops around individual actions in test code.

## Repair guidance

- Set retries to observe (low, CI-only); treat any passed-on-retry as a flake to fix, not a success.
- Remove action-level retry loops; fix the synchronization they were hiding.
- **Anti-pattern to avoid during repair:** raising retries to turn a failing test green — the diff guard flags retry inflation for exactly this reason.

## Framework notes

- **Playwright:** `retries` in config; a passed-on-retry test is reported with `flaky` status — the cleanest **framework** signal.
- **Selenium:** retry via the runner (JUnit `RetryRule`, pytest-rerunfailures); no native flaky status — track separately.
- **Cypress:** built-in test retries with `retries` config, distinguishing run-mode and open-mode.
- **WebdriverIO:** `retry` in the config or per-suite.

## Anti-patterns

- **Anti-pattern:** retries as a flakiness fix — the flake remains, now hidden.
- **Anti-pattern:** retrying known-deterministic failures — pure wasted time.

## Future extension

Policy guidance that ties retry budgets to measured flake rates, and automatic flagging of retry-masked failures, would extend this.
