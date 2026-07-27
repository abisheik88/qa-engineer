# Repository Analysis for Generation

How generation inspects a repository before producing anything. Stack facts — language, package manager, framework, CI — are already recorded in `.qa/context.md` by `qa-init`; this module does not re-detect them. It analyzes the **existing automation's patterns and conventions**, so generated code matches what is already there rather than importing a generic style.

The rule is absolute: inspect before generating, and infer conventions from evidence, never from habit. A convention this module cannot observe is one generation must ask about or state as an assumption — never one it invents.

## Inputs

- `.qa/context.md` for the stack facts (framework, language, test directory, conventions already detected).
- The existing test and automation code, read directly. If `.qa/context.md` is absent, stop and recommend `qa-init` — generation without a profile is guessing.

## What is analyzed

Each element is inferred by reading real files, and the evidence for each inference is recorded in the generation result:

| Element | Inferred from |
| --- | --- |
| Folder layout | Where tests, page objects, fixtures, and helpers actually live |
| Page Object pattern | Whether page objects exist, and their shape — classes, methods, locator placement |
| Fixture strategy | How setup and shared state are provided (framework fixtures, base classes, hooks) |
| Assertion style | The assertion library and idiom actually used |
| Locator strategy | How elements are selected — role/label/text first, or selectors, and where they are defined |
| Utilities and helpers | Existing shared functions, and what they cover, so they are reused not duplicated |
| Hooks | Setup and teardown conventions |
| Retry strategy | Configured retries and where |
| Configuration | The framework config and what it already sets |
| Reporting | Configured reporters |
| Test naming | How test files and test titles are named |
| Tagging | Whether and how tests are tagged or grouped into suites |
| Environment handling | How base URLs, credentials, and per-environment config are managed |
| API and protocol usage | Whether REST, GraphQL, or WebSocket helpers exist |

## Inference rules

- **Observe, do not assume.** A pattern is recorded only when real code demonstrates it. "No page objects found" is a valid, recorded finding; it is not an invitation to assume the project does not want them.
- **Dominant pattern wins.** When a repository shows a convention inconsistently, the dominant form is the one to match, and the inconsistency is noted as a warning — generation follows the majority, not the outlier.
- **Confidence is recorded.** Each inferred convention carries a confidence; low-confidence inferences are surfaced so a human can correct them before code is written.
- **Reuse candidates are catalogued.** Existing page objects, fixtures, utilities, and helpers are listed as reuse candidates, so extension consumes them rather than regenerating them.

## Output

A convention profile — the detected patterns, their evidence, their confidence, and the reuse candidates — that feeds every downstream decision: which mode to use, which template to adapt, how to style and name the output. Nothing is generated until this profile exists, and everything generated is traceable back to it.
