# Example: bootstrap after framework + language intake

Mode 2 — no automation in the repo. Generation asks for framework and language, then builds a senior-SDET-quality spine.

## Request

```text
/qa-generate set up end-to-end automation for this app
```

## Context

A TypeScript + pnpm web app with no e2e suite. `.qa/context.md` has `testFramework.e2e: null`, `language.primary: typescript`.

## Expected behavior

1. **Discover.** No automation → Mode 2 candidate.
2. **Intake (one prompt).** Offer frameworks: Playwright (default), Selenium, Other. Offer languages: TypeScript (highlighted default), JavaScript, Python, Java, Other. User picks Playwright + TypeScript.
3. **Bootstrap.** Generate config, page-object base, fixtures, utilities, env example, README, one example test — coding standards applied (role/label locators, no hard waits).
4. **Report.** `bootstrapped`; list deps to install and `/qa-run` command.

## Expected output

Result includes `framework: playwright`, language TypeScript in metadata/evidence, `classification: bootstrapped`.
