# skills/

The pack's canonical Agent Skills. Each directory is a complete skill in the exact form defined by the [Agent Skills specification](https://agentskills.io/specification) and this project's [skill standard](../docs/skills/skill-specification.md) — runtime-valid exactly as committed, installed into agents byte-for-byte ([ADR-0002](../docs/architecture/ADR-0002-agent-skill-standard.md)).

## Current contents

| Skill | Purpose |
| --- | --- |
| [qa/](qa/README.md) | Router: the public entry point; classifies intent and dispatches by name |
| [qa-init/](qa-init/README.md) | Analyzes a repository and writes its profile to `.qa/context.md` |
| [qa-run/](qa-run/README.md) | Execution engine: plans and **executes** test runs (Playwright), emitting a normalized result |
| [qa-generate/](qa-generate/README.md) | Generation engine: bootstraps a new framework or **extends** an existing suite (Playwright), non-destructively |
| [qa-debug/](qa-debug/README.md) | Investigates a failure into an evidence-backed root cause, timeline, priority, and owner |
| [qa-fix/](qa-fix/README.md) | Turns a diagnosis into a safe repair **plan** (never code), gated by the diff guard |
| [qa-report/](qa-report/README.md) | Aggregates results into summaries and a release-readiness verdict (Markdown, HTML-ready, JSON) |
| [qa-review/](qa-review/README.md) | Reviews a test codebase's quality and scores it against the knowledge base |
| [qa-flaky/](qa-flaky/README.md) | Identifies flaky tests, quantifies instability, and proposes mitigations |
| [qa-api/](qa-api/README.md) | Assesses API tests for REST, GraphQL, and WebSocket |
| [qa-audit/](qa-audit/README.md) | Audits a view for accessibility, performance, security, and visual stability |
| [qa-explore/](qa-explore/README.md) | Full-spectrum product QA on a live URL with evidence-backed findings |
| [qa-example/](qa-example/README.md) | Reference implementation of the skill format; installation self-check. The living example every new skill copies from |

The twelve user-facing commands are now all implemented: `qa` (router), `qa-init`, `qa-run`, `qa-generate`, `qa-debug`, `qa-fix`, `qa-report`, `qa-review`, `qa-flaky`, `qa-api`, `qa-audit`, and `qa-explore`, plus the `qa-example` reference skill. Framework expertise and QA judgment are not commands — they live in [shared/frameworks/](../shared/frameworks/README.md) and the [knowledge base](../shared/domains/README.md), loaded by the skills that need them.

## Rules that govern this directory

- Every skill follows the canonical layout ([skill-anatomy.md](../docs/skills/skill-anatomy.md)) and the `SKILL.md` standard — enforced on every pull request by `node scripts/validate-skills.mjs`.
- Files carrying a `synced-from` marker are copies owned by the [shared knowledge engine](../shared/README.md); edit the source, never the copy.
- The user-facing surface is 12 commands with a hard description budget; additions go through the proposal process described in the [authoring guide](../docs/skills/authoring-guide.md) and require an RFC ([RFC-0001](../docs/rfcs/RFC-0001-qa-explore.md) for `qa-explore`).

New skill? Start at the [authoring guide](../docs/skills/authoring-guide.md); scaffold with `cp -r templates/skill-template skills/qa-<name>`.
