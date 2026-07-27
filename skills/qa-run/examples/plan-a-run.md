# Example: plan a smoke run

## Request

```text
/qa-run smoke
```

## Context

The repository from the qa-init example: `.qa/context.md` exists with `testFramework.e2e: playwright`, `packageManager: pnpm`, and `conventions.specGlob: e2e/**/*.spec.ts`. Smoke tests are tagged `@smoke`.

## Expected behavior

1. **Discover.** Read `.qa/context.md`; it exists, so proceed.
2. **Understand repository / framework.** Runner is Playwright via pnpm, from the context.
3. **Understand intent.** "smoke" selects the smoke strategy; no ambiguity, so no question.
4. **Determine strategy.** `smoke`, justified by the intent word "smoke" and the Playwright context fact.
5. **Plan.** Scope is the `@smoke`-tagged tests; the evidence plan captures a trace on failure and a report always; the collect, execute, and validate phases are marked `deferred`.
6. **Report.** Emit and self-validate the execution plan; execute nothing.

## Expected output

`qa-artifacts/qa-run-7f3a.json`:

```json
{
  "contract": { "name": "qa-run/execution-plan", "version": "1.0.0" },
  "skill": { "name": "qa-run", "version": "0.1.0" },
  "generatedAt": "2026-07-18T10:20:00Z",
  "summary": "Smoke run planned: the @smoke-tagged Playwright suite, run with pnpm, capturing a trace on failure. Planning only — no tests were executed.",
  "classification": "smoke",
  "confidence": 0.9,
  "evidence": [
    {
      "type": "context",
      "description": "E2E framework and runner",
      "source": ".qa/context.md",
      "excerpt": "testFramework.e2e: playwright; packageManager: pnpm"
    },
    {
      "type": "intent",
      "description": "User selected the smoke strategy",
      "source": "user request",
      "excerpt": "/qa-run smoke"
    }
  ],
  "plan": {
    "framework": "playwright",
    "runner": "pnpm exec playwright test",
    "command": "pnpm exec playwright test --grep @smoke --trace on-first-retry",
    "scope": { "include": ["@smoke"], "exclude": [] },
    "environment": {},
    "phases": [
      { "name": "discover", "status": "performed", "detail": "read .qa/context.md" },
      { "name": "understand-repository", "status": "performed" },
      { "name": "understand-intent", "status": "performed" },
      { "name": "determine-framework", "status": "performed", "detail": "playwright from context" },
      { "name": "determine-strategy", "status": "performed", "detail": "smoke" },
      { "name": "collect-evidence", "status": "deferred", "detail": "execution engine, later milestone" },
      { "name": "execute", "status": "deferred", "detail": "execution engine, later milestone" },
      { "name": "validate", "status": "deferred", "detail": "execution engine, later milestone" },
      { "name": "report", "status": "performed" },
      { "name": "recommendations", "status": "performed" }
    ]
  },
  "evidencePlan": {
    "artifacts": [
      { "type": "trace", "when": "on-failure", "purpose": "timeline for /qa-debug if the run fails" },
      { "type": "report", "when": "always", "purpose": "machine-readable pass/fail for the result" }
    ]
  },
  "recommendations": [
    {
      "action": "Deterministic execution of this plan arrives in a later milestone; until then the illustrative command can be run manually",
      "priority": "medium"
    }
  ],
  "metadata": {}
}
```

The prose reply presents the strategy and scope, states plainly that nothing was executed, and points to the plan artifact.
