# Cypress Framework Adapter

The pack's third framework. Cypress implements the same [execution adapter contract](../../execution/execution-contract.md), [generation template categories](../../generation/template-selection.md), and [analysis](../../analysis/README.md) shapes as Playwright and Selenium — so adding it changed only this directory, with zero changes to `qa-run`, `qa-generate`, or the diagnostic skills.

This milestone delivers Cypress's adapter: detection, execution planning, generation planning, artifact mapping, conventions, and a thin analysis adapter that reuses the shared JUnit parser.

## Modules

| Module | Adapter responsibility |
| --- | --- |
| [cypress-detection.md](cypress-detection.md) | Recognizing a Cypress project |
| [cypress-execution.md](cypress-execution.md) | Execution planning (planning only this milestone) |
| [cypress-generation.md](cypress-generation.md) | Generation planning against the template categories |
| [cypress-artifacts.md](cypress-artifacts.md) | Where Cypress writes artifacts and how they map to the common model |
| [cypress-conventions.md](cypress-conventions.md) | Structural conventions the platform reads |

The analysis adapter — `lib/cypress_analysis.py` — is thin: with a JUnit reporter configured, normalization reuses the framework-agnostic parser. Its thinness is the proof that the boundary holds.

## Not yet

No live Cypress execution or generation (gated by the skills' current Playwright-only guardrails); no Cypress-specific diagnostics beyond the shared engine. The adapter is complete; flipping execution and generation on is a future, adapter-free step.
