---
# Illustrative copy of what `/qa-init` writes to `.qa/context.md` for THIS
# example project. It lives here (not at .qa/context.md) only because the repo
# git-ignores .qa/; copy it there yourself, or let /qa-init generate it.
schemaVersion: 1
generatedBy: "qa-init@0.2.0"
generatedAt: "2026-07-24T10:00:00Z"
repository:
  root: "."
  monorepo: false
  packages: []
language:
  primary: "typescript"
  others: ["javascript"]
runtime:
  node: ">=18"
packageManager: "npm"
buildTool: null
testFramework:
  unit: null
  e2e: "playwright"
  bdd: null
browserAutomation:
  tool: "playwright"
  mcp: false
apiStyles: []
ci:
  provider: null
  workflows: []
conventions:
  testDir: "tests"
  specGlob: "tests/**/*.spec.ts"
  configFiles: ["playwright.config.ts"]
existingAutomation: true
confidence: "high"
---

# QA Project Context

## Summary

A tiny single-page web app (a sign-in form and a dashboard) tested end to end
with Playwright and TypeScript. Tests live in `tests/`, run against a hermetic
local server started by Playwright's `webServer`, and are tagged `@smoke`.
Detection confidence is high: `playwright.config.ts` and `@playwright/test` are
both present.

## Detected stack

- E2E framework: Playwright — evidence: `playwright.config.ts`, `@playwright/test` in `package.json`.
- Language: TypeScript — evidence: `.ts` specs and config.
- Package manager: npm — evidence: `package-lock.json` (once dependencies are installed).
- Base URL: `http://localhost:3000`, served by the bundled `server.mjs`.

## Conventions

- Specs live in `tests/` and match `tests/**/*.spec.ts`.
- Smoke tests are tagged `@smoke`.
- Locators are role- and `data-testid`-based; no hard waits.

## Assumptions and gaps

- No CI provider is configured in this example; runs are local only.
- No API or unit-test layer — this example is E2E-only by design.
