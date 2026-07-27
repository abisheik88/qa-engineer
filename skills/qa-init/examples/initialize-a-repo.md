# Example: initialize a Playwright + TypeScript repository

## Request

```text
/qa-init
```

## Context

A single-package web project: `package.json` with `@playwright/test`, a `pnpm-lock.yaml`, a `playwright.config.ts`, tests under `e2e/`, and a `.github/workflows/ci.yml`. No `.qa/context.md` exists yet.

## Expected behavior

1. No existing `.qa/context.md`, so there is no human content to preserve.
2. Detection by direct reads, per the detection guide: `pnpm-lock.yaml` establishes the package manager; `@playwright/test` in `package.json` and `playwright.config.ts` establish the e2e framework; `tsconfig.json` establishes TypeScript; `e2e/**/*.spec.ts` establishes the convention; `.github/workflows/ci.yml` establishes the CI provider.
3. Each fact is recorded with its evidence and a calibrated confidence; all key facts are directly observed, so overall confidence is `high`.
4. No undetermined facts in this repository, so `## Assumptions and gaps` records only that no unit-test framework was found.
5. `.qa/context.md` is written and confirmed to match the contract structure.

## Expected output

The file `.qa/context.md`:

```markdown
---
schemaVersion: 1
generatedBy: "qa-init@0.1.0"
generatedAt: "2026-07-18T10:15:00Z"
repository:
  root: "."
  monorepo: false
  packages: []
language:
  primary: "typescript"
  others: ["javascript"]
runtime:
  node: "20.x"
packageManager: "pnpm"
buildTool: null
testFramework:
  unit: null
  e2e: "playwright"
  bdd: null
browserAutomation:
  tool: "playwright"
  mcp: false
apiStyles: ["rest"]
ci:
  provider: "github-actions"
  workflows: [".github/workflows/ci.yml"]
conventions:
  testDir: "e2e"
  specGlob: "e2e/**/*.spec.ts"
  configFiles: ["playwright.config.ts", "tsconfig.json"]
existingAutomation: true
confidence: "high"
---

# QA Project Context

## Summary

A TypeScript web project tested end to end with Playwright, managed by pnpm,
and run in GitHub Actions. Tests live under `e2e/` as `*.spec.ts`. Detection
confidence is high: every key fact was read directly from configuration.

## Detected stack

- Language: TypeScript (evidence: `tsconfig.json`, `.ts` predominance)
- Package manager: pnpm (evidence: `pnpm-lock.yaml`)
- E2E framework: Playwright (evidence: `playwright.config.ts`, `@playwright/test`)
- CI: GitHub Actions (evidence: `.github/workflows/ci.yml`)
- API styles: REST (evidence: `supertest` in devDependencies)

## Conventions

Tests live in `e2e/`, named `*.spec.ts`, configured by `playwright.config.ts`.

## Assumptions and gaps

- No unit-test framework detected; `testFramework.unit` is null. If unit tests
  exist under another tool, re-run qa-init after adding its dependency.

## Human notes

_No notes yet. Record environments, known-flaky areas, and ownership here;
reference environment-variable names only, never secret values._
```

The prose reply summarizes the detection at high confidence and names `/qa-run` as the next step.
