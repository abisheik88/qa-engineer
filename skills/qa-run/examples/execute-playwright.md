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
4. **Command.** Playwright config discovered; one command built with a JSON reporter and `--trace=on-first-retry`, recorded verbatim.
5. **Execute.** The command runs under the smoke timeout; one test fails and is retried once, still failing; the browser is cleaned up.
6. **Collect / normalize.** Artifacts located into the common model; the JSON reporter is normalized — 11 passed, 1 failed → status `failed`, backed by the reporter and the exit code.
7. **Report.** The result is self-validated and presented; a recommendation points at the collected trace for future failure analysis.

## Expected output

The normalized result `qa-artifacts/qa-run-result-9c2e.json` (the plan artifact is emitted first, as in the planning example):

```json
{
  "contract": { "name": "qa-run/execution-result", "version": "1.0.0" },
  "skill": { "name": "qa-run", "version": "0.2.0" },
  "generatedAt": "2026-07-18T11:05:03Z",
  "summary": "Smoke run executed on Playwright/Chromium (headless): 11 passed, 1 failed. The checkout purchase test failed after one retry; its trace was collected. No tests were skipped.",
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
    }
  ],
  "execution": {
    "strategy": "smoke",
    "command": "pnpm exec playwright test --grep @smoke --project=chromium --reporter=json,line --trace=on-first-retry",
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
    { "type": "trace", "location": "test-results/checkout-completes-a-purchase/trace.zip", "framework": "playwright", "timestamp": "2026-07-18T11:05:01Z", "ownership": "qa-run", "testRef": "checkout > completes a purchase", "present": true },
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
  "recommendations": [
    {
      "action": "Analyze the checkout failure from its collected trace once failure analysis ships",
      "priority": "high",
      "command": "/qa-debug"
    }
  ],
  "metadata": { "planRef": "qa-run-plan-9c2e" }
}
```

The prose reply states the counts, that the run genuinely executed, and where the failure's evidence was collected — without diagnosing the failure, which is a later skill's job.
