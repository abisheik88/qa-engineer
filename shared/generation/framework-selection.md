# Framework Selection for Generation

Which framework generation targets, how to choose when none exists, and how to stay faithful when one already does. Generation reads `.qa/context.md` and the repository; this module decides the target.

## Support tiers

Only Playwright generation is Production (curated, tested templates). Selenium,
Cypress, and WebdriverIO generation is **Beta**: convention-driven, with no
curated templates and no tests — mark its output unverified. See the pack's
canonical capability matrix (`docs/capability-matrix.md`) for the authoritative
support levels.

| Framework | Generation behavior | Level |
| --- | --- | --- |
| Playwright | Full generation — templates under the skill's `templates/playwright/` | **Production** |
| Selenium | Generation in the project's language — follow `shared/frameworks/selenium` generation + conventions; no silent Playwright substitution; **output unverified** | Beta |
| Cypress | Generation following Cypress conventions and project patterns; **output unverified** | Beta |
| WebdriverIO | Generation following WebdriverIO conventions and project patterns; **output unverified** | Beta |
| Cucumber / BDD paired with any of the above | Extend step definitions and glue in the **same** BDD stack already present (a style layer, not a separate framework) | — |
| Robot Framework | Detect-only — acknowledge; do not bootstrap Robot unless the user explicitly keys it in as "other" | Planning |
| Appium | Detect-only unless the user explicitly keys it in as "other" and accepts mobile scope | Planning |

**Never replace an existing framework with Playwright.** If Selenium (or Cypress / WebdriverIO) is present, generate in that framework.

## When automation already exists (extend)

1. Detect the framework from context + repository analysis.
2. Target **that** framework — do not ask the user to switch.
3. If multiple frameworks exist (migration/monorepo), ask **one** question naming them, then proceed.
4. Proceed to Mode 1 (suite extension), including real-site locator harvest and step-definition updates when BDD is in use.

## When no test framework exists (bootstrap intake)

Before writing any files, collect two choices with **one combined prompt** (not a long interview):

### Framework (defaults + other)

Present:

1. **Playwright** (recommended default for new web E2E)
2. **Selenium**
3. **Other** — user keys the desired framework name (e.g. Cypress, WebdriverIO, TestCafe)

If the user already named a framework in the request, skip the picker and use it.

### Language

Present:

1. TypeScript  
2. JavaScript  
3. Python  
4. Java  
5. **Other** — user keys the language (e.g. C#, Kotlin)

Prefer the repository's primary language from `.qa/context.md` / package manifests as the **highlighted default**, but still confirm when bootstrapping a greenfield suite.

Record both answers as evidence in the generation result (`framework`, `language`).

## Selecting the target (summary)

1. **Existing automation for a supported framework** → that framework (no picker).
2. **Explicit intent in the request** → use it (bootstrap or extend as appropriate).
3. **No automation** → framework + language intake above, then Mode 2.
4. **Ambiguous among existing frameworks** → one clarifying question.

## Conflict resolution

1. Explicit intent  
2. Scope (package / folder)  
3. Single detected e2e framework  
4. One question if still ambiguous  

Never guess. Never generate Playwright into a Selenium repo.

## Interaction with mode

Framework (and language, on bootstrap) selection precedes the mode decision. Mode 1 vs Mode 2 then follows whether automation for *that* framework already exists.

## Extension

Live, template-backed generation is Playwright-only today. For Selenium /
Cypress / WebdriverIO the agent generates from each framework's convention
modules **without curated templates or tests**, so that output is Beta and must
be flagged unverified. Promoting richer, tested template packs for those stacks
is the step that would move them from Beta toward Production; it does not change
these selection rules.
