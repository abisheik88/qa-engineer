# QA Debug

Investigates a failed test and explains *why* it broke — not by summarizing logs, but by classifying the root cause from evidence, reconstructing what happened, and saying who should act. It reads the results the other skills produce and presents a diagnosis; it proposes no code changes.

## Invocation

```text
/qa-debug the checkout spec failed in the last run
```

The skill gathers the execution and analysis results, runs the deterministic diagnostic engine, and reports the root cause with its evidence, a timeline, severity and owner, and the recommended next step — pointing to `/qa-fix` when the cause is test-side.

## Details

- Skill definition: [SKILL.md](SKILL.md)
- Output contract: [contracts/debug-result.schema.json](contracts/debug-result.schema.json)
- Worked examples: [successful-debug](examples/successful-debug.md), [failed-login](examples/failed-login.md), [locator-break](examples/locator-break.md), [network-timeout](examples/network-timeout.md)

The reasoning is the shared [diagnostic engine](../../shared/diagnostics/README.md); this skill is its investigation front end. The design is recorded in [ADR-0011](../../docs/architecture/ADR-0011-diagnostic-platform.md).
