# QA Report

Rolls up a run into a shareable report: an executive verdict on shippability, an engineering breakdown of what broke and who owns it, and the test, failure, coverage, and risk detail — in Markdown, an HTML-ready structure, and JSON. It aggregates the diagnoses the other skills produced; it does not re-diagnose.

## Invocation

```text
/qa-report summarize the nightly run and tell me if we can ship
```

The skill aggregates the execution and debug results, computes a deterministic release-readiness verdict, and presents an executive summary, an engineering breakdown, and the supporting detail — the same content in three formats.

## Details

- Skill definition: [SKILL.md](SKILL.md)
- Output contract: [contracts/report-result.schema.json](contracts/report-result.schema.json)
- Worked example: [release-report](examples/release-report.md)

The aggregation and the release-readiness rule are the shared [diagnostic engine](../../shared/diagnostics/README.md)'s summarize step. The design is recorded in [ADR-0011](../../docs/architecture/ADR-0011-diagnostic-platform.md).
