# shared/generation/ — The Generation Platform

The framework-agnostic platform that turns a request for automation into production-quality code that belongs in the repository. It is what makes [`qa-generate`](../../skills/qa-generate/README.md) behave like an experienced automation engineer rather than a code generator: inspect first, extend before rebuilding, match what is already there, and never overwrite without permission.

Like the [execution platform](../execution/README.md), this is knowledge and contracts, not a program. The agent generates by following these modules and adapting the framework's [templates](../../skills/qa-generate/templates/playwright/) to the conventions it discovered. The decision to work this way is recorded in [ADR-0008](../../docs/architecture/ADR-0008-generation-architecture.md).

## The pipeline

```text
  user → /qa-generate → repository analysis → framework selection → mode decision
                                                                        │
                              ┌─────────────────────────────────────────┴───────────┐
                              ▼                                                       ▼
                     Mode 1: extend existing                             Mode 2: bootstrap new
                     (suite-extension)                                   (project-bootstrap)
                              └───────────────────────┬───────────────────────────────┘
                                                       ▼
                              template selection → code style + naming → generation result
```

Everything begins with discovery. Nothing is generated before the repository has been inspected, because the whole value of the skill is producing code that fits.

## Modules

| Module | Owns | Synced into generation skills |
| --- | --- | --- |
| [repository-analysis.md](repository-analysis.md) | Inspecting existing automation for its patterns and conventions | Yes |
| [framework-selection.md](framework-selection.md) | Choosing the framework to generate for; conflicts; detect-only frameworks | Yes |
| [generation-strategy.md](generation-strategy.md) | The mode decision and the generation strategies | Yes |
| [project-bootstrap.md](project-bootstrap.md) | Mode 2: creating a new enterprise-quality framework | Yes |
| [suite-extension.md](suite-extension.md) | Mode 1: extending existing automation without duplication | Yes |
| [template-selection.md](template-selection.md) | Choosing a template category and adapting it to the project | Yes |
| [code-style.md](code-style.md) | Matching the repository's formatting and idioms | Yes |
| [naming-conventions.md](naming-conventions.md) | Inferring and following the project's naming | Yes |

Framework-specific generation lives under [shared/frameworks/](../frameworks/README.md); Playwright is the reference, with its code templates carried by the `qa-generate` skill.

## How frameworks plug in

Generation stays framework-agnostic through a **template-category contract**: every framework provides the same categories of template (configuration, page object, fixture, API helper, test data, utility, example test, environment, README), and the platform selects and adapts them the same way for any framework. Playwright ships full templates in the skill; Selenium, Cypress, and WebdriverIO generation follows each framework's generation module and the project's conventions — **existing non-Playwright suites are extended in-place**, never replaced by Playwright. Greenfield bootstrap asks the user to pick framework (Playwright / Selenium / Other) and language (TypeScript / JavaScript / Python / Java / Other) first.

## Boundaries

This platform *creates and extends* automation. It does not run it (that is the [execution platform](../execution/README.md)), and it does not repair or debug it (later milestones). It produces code and a [generation result](../../skills/qa-generate/contracts/generation-result.schema.json); running that code is `qa-run`'s job.
