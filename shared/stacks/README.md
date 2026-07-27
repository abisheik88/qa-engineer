# shared/stacks/

> **Status: not authored.** This directory holds a scope note and nothing else.
> No skill loads stack knowledge today, and no capability claim depends on it —
> see the [capability matrix](../../docs/capability-matrix.md). Generation
> currently targets Playwright/TypeScript only, where the framework knowledge in
> [`shared/frameworks/playwright/`](../frameworks/playwright/README.md) carries
> the idioms. The catalog below is intent, not content. It was originally slated
> for Milestone 3 and did not land there; it will be scheduled explicitly rather
> than assumed complete.

Language and ecosystem idioms, loaded by skills when the project profile detects the language. Stack modules are intended to keep generated code idiomatic — a Java test should read like Java written by a Java engineer, not like transliterated TypeScript.

## Planned catalog

| Section | Scope |
| --- | --- |
| `typescript/` | Types in test code, project config for tests, ESM/CJS pitfalls in runners |
| `javascript/` | Module system realities, async discipline in tests without types |
| `java/` | Build tools (Maven/Gradle) for tests, JUnit/TestNG conventions, assertion libraries |
| `python/` | pytest idioms, fixtures and conftest structure, virtualenv realities |
| `csharp/` | NUnit/xUnit/MSTest conventions, project layout, async test patterns |

## What belongs here

- Naming, structure, and assertion idioms native to the language's test ecosystem.
- Dependency and build-tool conventions that affect where tests live and how they run.
- Language-specific traps in test contexts (async handling, shared state, serialization).

What does not: framework specifics (a Playwright-for-Python topic belongs in `frameworks/playwright/`, noting the binding differences) and universal judgment ([domains/](../domains/README.md)).

Module format: [templates/knowledge-module-template.md](../../templates/knowledge-module-template.md). Engine rules: [shared/README.md](../README.md).
