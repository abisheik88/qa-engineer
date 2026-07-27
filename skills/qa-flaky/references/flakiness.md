<!-- synced-from: shared/domains/flakiness.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# Flakiness

Why a test passes and fails without a code change, and how to remove the nondeterminism. This is the core knowledge the flaky-analysis skill consumes.

## Best practices

- **Best practice:** treat flakiness as a bug in the test (or its environment), not a fact of life. A flaky test that is retried into green erodes trust in the whole suite.
- **Best practice:** fix the root cause — a race, a shared-state leak, a time dependency — rather than raising retries or timeouts.
- **Recommendation:** quantify before acting: a test is flaky if it changes outcome across identical runs; measure a pass rate over repeated runs before diagnosing.

## Common failures

The recurring causes, each with its signature:

- **Race / synchronization:** acting before the app settled — the largest class (see the waiting-strategies domain).
- **Test isolation:** shared mutable state or order dependence, so a test fails only in a suite (see fixtures, test-data).
- **Time and randomness:** dependence on the clock, timezone, or unfixed random data.
- **Network:** dependence on a slow or flaky upstream, or on real third-party calls.
- **Environment:** resource contention under parallelism, or environment drift between runs.

## Detection signals

- The same test with different outcomes across identical runs, or a test that passed only on retry — the metadata signal that yields a `flaky` classification.
- A pass rate strictly between 0 and 100% over repeated runs.
- Failures correlated with parallelism, time of day, or a specific worker — environmental flake.

## Repair guidance

- Map the flake to its class, then apply that class's fix: races → web-first waits; isolation → per-test data and state; time → freeze/inject the clock; network → mock or stub the unstable dependency; environment → reduce contention or pin the environment.
- **Recommendation, not automatic action:** quarantine only with a tracking issue and an owner, never silently — a quarantined test is hidden risk. The flaky skill proposes quarantine; it never applies it.
- **Anti-pattern to avoid during repair:** bumping the retry count to hide the flake — it converts a real defect into an intermittent pass.

## Framework notes

- **Playwright:** `--retries` surfaces flaky (passed-on-retry) status distinctly — a **framework** signal the pack uses; trace-on-retry captures the flaky run.
- **Selenium:** flakiness is often explicit-wait gaps; no native flaky status, so detection relies on repeated runs.
- **Cypress:** retry-ability reduces some flake but can mask races; `cypress-terminal-report` and the dashboard's flake detection help.
- **WebdriverIO:** retry via config; similar detection to Selenium.

## Anti-patterns

- **Anti-pattern:** high global retry counts as a flakiness "solution" — hides defects and slows the suite.
- **Anti-pattern:** deleting or skipping a flaky test instead of fixing or tracking it — silent coverage loss.

## Future extension

Historical flake-rate tracking across runs, and per-class automated detection heuristics feeding the analysis platform, are the natural deepening of this domain.
