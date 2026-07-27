# Playwright: Conventions

The structural conventions of a Playwright project that execution relies on to locate and select tests. This module records only what execution needs to read; authoring conventions (how to write good Playwright tests) belong to the generation and review skills of later milestones.

## Layout

- **Test directory.** Playwright tests conventionally live under `e2e/`, `tests/`, or the `testDir` set in the config. The authoritative value is `conventions.testDir` in `.qa/context.md`, confirmed against the config.
- **Spec naming.** Test files match `*.spec.ts` or `*.spec.js` (or the config's `testMatch`). This glob is what path- and file-scoped strategies select against.
- **Config location.** `playwright.config.ts` at the repository or package root; in a monorepo, each package may have its own, and each is discovered separately.

## Projects and tags

- **Projects** name browser and setting combinations; execution selects among them with `--project`. Their names and pinned browsers are read during discovery.
- **Tags** are annotations in test titles (for example a `@smoke` marker) that Playwright selects with `--grep`. Tag-based and smoke strategies rely on the project's tagging convention, which is recorded in the context file when detected.

## Why execution needs this

Selection is only as good as the conventions it targets. A smoke strategy that greps `@smoke` depends on the project actually tagging smoke tests; a directory strategy depends on the test directory being where the context says. Execution reads these conventions from the context file and the config, and when a convention a strategy depends on is absent — a smoke run against a project with no smoke tags — it stops and explains rather than running an empty or wrong selection.

## Boundary

This module is not synced into execution skills, because execution reads conventions from `.qa/context.md` and the config at run time rather than needing them in context. It is kept here as the reference for the conventions execution assumes, and as the seed for the authoring conventions later skills will document.
