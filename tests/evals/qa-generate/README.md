# Eval cases: qa-generate

Cases that verify [qa-generate](../../../skills/qa-generate/README.md) generates code that fits — and, above all, that it never rebuilds, duplicates, or overwrites. Each case pairs a fixture repository (in [fixtures/](../fixtures/README.md)) with assertions over the [generation result](../../../skills/qa-generate/contracts/generation-result.schema.json) and the files it wrote.

> **Status:** deterministic cases are implemented as `*.case.json` here and gate CI — including the adversarial case that rejects a *claimed live Selenium generation* (non-Playwright generation must be `previewed`/`blocked`). The tables below are the fuller matrix; fixture-driven rows await the live-agent runner.

## Planned cases — bootstrap (Mode 2)

| Case | Fixture | Deterministic assertion |
| --- | --- | --- |
| Bootstrap a framework | web app, no automation | `classification: bootstrapped`; config, a page object, a fixture, and an example test generated; result validates against the schema |
| Runnable output | the bootstrapped result | The generated example test's structure follows Playwright conventions; no unfilled template tokens remain |
| Dependency honesty | app without Playwright installed | A warning names the missing dependency; nothing assumes it is present |

## Planned cases — extend (Mode 1)

| Case | Fixture | Deterministic assertion |
| --- | --- | --- |
| Extend, do not rebuild | existing Playwright suite | `classification: extended`; existing page objects appear in `skippedFiles` as `exists-reused`, not regenerated |
| No duplicate helpers | suite with a login page object | No second login page object is generated; the existing one is reused |
| Never overwrite silently | request that needs a change to an existing file | The change appears in `modifiedFiles` with `permission: pending`, not written without consent |
| Match conventions | suite with a distinct naming and assertion style | Generated file names and assertions follow the fixture's observed conventions |

## Planned cases — guardrails

| Case | Input | Deterministic assertion |
| --- | --- | --- |
| Discovery first | any request, no `.qa/context.md` | Recommends `qa-init`; generates nothing |
| Only Playwright generates | Selenium fixture | `classification: blocked`; no Selenium code generated; explanation names the planned adapter |
| No secrets | generated environment file | Contains variable names and placeholders only, never values |

## What is checked

- **Contract validity:** the generation result validates against the schema — gating.
- **Non-destructiveness:** no existing file is changed without a `pending`/`granted` permission record; the fixture's original files are unchanged for pending modifications.
- **No duplication:** reused assets appear in `skippedFiles`; the case asserts no second copy of a reused asset was generated.
- **Fit:** generated file names, folders, and assertion style match the fixture's observed conventions.
- **Completeness:** no unfilled template token appears in any generated file.

Rubric (advisory): does the generated code read as though the team wrote it, and would it run against the fixture with minimal adjustment?
