# Selenium Framework Adapter

The pack's second framework, and the proof of the multi-framework architecture. Selenium implements the same [execution adapter contract](../../execution/execution-contract.md), the same [generation template categories](../../generation/template-selection.md), and the same [analysis](../../analysis/README.md) shapes as Playwright — so adding it required **zero changes** to `qa-run` or `qa-generate`. All Selenium-specific knowledge lives here.

This milestone delivers Selenium's foundation: detection, execution planning, generation planning, artifact mapping, and normalization. Selenium does not execute or generate yet — those flip on in a later milestone — but its adapter is complete enough to prove that the contracts, not the skills, carry the framework.

## Modules

| Module | Adapter responsibility |
| --- | --- |
| [selenium-detection.md](selenium-detection.md) | Recognizing a Selenium project and selecting the adapter |
| [selenium-execution.md](selenium-execution.md) | Execution planning: how a Selenium run would be built (planning only this milestone) |
| [selenium-generation.md](selenium-generation.md) | Generation planning: how Selenium fills the template categories (planning only) |
| [selenium-artifacts.md](selenium-artifacts.md) | Where Selenium writes artifacts and how they map to the common model |
| [selenium-conventions.md](selenium-conventions.md) | Structural conventions across Selenium's language bindings |

The Selenium analysis adapter — `lib/selenium_analysis.py` — is deliberately thin: Selenium reports through JUnit, so normalization reuses the framework-agnostic JUnit parser. That thinness is the point.

## Why Selenium proves the architecture

The success criterion for the multi-framework foundation was that a second framework slots in without touching the skills. Selenium meets it: its normalization is the shared JUnit parser, its failure classification is the shared taxonomy, its execution and generation follow the shared contracts. The only new code is in this directory. See [ADR-0010](../../../docs/architecture/ADR-0010-multi-framework-foundation.md).

## Not yet

No Selenium debugging or fixing — those are diagnostic skills of a later milestone, and this milestone builds no user-facing diagnostic skills for any framework. No live Selenium execution or generation; the adapter documents the plan so a later milestone flips it on without redesign.
