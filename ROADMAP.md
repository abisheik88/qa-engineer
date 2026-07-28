# Roadmap

This roadmap describes where the project is going and in what order. It is a statement of intent, not a contract: sequencing may change in response to user feedback, and anything not yet shipped may be re-scoped. Material changes land here first, via pull request, so the history of the plan stays reviewable.

The finalized architecture behind these milestones lives in [docs/architecture/overview.md](docs/architecture/overview.md), and the values that guide the work are in [docs/engineering-principles.md](docs/engineering-principles.md).

## Milestone overview

| Milestone | Theme | Status |
| --- | --- | --- |
| M1 | Repository foundation | **Complete** |
| M2 | Skill development platform | **Complete** |
| M3 | QA core engine | **Complete** |
| M4 | Execution engine | **Complete** |
| M5 | Intelligent automation generation | **Complete** |
| M6 | Deterministic analysis platform and multi-framework foundation | **Complete** |
| M7 | QA diagnostic platform (debug, fix, report) | **Complete** |
| M8 | QA knowledge platform and multi-framework completion | **Complete** |
| M9 | Developer experience and distribution | In progress (installer + M9.5 onboarding shipped; docs site / npm publish remain) |
| M9.5 | World-class installation & onboarding | **Complete** |
| M10 | Behavioral evaluation and benchmarking (release gate) | Planned |
| M10.5 | Architecture hardening & mechanical enforcement | **Complete** |

## M1 — Repository foundation

**Goal:** a repository that is governable, reviewable, and CI-guarded before any product content lands.

Shipped: community health files, issue forms and PR template, CODEOWNERS, Dependabot, CI (Markdown lint, EditorConfig, internal link check, structure validation), scheduled external link check, the ADR system with three founding decisions, contributor standards, versioning and release policy, and documented reserved directories.

## M2 — Skill development platform

**Goal:** adding a high-quality skill takes minutes, not days — every future skill is generated from and validated against one set of standards.

Shipped: the canonical skill anatomy and normative `SKILL.md` specification; the authoring guide; the shared knowledge engine with copy-based sync and a CI drift gate; the output-contract standard; per-dimension quality checklists; templates for skills, knowledge modules, contracts, examples, RFCs, and release notes; validation tooling (`validate-skills`, `sync-shared`, `check-keywords`) in CI; the `qa-example` reference skill; and the VS Code workspace.

## M3 — QA core engine

**Goal:** the foundation every future QA skill depends on — the entry point, project understanding, and orchestration — built on the M2 platform, with nothing for later milestones to duplicate.

Shipped: the three core skills — [`qa`](skills/qa/README.md) (router), [`qa-init`](skills/qa-init/README.md) (repository understanding, writes `.qa/context.md`), and [`qa-run`](skills/qa-run/README.md) (run planning; plans without executing); the [project context contract](docs/architecture/context-contract.md); the [execution lifecycle](docs/architecture/execution-lifecycle.md); the [engineering principles](docs/engineering-principles.md); the [skill-interaction](docs/architecture/skill-interactions.md) and [extension-point](docs/architecture/extension-points.md) maps; the [evaluation framework design](tests/evals/README.md); and ADR-0004 and ADR-0005.

**Not shipped in M3, and since removed:** the `shared/ci/` and `shared/stacks/`
knowledge catalogs were scoped here and never authored. Rather than carry two
empty directories, [ADR-0015](docs/architecture/ADR-0015-no-reserved-empty-directories.md)
removed them: knowledge is added when a skill loads it. Language-idiom knowledge
and CI-log triage knowledge remain worthwhile and are recorded below as
unscheduled future work, with the condition for starting them — a skill that
needs them.

## M4 — Execution engine

**Goal:** `/qa-run` executes tests against a real application like an automation engineer would, on a framework-agnostic platform every future execution skill reuses.

Shipped: the shared [execution platform](shared/execution/README.md) (framework detection, execution strategy, command builder, browser lifecycle, artifact collector, report normalization, environment detection, and the [adapter contract](shared/execution/execution-contract.md)); the [Playwright reference adapter](shared/frameworks/playwright/README.md) — the only framework that executes this milestone; the [normalized execution result contract](skills/qa-run/contracts/execution-result.schema.json) and the common artifact model that the analysis layer will consume; the [`qa-run`](skills/qa-run/README.md) upgrade from planner to executor; and ADR-0006 and ADR-0007.

## M5 — Intelligent automation generation

**Goal:** `/qa-generate` produces production-quality automation like an experienced SDET — bootstrapping a framework where none exists, or extending an existing suite without duplicating or overwriting it.

Shipped: the shared [generation platform](shared/generation/README.md) (repository analysis, framework selection, the mode and strategy decisions, project bootstrap, suite extension, template selection, code style, naming); the [Playwright generation reference](shared/frameworks/playwright/playwright-generation.md) with a curated set of production-quality code templates; the [generation result contract](skills/qa-generate/contracts/generation-result.schema.json); the [`qa-generate`](skills/qa-generate/README.md) skill with its two modes; and ADR-0008. Generation covers Playwright; the other frameworks are detected but not yet generated.

## M6 — Deterministic analysis platform and multi-framework foundation

**Goal:** the deterministic infrastructure every diagnostic skill will consume, and proof that frameworks plug in without touching the skills above them.

Shipped: the shared [analysis platform](shared/analysis/README.md) — knowledge modules plus a tested, standard-library-only Python core (`shared/analysis/lib/`): redaction, the evidence model, the failure taxonomy, artifact discovery and validation, JUnit and HAR parsers, a contract validator, and the diff guard. The [Playwright analyzers](shared/frameworks/playwright/README.md) (trace and report). The [`.qa/context.md` schema](shared/analysis/schemas/context.schema.json). The [Selenium reference adapter](shared/frameworks/selenium/README.md) — the second framework — proving that adding it changed only `shared/frameworks/`, with zero changes to `qa-run` or `qa-generate`, demonstrated by a cross-framework compatibility test. And ADR-0009 and ADR-0010.

## M7 — QA diagnostic platform (debug, fix, report)

**Goal:** the first complete QA investigation workflow — one shared diagnostic engine consumed by three skills.

Shipped: the shared [diagnostic engine](shared/diagnostics/README.md) (11 knowledge modules plus the tested `diagnostics` Python package: root-cause analysis, timeline reconstruction, prioritization, recommendation ranking, repair planning); the three skills — [`qa-debug`](skills/qa-debug/README.md) (evidence-backed root cause, timeline, priority, owner), [`qa-fix`](skills/qa-fix/README.md) (safe repair plans, never code, gated by the diff guard), and [`qa-report`](skills/qa-report/README.md) (aggregated summaries and a release-readiness verdict); their three contracts and worked examples; the `authorization` and `flaky` taxonomy additions; the Python bundling tool proving self-containment; and ADR-0011. Reasoning lives once; the skills differ only in presentation.

## M8 — QA knowledge platform and multi-framework completion

**Goal:** complete the reusable QA engineering knowledge and prove the platform across four frameworks — the capstone of the pack's QA capability.

Shipped: the [QA knowledge base](shared/domains/README.md) — 17 authored domain documents (locators, waiting, assertions, page objects, fixtures, test data, flakiness, retry, authentication, REST/GraphQL/WebSocket, accessibility, performance, security, visual testing, anti-patterns) with a uniform seven-section structure and a knowledge-lint; the four remaining user-facing skills ([qa-review](skills/qa-review/README.md), [qa-flaky](skills/qa-flaky/README.md), [qa-api](skills/qa-api/README.md), [qa-audit](skills/qa-audit/README.md)) with their contracts and examples; the [Cypress](shared/frameworks/cypress/README.md) and [WebdriverIO](shared/frameworks/webdriverio/README.md) adapters, proven with Playwright and Selenium to produce identical contracts by the cross-framework test; the [framework compatibility matrix](docs/compatibility/framework-matrix.md); and ADR-0012 and ADR-0013. The eleven-command surface was complete at M8 close.

### Post-M8 — Full-spectrum product QA

Shipped: [`qa-explore`](skills/qa-explore/README.md) as the twelfth user-facing command ([RFC-0001](docs/rfcs/RFC-0001-qa-explore.md)) — live URL intake, attached test-case execution, functional / API / performance / security / UI-UX dimensions, optional DB validation, and evidence-backed reports with screenshots. Domains `exploratory-qa` and `api-replay` extend the knowledge base. The twelve-command surface is the current lock.

## M9 — Developer experience and distribution

**Goal:** make the platform easy to install, integrate, and keep current.

**Shipped so far:** the `qa` installer CLI under [packages/installer](packages/installer/README.md); agent registry (Claude Code, Cursor, Codex, OpenCode, Gemini CLI, Copilot, Antigravity, Kimi); per-agent guides in [docs/installation/](docs/installation/README.md); lockfile + thin wrappers; M9.5 interactive onboarding (below).

**Remaining:** documentation site, actual npm registry publish (release workflow is scaffolded), and broader example repositories. Resolves the open integration questions in [ADR-0002](docs/architecture/ADR-0002-agent-skill-standard.md).

## M9.5 — World-class installation and onboarding

**Goal:** a first-time user can run `npx qa-engineer`, complete install + validation, and use the pack in their AI assistant within five minutes — without reading repository internals.

**Shipped:** interactive onboard wizard (`@clack/prompts`); environment / framework / project detection and recommendations; install progress + automatic validation; `qa self-test`, expanded `qa doctor`, `qa repair`, `qa update`; [quickstart](docs/installation/quickstart.md); release workflow scaffold (pack on tag; publish gated off until ready).

## M10 — Behavioral evaluation and benchmarking (release gate)

**Goal:** measurable evidence that the platform performs well on real-world scenarios — the gate before a broad release.

Scope: implement the [evaluation framework](tests/evals/README.md) as a benchmarking harness that runs the skills against intentionally broken applications and measures root-cause accuracy, recommendation quality, generation quality, framework compatibility, regression detection, and performance/reliability; fixture apps and seeded repos per framework; baselines and release-gating on deterministic assertions; published results. This milestone turns "the platform works" into demonstrated, measured reliability.

## M10.5 — Architecture hardening and mechanical enforcement

**Goal:** convert architectural principles into mechanically enforced guarantees — no new features, no new frameworks.

**Shipped:** [ENGINEERING_PRINCIPLES.md](docs/architecture/ENGINEERING_PRINCIPLES.md); deterministic execution boundary; [ADR-0014](docs/architecture/ADR-0014-evaluation-platform.md); canonical [framework registry](shared/frameworks/registry.json); internal seam schemas + tests; architecture fitness / spec⇄code / release validators in CI; safety adversarial eval scenarios.

## Deferred beyond the current plan

Out of scope until the core is proven: mobile automation (Appium/Maestro), mutation testing, protocol-level load testing (k6), framework-migration assistants, contract-testing depth (Pact), and requirements-traceability exports. Each is tracked as a proposal and scheduled on demonstrated demand.

## Influencing this roadmap

Open a feature request or skill proposal issue — both templates ask for the evidence that helps prioritization. Roadmap changes are made by pull request to this file so that discussion happens in the open.
