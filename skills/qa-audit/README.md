# QA Audit

Audits a page's accessibility, performance, client-side security, and visual stability against the pack's quality knowledge, returning prioritized, evidenced issues with remediation — and honest about what automation can and cannot verify. Recommendations only.

## Invocation

```text
/qa-audit run an accessibility audit of the checkout page
```

The skill scopes the audit type and page, gathers the available evidence (an axe scan, a redacted HAR, a trace), applies the domain's best-practice checks, and returns issues ranked by severity with remediation — flagging the areas that still need a human check.

## Details

- Skill definition: [SKILL.md](SKILL.md)
- Output contract: [contracts/audit-result.schema.json](contracts/audit-result.schema.json)
- Worked example: [examples/accessibility-audit.md](examples/accessibility-audit.md)

It draws on the [accessibility](../../shared/domains/accessibility.md), [performance](../../shared/domains/performance.md), [security](../../shared/domains/security.md), and [visual-testing](../../shared/domains/visual-testing.md) knowledge; the design is recorded in [ADR-0012](../../docs/architecture/ADR-0012-knowledge-base.md).
