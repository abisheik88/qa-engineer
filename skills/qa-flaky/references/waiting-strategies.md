<!-- synced-from: shared/domains/waiting-strategies.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# Waiting Strategies

How to synchronize a test with an application so it is neither flaky nor slow. The single largest source of flakiness in UI tests is waiting done wrong. Consumed by generation, flaky analysis, and fix.

## Best practices

- **Best practice:** wait on a condition, never on a duration. Assert that the awaited state is true (an element is visible, a response arrived, a URL changed), and let the framework poll — this is "web-first" waiting.
- **Best practice:** rely on the framework's auto-waiting for actionability (visible, enabled, stable) rather than adding manual waits before every interaction.
- **Recommendation:** when waiting for data, wait on the observable effect (the row appears) rather than the mechanism (the network call), unless the test's purpose is the call itself.

## Common failures

- A fixed sleep that is too short on a slow run (flaky failure) or wastefully long on a fast one (slow suite).
- Acting on an element before it is ready because no wait, or the wrong wait, preceded the action.
- Waiting for a condition that is already true, then proceeding before the *next* state — a subtle race.

## Detection signals

- A `waitForTimeout`/`sleep`/`Thread.sleep` with a literal duration — an unconditional wait.
- A timeout error on an action, with the element arriving shortly after — an under-wait.
- Intermittent pass/fail on the same test with no code change — a synchronization race (see the flakiness domain).

## Repair guidance

- Replace a fixed sleep with a web-first assertion or an explicit wait on the real condition.
- Move the wait to the condition that actually gates the next step; remove waits that guard already-settled state.
- **Anti-pattern to avoid during repair:** inflating a timeout to paper over a hang — the diff guard rejects large timeout increases, and a hang is a different failure than slowness.

## Framework notes

- **Playwright:** actions auto-wait for actionability and `expect` auto-retries — a **framework requirement** that makes manual waits usually unnecessary; `waitForTimeout` is discouraged in its own docs.
- **Selenium:** use `WebDriverWait` with `ExpectedConditions`; **anti-pattern:** `implicitlyWait` mixed with explicit waits, which compounds unpredictably.
- **Cypress:** commands retry until assertions pass; wait on `cy.intercept` aliases rather than `cy.wait(ms)`.
- **WebdriverIO:** `waitUntil` and built-in auto-wait on `$` interactions.

## Anti-patterns

- **Anti-pattern:** `sleep(n)` anywhere in a test — non-deterministic and slow; wait on the condition instead.
- **Anti-pattern:** waiting for a network request when the test cares about the rendered result — couples the test to implementation timing.

## Future extension

A catalog of condition-to-wait mappings per framework, and detection of "wait present but wrong condition", would extend this.
