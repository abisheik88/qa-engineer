# QA Fix

Turns a diagnosis into a safe, concrete repair **plan** — never applied code. It consumes a debug result, decides whether the cause is a test-side repair, describes the change, and states the risk, the permission it needs, a rollback path, and the diff-guard review. It edits nothing.

## Invocation

```text
/qa-fix apply the fix for the cart locator break
```

The skill reads the debug diagnosis, confirms the cause is test-side, and produces a repair plan: what to change, which files, at what risk, awaiting your approval. A product bug or network failure comes back as an escalation, not a repair.

## Details

- Skill definition: [SKILL.md](SKILL.md)
- Output contract: [contracts/fix-result.schema.json](contracts/fix-result.schema.json)
- Worked example: [repair-plan](examples/repair-plan.md)

The repair reasoning is the shared [diagnostic engine](../../shared/diagnostics/README.md)'s repair planner; the safety rail is the analysis platform's [diff guard](../../shared/analysis/README.md). The design is recorded in [ADR-0011](../../docs/architecture/ADR-0011-diagnostic-platform.md).
