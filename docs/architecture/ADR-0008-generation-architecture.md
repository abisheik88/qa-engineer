# ADR-0008: Generation is discovery-first, non-destructive, and convention-matching

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

`qa-generate` produces test automation, and the way it produces it determines whether the pack is useful or dangerous. A generator that assumes a structure, imports its own style, or overwrites files would actively harm real repositories: it would duplicate existing page objects, fight the team's conventions, and destroy working code. The bar for this milestone is output that an experienced SDET would accept as their own — which is a statement about *fit*, not about volume of code.

Two shapes of problem had to be settled. First, behavior: how does generation avoid the failure modes (assuming, duplicating, overwriting, importing a foreign style) that make AI code generation untrustworthy in an existing codebase. Second, extensibility: how does generation stay framework-neutral so the four target frameworks share one generator, consistent with the execution engine's [adapter approach](ADR-0006-execution-architecture.md).

## Decision

Generation is **discovery-first, non-destructive, and convention-matching**, and frameworks plug in through a **template-category contract**.

- **Discovery always precedes generation.** `qa-generate` reads `.qa/context.md` for stack facts and analyzes the existing automation for its patterns, conventions, and reuse candidates before producing anything. A convention that was not observed is asked about or recorded as an assumption — never invented. This is the [repository-analysis](../../shared/generation/repository-analysis.md) module.
- **Two modes, decided by what exists.** If automation for the framework exists, generation is Mode 1 (extend); if not, Mode 2 (bootstrap). A working suite is never rebuilt — the mode decision protects it.
- **Extend before create; reuse before generate.** In Mode 1, existing page objects, fixtures, authentication, and utilities are reused, and a duplicate is treated as a defect ([suite-extension](../../shared/generation/suite-extension.md)).
- **Never overwrite without explicit permission.** New files are created freely; a change to an existing file is proposed and written only on the user's consent, and is otherwise recorded as pending.
- **Match the project, not the pack's preferences.** Generated code follows the repository's style, naming, folders, and assertion library, and conforms to any formatter or linter config. It carries no generated-by markers; the goal is invisibility ([code-style](../../shared/generation/code-style.md), [naming-conventions](../../shared/generation/naming-conventions.md)).
- **Frameworks fill template categories.** Every framework provides the same categories of template (configuration, page object, fixture, API helper, test data, utility, example test, environment, README); the [platform](../../shared/generation/template-selection.md) selects and adapts them identically for any framework. Playwright fills them now; the others fill the same categories later and gain generation without changing `qa-generate`.
- **The result is a contract.** Generation emits a [generation result](../../skills/qa-generate/contracts/generation-result.schema.json) recording created, modified, and skipped files with the discovery evidence behind each decision — consistent with the pack's [output-contract standard](../skills/output-contracts.md).

## Alternatives considered

- **Generate from templates without deep discovery** (use `.qa/context.md` stack facts alone). Rejected: stack facts say *what* the framework is, not *how the team uses it*. Without inferring the existing page-object shape, fixture strategy, and naming, generated code is correct but foreign — and in an existing suite, duplicative. The deep analysis is the difference between fitting in and standing out.
- **Overwrite freely and let version control sort it out.** Rejected outright: it destroys working code, and "you can revert it" is not consent. Non-destructiveness with explicit permission for modifications is the only safe default for a tool that writes into real repositories.
- **A separate generator skill per framework.** Rejected: it duplicates the discovery, mode, strategy, style, and naming logic four times, violating principle 3 ([skills stay small](../engineering-principles.md)) and principle 4 (shared knowledge). The template-category contract keeps one framework-neutral generator, mirroring the execution adapter boundary.
- **Impose the pack's best practices on the existing suite.** Rejected: when the project's convention and the pack's preference conflict, the project wins. Generation may *recommend* a better practice, but rewriting a suite to impose one is a destructive change disguised as improvement.

## Consequences

- `qa-generate` produces code that belongs in the repository, and it is safe to run against a working suite because it extends and proposes rather than rebuilds and overwrites.
- The generator is framework-neutral; adding Selenium, Cypress, or WebdriverIO generation is filling the template categories and a generation module under `shared/frameworks/`, with zero changes to `qa-generate` — the same test the execution adapter boundary must pass.
- Non-destructiveness costs an interaction: modifying an existing file requires a permission step rather than a silent write. This is deliberate friction, and the generation result makes pending changes explicit so nothing is lost.
- Generation quality depends on the accuracy of convention inference and the quality of the templates. Neither is verified by a compiler in this milestone; both are checked by review now and by the [evaluation harness](../../tests/evals/README.md) later, which will generate into fixtures and confirm the output runs.
- The template-category contract and the non-destructive rule are now load-bearing: changing either is a major change requiring a superseding ADR.
