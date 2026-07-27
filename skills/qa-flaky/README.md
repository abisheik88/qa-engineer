# QA Flaky

Identifies flaky tests and explains their nondeterminism — weighing timing, races, isolation, environment, and data, quantifying the instability where run history allows, and proposing mitigations. It never quarantines anything automatically.

## Invocation

```text
/qa-flaky the login test fails about one run in five
```

The skill gathers run history, computes a flake rate where it can, ranks the likely causes with evidence, and proposes fixes that remove the flakiness — recommending quarantine only as a tracked action with an owner.

## Details

- Skill definition: [SKILL.md](SKILL.md)
- Output contract: [contracts/flaky-result.schema.json](contracts/flaky-result.schema.json)
- Worked example: [examples/flaky-locator.md](examples/flaky-locator.md)

It reuses the [diagnostic engine](../../shared/diagnostics/README.md)'s flaky classification and the [flakiness knowledge](../../shared/domains/flakiness.md); the design is recorded in [ADR-0011](../../docs/architecture/ADR-0011-diagnostic-platform.md).
