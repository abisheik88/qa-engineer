<!-- synced-from: shared/generation/suite-extension.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# Suite Extension (Mode 1)

How generation extends an existing automation suite. The suite works; the team has conventions; new code must disappear into what is already there — including **step definitions**, **implementations**, and **concrete locators harvested from the real site**.

Extension runs whenever repository analysis found existing automation for the selected framework.

## The prime directive

**Extend, never rebuild.** Never regenerate, restructure, or "improve" the whole suite as a side effect of adding coverage.

## Review first

Before writing:

1. Map existing page objects / screens, fixtures, helpers, and (if BDD) feature files + step definition modules.
2. Note locator strategy, assertion library, naming, and folder layout.
3. Identify reuse candidates — prefer extending an existing page object or step over creating a parallel one.

## Real-site locators (mandatory when a URL or running app is available)

When the user provides a URL, open environment, or attached flows targeting a live site:

1. Open the relevant pages with the host browser / Playwright (or the project's runner in headed/debug form).
2. Derive **concrete locators** from the real DOM: prefer role, label, placeholder, text, and `data-testid` / stable attributes; avoid positional absolute XPath and CSS chained to layout chrome.
3. Encode locators once in page objects (or the project's locator map) — not inlined repeatedly in tests.
4. If the site is unreachable, use provided HTML/screenshots/DOM dumps; mark locators as `unverified-against-live` in the generation result warnings.

Do not invent fake selectors when the live page can be inspected.

## Step definitions and implementations

| Suite style | Extension behavior |
| --- | --- |
| Plain Playwright / Selenium / Cypress / WDIO specs | Add or extend specs + page objects / helpers |
| Cucumber / BDD (Gherkin) | Add or update `.feature` scenarios **and** matching step definitions + the automation behind them (page methods, fixtures) in the **same** glue language and folder conventions |
| Hybrid | Follow whichever pattern the touched area already uses |

When adding a scenario:

1. Reuse existing steps when wording already matches.
2. Add new step definitions only for genuinely new phrases.
3. Implement steps by calling page objects / screen APIs — keep steps thin.
4. Propose edits to existing step files; obtain permission before modifying them.

## Reuse before create

| Existing asset | Extension behavior |
| --- | --- |
| Page objects | Extend with methods/locators; do not duplicate the page |
| Fixtures | Reuse; add only for new shared state |
| Authentication | Reuse existing auth |
| Utilities | Call existing helpers |
| Configuration | Extend; never replace |
| Step definitions | Reuse phrases; add only gaps |
| Naming and folders | Match convention exactly |

A duplicate page object or parallel login helper is a defect.

## Matching conventions

Apply detected code-style and naming: assertions, locators, fixtures, titles, folders. Stylistically foreign code has failed even if it "works".

## Non-destructive rules

- New files may be written freely.
- Changes to existing files (page methods, step defs, locators) are **proposed**; write only after explicit permission; until then record as pending.
- Preserve formatting and imports; touch only what is required.
- Imperfect existing conventions still win over pack preferences (recommend improvements; do not rewrite the suite).

## Output

Generation result with `classification: extended`: new files, pending modifications, skipped-reused assets, locator sources (live vs inferred), and a recommendation to run `/qa-run`.
