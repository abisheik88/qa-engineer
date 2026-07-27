# shared/ — The Shared Knowledge Engine

Single-source QA knowledge, written once here and materialized into every skill that needs it. The engine exists to keep one promise: **a best-practice change is a one-file edit**, no matter how many skills depend on it — while every installed skill stays fully self-contained.

The engine (sections, module format, sync mechanism) was established in Milestone 2; the catalog is filled as the skills that need it are built. The [execution platform](execution/README.md) arrived in Milestone 4, the [generation platform](generation/README.md) in Milestone 5, and the [analysis platform](analysis/README.md) in Milestone 6, each with its Playwright and (for analysis) Selenium support under [frameworks/](frameworks/README.md).

Most sections are knowledge (Markdown synced into skills). The [analysis](analysis/README.md) and [diagnostics](diagnostics/README.md) platforms additionally carry tested Python code (`analysis/lib/`, `diagnostics/lib/`), because deterministic parsing, classification, and reasoning must be code, not prompts.

## Sections

| Section | Owns | Loaded when |
| --- | --- | --- |
| [execution/](execution/README.md) | The framework-agnostic execution platform: strategy, command building, browser lifecycle, artifacts, normalization | An execution skill runs tests |
| [generation/](generation/README.md) | The framework-agnostic generation platform: repository analysis, mode and strategy, bootstrap and extension, templates, style and naming | A generation skill creates or extends automation |
| [analysis/](analysis/README.md) | The framework-agnostic analysis platform (knowledge + Python code): discovery, validation, evidence model, failure taxonomy, confidence, redaction, contract validation, diff guard | A diagnostic skill analyzes artifacts |
| [diagnostics/](diagnostics/README.md) | The shared diagnostic engine (knowledge + Python code): root-cause analysis, timeline, prioritization, recommendation ranking, repair planning, report aggregation | qa-debug, qa-fix, or qa-report reasons about a failure |
| [domains/](domains/README.md) | The QA engineering knowledge base — locators, waiting, assertions, page objects, fixtures, test data, flakiness, retry, auth, REST/GraphQL/WebSocket, accessibility, performance, security, visual, anti-patterns, and more | A skill's task touches the domain |
| [frameworks/](frameworks/README.md) | Framework-specific execution, generation, and analysis adapters: Playwright, Selenium, Cypress, and WebdriverIO (all built) | The project profile detects the framework |

Modules are **not skills**: no frontmatter, no activation, no context cost until a skill loads them. They are plain Markdown files whose format is defined by [templates/knowledge-module-template.md](../templates/knowledge-module-template.md).

## How sync works

Skills cannot reference `shared/` at runtime — installed skills must be self-contained, and cross-skill paths are banned ([ADR-0002](../docs/architecture/ADR-0002-agent-skill-standard.md)). So modules are **copied** into each consuming skill's `references/` directory, and the copy carries a provenance marker as its first line:

```text
<!-- synced-from: shared/domains/example-domain.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
```

The marker is the entire mechanism — provenance, warning, and sync manifest in one line:

- `node scripts/sync-shared.mjs --write` finds every marked file and refreshes it from its source.
- `node scripts/sync-shared.mjs --check` fails if any copy differs from its source — CI runs this on every pull request, so hand-edited copies and stale syncs cannot merge.
- **Adding a module to a skill** is a one-time copy with the marker; from then on, sync owns the file:

```bash
node scripts/sync-shared.mjs --add shared/domains/example-domain.md skills/qa-example
```

## Ownership rules

1. If two skills could plausibly need it, it lives here — not in either skill's local references.
2. If only one skill will ever need it, it lives in that skill — this directory is not a dumping ground.
3. The source is edited; copies never are. Commit source and refreshed copies together.
4. A module speaks with the pack's voice: normative, evidenced, and current, per the [documentation standards](../docs/contributing/documentation-standards.md). Module content is what agents will quote to users — it is held to skill-level review via the [quality checklists](../docs/skills/quality-checklists.md).

## Naming

Module files are kebab-case nouns describing the knowledge, not the consumer: `locator-strategy.md`, never `qa-fix-helpers.md`. A module named after a skill is a design smell — it belongs in that skill's local references instead.
