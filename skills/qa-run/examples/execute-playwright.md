# Example: execute a Playwright smoke run

Shows the full execution path — plan, run, collect, normalize — for the one framework this milestone executes. Contrast with [plan-a-run.md](plan-a-run.md), which stops at the plan; here `qa-run` actually runs the suite and reports what happened.

## Request

```text
/qa-run smoke
```

## Context

The Playwright + TypeScript repository from the qa-init example: `.qa/context.md` records `testFramework.e2e: playwright`, `packageManager: pnpm`, `conventions.specGlob: e2e/**/*.spec.ts`, and a `chromium` project. Smoke tests are tagged `@smoke`. `BASE_URL` is set in the environment; a local dev server is running.

## Expected behavior

1. **Discover / adapter.** `.qa/context.md` exists and records Playwright — a supported framework, so execution proceeds.
2. **Intent / strategy.** "smoke" selects the `smoke` strategy, scope `@smoke`.
3. **Environment.** Local, headless, `chromium`, base URL from `BASE_URL`; the variable name is recorded, its value is not.
4. **Command.** Playwright config discovered; one command built with a JSON reporter and the failure evidence floor — `--screenshot=only-on-failure --video=retain-on-failure --trace=on-first-retry` — recorded verbatim.
5. **Execute.** The command runs under the smoke timeout; one test fails and is retried once, still failing; the browser is cleaned up.
6. **Collect / normalize.** Artifacts located into the common model; the JSON reporter is normalized — 11 passed, 1 failed → status `failed`, backed by the reporter and the exit code.
7. **Attach the failure's evidence.** The failing test gets its two attempt screenshots (`test-failed-1.png`, `test-failed-2.png`), its trace, and its video, each carrying its `testRef`. The eleven passing tests produced none, which is the floor working as intended.
8. **Report.** The result is self-validated and presented.
9. **Hand off.** The run is red, so `/qa-debug` is dispatched on the validated result without the user asking, and its diagnosis is presented with the run. The dispatch is recorded in `handoff`.

## Expected output

The normalized result `qa-artifacts/qa-run-result-9c2e.json` (the plan artifact is emitted first, as in the planning example):

```json
{
  "contract": { "name": "qa-run/execution-result", "version": "1.1.0" },
  "skill": { "name": "qa-run", "version": "0.3.0" },
  "generatedAt": "2026-07-18T11:05:03Z",
  "summary": "Smoke run executed on Playwright/Chromium (headless): 11 passed, 1 failed. The checkout purchase test failed after one retry; a screenshot per attempt, a video, and a trace were collected and handed to /qa-debug. No tests were skipped.",
  "classification": "failed",
  "confidence": 0.98,
  "evidence": [
    {
      "type": "report",
      "description": "Playwright JSON reporter: 11 passed, 1 failed, 0 skipped",
      "source": "test-results/results.json",
      "excerpt": "\"stats\": { \"expected\": 11, \"unexpected\": 1, \"skipped\": 0 }"
    },
    {
      "type": "command",
      "description": "Runner exited non-zero, consistent with a reported failure",
      "source": "exit code 1"
    },
    {
      "type": "artifact",
      "description": "Failure screenshot written for the failing test on both attempts; no passing test produced one",
      "source": "test-results/checkout-completes-a-purchase/test-failed-1.png"
    }
  ],
  "execution": {
    "strategy": "smoke",
    "command": "pnpm exec playwright test --grep @smoke --project=chromium --reporter=json,line --screenshot=only-on-failure --video=retain-on-failure --trace=on-first-retry",
    "startedAt": "2026-07-18T11:04:33Z",
    "finishedAt": "2026-07-18T11:05:03Z",
    "durationMs": 30120,
    "exitCode": 1
  },
  "framework": { "name": "playwright", "version": "1.58.0" },
  "tests": { "total": 12, "passed": 11, "failed": 1, "skipped": 0, "flaky": 0 },
  "executed": [
    { "title": "checkout > completes a purchase", "file": "e2e/checkout.spec.ts", "status": "failed", "durationMs": 8300, "retries": 1 },
    { "title": "login > accepts valid credentials", "file": "e2e/login.spec.ts", "status": "passed", "durationMs": 2100, "retries": 0 }
  ],
  "artifacts": [
    { "type": "attachment", "location": "test-results/results.json", "framework": "playwright", "timestamp": "2026-07-18T11:05:03Z", "mediaType": "application/json", "ownership": "qa-run", "present": true },
    { "type": "screenshot", "location": "test-results/checkout-completes-a-purchase/test-failed-1.png", "framework": "playwright", "timestamp": "2026-07-18T11:04:52Z", "mediaType": "image/png", "ownership": "qa-run", "testRef": "checkout > completes a purchase", "present": true },
    { "type": "screenshot", "location": "test-results/checkout-completes-a-purchase-retry1/test-failed-1.png", "framework": "playwright", "timestamp": "2026-07-18T11:05:01Z", "mediaType": "image/png", "ownership": "qa-run", "testRef": "checkout > completes a purchase", "present": true },
    { "type": "video", "location": "test-results/checkout-completes-a-purchase/video.webm", "framework": "playwright", "timestamp": "2026-07-18T11:04:52Z", "mediaType": "video/webm", "ownership": "qa-run", "testRef": "checkout > completes a purchase", "present": true },
    { "type": "trace", "location": "test-results/checkout-completes-a-purchase-retry1/trace.zip", "framework": "playwright", "timestamp": "2026-07-18T11:05:01Z", "ownership": "qa-run", "testRef": "checkout > completes a purchase", "present": true },
    { "type": "html-report", "location": "playwright-report/index.html", "framework": "playwright", "timestamp": "2026-07-18T11:05:03Z", "ownership": "qa-run", "present": true }
  ],
  "environment": {
    "location": "local",
    "headless": true,
    "browser": "chromium",
    "baseUrl": "http://localhost:3000",
    "os": "linux",
    "ciProvider": null,
    "envVarNames": ["BASE_URL"]
  },
  "handoff": {
    "skill": "qa-debug",
    "command": "/qa-debug qa-artifacts/qa-run-result-9c2e.json",
    "artifact": "qa-artifacts/qa-run-result-9c2e.json",
    "status": "dispatched",
    "resultRef": "qa-artifacts/qa-debug-result-9c2e.json"
  },
  "recommendations": [
    {
      "action": "Act on the diagnosis in the debug result; repair the test only if it classified the cause as test-side",
      "priority": "high",
      "command": "/qa-fix qa-artifacts/qa-debug-result-9c2e.json"
    }
  ],
  "metadata": { "planRef": "qa-run-plan-9c2e" }
}
```

The prose reply states the counts, that the run genuinely executed, and where the failure's evidence was collected — then says the failure is being diagnosed and presents `/qa-debug`'s conclusion beneath the run summary. `qa-run` still does not diagnose anything itself: the root cause, its confidence, and its owner all come from the debug result, and the recommendation that follows (`/qa-fix`) is left for the user to approve.

## The same run, without the handoff

`/qa-run smoke --no-debug` (or "just run the smoke suite, don't diagnose it") produces the identical result with the diagnosis suppressed and the reason on the record:

```json
  "handoff": {
    "skill": "qa-debug",
    "artifact": "qa-artifacts/qa-run-result-9c2e.json",
    "status": "skipped",
    "reason": "User asked for the run only; diagnosis declined at request time"
  }
```

`status: unavailable` carries the same weight for the case where `/qa-debug` is not installed or its engine is missing — the reason names which, because the two call for different next actions. What the result may never do is omit the block: a red run with no `handoff` is rejected by the contract.
