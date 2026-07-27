---
name: qa-generate
description: >-
  Generates production-quality test automation: scaffolds a new
  framework when none exists after choosing tooling plus TypeScript,
  JavaScript, Python, or Java preference, or extends existing
  automation with page objects, glue code, and concrete locators
  harvested from the application under test. Use when creating tests,
  page objects, fixtures, BDD glue, an API helper, or bootstrapping
  an automation project.
license: MIT
metadata:
  version: "0.2.0"
  maturity: beta
  audience: user
---

# QA Generate

## Purpose

Produce automation that looks like a senior SDET wrote it and belongs in this repository:

- **Extend** an existing suite (Playwright or another detected framework): review what exists, add specs and/or Gherkin + step definitions, implement them, and bind **concrete locators harvested from the real site** when a URL is available.
- **Bootstrap** when no test framework exists: ask for framework (Playwright / Selenium / Other) and language (TypeScript / JavaScript / Python / Java / Other), then build an enterprise-quality spine that follows coding standards.

**Framework support (be honest about it).** Only **Playwright** generation is Production — it has curated, tested templates under [templates/playwright/](templates/playwright/). Generation for **Selenium, Cypress, and WebdriverIO is Beta**: follow each framework's convention modules, but there are no curated templates and no tests for them, so mark generated non-Playwright code **unverified** in the result's `warnings`, keep the user on their existing stack (never switch to Playwright silently), and recommend review. This mirrors `/qa-run`, which executes Playwright live and only plans the others.

Do not use this skill to run tests (`/qa-run`), explore a URL for bugs (`/qa-explore`), or debug failures (`/qa-debug`). After generating, recommend `/qa-run`.

## Inputs

- The user's request (follows in the conversation): what to generate and any URL / feature / cases.
- `.qa/context.md` — read first. Absent → recommend `/qa-init` and continue only if the user still wants a greenfield bootstrap (then rely on repo scan + intake).
- Existing automation (specs, page objects, features, step defs) for patterns and reuse.
- Optional live URL or running app for locator harvest.
- Framework templates under [templates/playwright/](templates/playwright/) when targeting Playwright; other frameworks follow their generation modules under shared frameworks knowledge synced into references when present.

## Context loading

| When | Load |
| --- | --- |
| Inspecting existing automation | [references/repository-analysis.md](references/repository-analysis.md) |
| Choosing framework / language; existing vs greenfield | [references/framework-selection.md](references/framework-selection.md) |
| Deciding mode and strategy | [references/generation-strategy.md](references/generation-strategy.md) |
| Bootstrapping a new framework | [references/project-bootstrap.md](references/project-bootstrap.md) |
| Extending a suite (steps, locators, reuse) | [references/suite-extension.md](references/suite-extension.md) |
| Templates, style, naming | [references/template-selection.md](references/template-selection.md), [references/code-style.md](references/code-style.md), [references/naming-conventions.md](references/naming-conventions.md) |
| Playwright specifics | [references/playwright-generation.md](references/playwright-generation.md), [references/playwright-conventions.md](references/playwright-conventions.md), [references/playwright-project-discovery.md](references/playwright-project-discovery.md) |
| Evidence and report | [references/evidence-and-reporting.md](references/evidence-and-reporting.md) |

## Procedure

Discovery always comes first; generation never precedes inspection.

1. **Discover.** Read `.qa/context.md` when present. Analyze the repo for automation (Playwright, Selenium, Cypress, WebdriverIO, Cucumber glue, etc.), conventions, and reuse candidates.
2. **Select framework (and language on bootstrap).**
   - **Automation exists** → generate in **that** framework (never switch to Playwright silently). If several, ask one question.
   - **None exists** → ask once, combined:
     - Framework: **Playwright** (default), **Selenium**, or **Other** (user keys the name).
     - Language: **TypeScript**, **JavaScript**, **Python**, **Java**, or **Other** (user keys the name). Highlight the repo's primary language as the suggested default.
   - If the request already named framework/language, skip the picker.
3. **Decide the mode.** Automation for the framework exists → Mode 1 (extend). None → Mode 2 (bootstrap).
4. **Determine the strategy.** Map the request (feature, page, scenario, suite, project, …). Ambiguous scope → one question.
5. **Live locators (Mode 1, when URL/app available).** Inspect the real pages; capture stable locators into page objects / locator maps; do not invent selectors when the DOM is visible.
6. **Plan the files.** Specs and/or `.feature` files, step definitions, page objects/methods, fixtures. Classify new vs reuse vs modify-with-permission.
7. **Generate non-destructively.** Write new files. Propose edits to existing step defs / page objects; write those only after explicit permission. Match project style. No placeholder tokens; declare new dependencies.
8. **Report.** Emit `generation-result` JSON, summarize files, and recommend `/qa-run`.

## Guardrails

- **Discovery before generation.** Never assume conventions not observed.
- **Same framework.** Existing Selenium/Cypress/WDIO suites stay on that stack — and because their generation is Beta (no curated templates, untested), flag the output as unverified rather than presenting it as proven.
- **Extend, never rebuild.** Reuse page objects, fixtures, auth, steps; duplicates are defects.
- **Never overwrite without permission.**
- **Senior-SDET bar on bootstrap.** Stable locators, no hard waits, isolation, secrets out of repo, idiomatic layout, runnable README.
- **No secrets** in generated env files — names and placeholders only.
- **Valid and complete** output; no "generated by" banners.

## Output

A generation result under `qa-artifacts/` conforming to [contracts/generation-result.schema.json](contracts/generation-result.schema.json): framework, language (when bootstrapped), mode, files generated/modified/skipped, discovery evidence, warnings (e.g. locators unverified), recommendations. Classify `bootstrapped`, `extended`, `previewed`, or `blocked`. Validate against the schema before completion.
