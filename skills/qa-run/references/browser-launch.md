<!-- synced-from: shared/execution/browser-launch.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# Browser Execution Lifecycle

How a run's browser and mode are chosen and controlled: startup, timeouts, retries, cleanup, and cancellation. The engine expresses these as intents; the framework adapter realizes them with the framework's own mechanisms.

## Browsers and modes

| Dimension | Options | Default |
| --- | --- | --- |
| Engine | Chromium, Firefox, WebKit | The framework's configured default, else Chromium |
| Display | Headed, headless | Headless (headed only on explicit request, and never in CI) |
| Location | Local, remote/grid, CI runner | Local this milestone; remote and CI-runner execution are adapter extensions |

The chosen browser and mode come from the environment decision (see the environment-detection module) and are recorded in the result's environment block, so a reader knows exactly what ran where.

## Lifecycle

```text
  resolve browser+mode → start → run under timeout → on failure: bounded retry → collect → clean up
                                        │
                                   cancellation can interrupt at any point → clean up
```

- **Startup.** The adapter launches the browser as part of the run command; the engine does not manage browser processes directly. Startup failure (missing browser binary, unavailable display) is an `errored` result with the cause as evidence — never a silent fallback.
- **Timeout.** Every run has an overall wall-clock timeout appropriate to the strategy (a smoke run is short; a regression run is long). A run that exceeds it is stopped, cleaned up, and reported as `errored` with the timeout as the cause — a hang is never reported as a failure of the tests.
- **Retry.** Retries are the framework's own test-level retry (configured through the command), used to observe flakiness, not to manufacture a pass. The number of retries is recorded; a test that passes only on retry is reported as flaky, not as passed.
- **Cleanup.** After every run — success, failure, timeout, or cancellation — browser processes are ended and temporary state is removed, so no run leaves orphaned processes or locked resources.
- **Cancellation.** If the user interrupts, the run is stopped, the browser is cleaned up, and a partial result is reported honestly as cancelled with whatever completed — never as passed.

## Rules

- Headless by default; headed is explicit and never assumed in CI.
- A hang, a crash, and a test failure are three different outcomes and are reported as three different things.
- Cleanup always runs, on every exit path.
- The browser, mode, and location that actually ran are recorded as evidence; the result never describes an environment that was requested but not achieved.

## Extension

Remote and grid execution, additional engines, and containerized browsers are adapter-level additions: they change how the adapter starts and points the browser, not the lifecycle above. The startup-timeout-retry-cleanup-cancellation shape holds for every framework and location.
