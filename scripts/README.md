# scripts/

Repository maintenance tooling — zero-dependency Node.js (18+), run directly with `node`, never shipped to users. QA analyzer scripts are a different thing entirely: they live inside the skill that owns them (`skills/<name>/scripts/`, Milestone 3), per [ADR-0001](../docs/architecture/ADR-0001-repository-structure.md).

## Tools

| Tool | Purpose | CI |
| --- | --- | --- |
| `validate-skills.mjs` | Enforces the [skill specification](../docs/skills/skill-specification.md) and [anatomy](../docs/skills/skill-anatomy.md) on every skill | Every pull request, blocking |
| `sync-shared.mjs` | Materializes [shared/](../shared/README.md) modules into skills as marker-owned copies; `--check` fails on drift | Every pull request, blocking |
| `check-keywords.mjs` | Reports activation-keyword collisions between skill descriptions | Every pull request, advisory |
| `check-knowledge.mjs` | Lints domain knowledge documents | Every pull request, blocking |
| `check-capability-matrix.mjs` | Capability matrix ↔ framework matrix ↔ adapters ↔ skills | Every pull request, blocking |
| `check-framework-registry.mjs` | Canonical [framework registry](../shared/frameworks/registry.json) vs docs/detectors | Every pull request, blocking |
| `check-architecture-fitness.mjs` | Architecture invariants, eval coverage, constitution docs | Every pull request, blocking |
| `check-spec-code-sync.mjs` | Spec ⇄ code envelope and boundary consistency | Every pull request, blocking |
| `release/validate-release.mjs` | Version/package identity/changelog checks (no publish) | Every pull request, blocking |
| `bundle_python.py` | Bundle self-containment for diagnostic skills | Every pull request, blocking |

## Usage

```bash
node scripts/validate-skills.mjs                  # errors exit 1; warnings don't
node scripts/sync-shared.mjs --check              # verify synced copies match sources
node scripts/sync-shared.mjs --write              # refresh copies after editing shared/
node scripts/sync-shared.mjs --add <shared-file> <skill-dir>   # start syncing a module into a skill
node scripts/check-keywords.mjs                   # advisory; --strict exits 1 on collisions
```

## Reading validator output

Every line names the file and the rule; every rule traces to a numbered requirement in the specification or anatomy documents. `ERROR` blocks merge; `WARNING` is judgment the author is expected to have exercised — resolve it or be ready to defend it in review. In GitHub Actions the same findings appear as inline annotations.

If a message does not make the fix obvious, that is a tooling defect — file a bug quoting the output.

## Maintaining these tools

- Zero dependencies is a rule, not a preference: these scripts run on contributor machines via bare `node` and must never require an install step.
- `lib/skills.mjs` holds the shared frontmatter parser. It parses the *restricted* YAML subset the specification allows — if a skill needs more YAML than the parser accepts, the skill is wrong, not the parser.
- A new specification rule and its validator check land in the same pull request; the validator is the specification's executable half.
- Planned additions: release helpers (changelog assembly, tag consistency) arrive with the installer in Milestone 4.
