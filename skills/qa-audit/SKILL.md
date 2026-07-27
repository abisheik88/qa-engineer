---
name: qa-audit
description: >-
  Audits a rendered view's accessibility, performance, client-side
  security, and visual stability. Applies best-practice checks and
  returns issues ranked by impact with remediation guidance. Use when
  auditing a view's accessibility, performance, security, or visual
  stability.
license: MIT
metadata:
  version: "0.1.0"
  maturity: beta
  audience: user
---

# QA Audit

## Purpose

Audit a page against the pack's quality knowledge in four dimensions — accessibility, performance, client-side security, and visual stability — and return prioritized, evidenced issues with remediation. This skill reports findings; it changes nothing and is honest about the limits of automated auditing.

Do not use it to run functional tests (`/qa-run`) or review test code (`/qa-review`). It audits an application surface, not a test suite. Pick one or more of the four audit types per run.

## Inputs

- The user's request, which follows in the conversation: the page or view, and which audit type(s) to run.
- Where available, captured evidence: a HAR (for performance and security headers), a rendered snapshot, or a performance trace — analyzed with redaction by the bundled analyzer.
- `.qa/context.md` for framework and environment.

## Context loading

| When | Load |
| --- | --- |
| Auditing accessibility | [references/accessibility.md](references/accessibility.md) |
| Auditing performance | [references/performance.md](references/performance.md) |
| Auditing client-side security | [references/security.md](references/security.md) |
| Auditing visual stability | [references/visual-testing.md](references/visual-testing.md) |
| Shaping the report | [references/evidence-and-reporting.md](references/evidence-and-reporting.md) |

## Procedure

1. **Scope.** Determine the audit type(s) and the page from the request.
2. **Gather evidence.** Use the available signals — an axe-style scan's output, a HAR for headers and timings (redacted by the bundled analyzer), a performance trace, a snapshot.
3. **Apply best-practice checks** for each type against its domain: WCAG rules for accessibility, Core Web Vitals against budgets for performance, headers and cookie flags for security, stabilization and masking for visual.
4. **Rank and remediate.** Record each issue with a severity, the evidence, and a specific remediation; flag the areas that need a manual check (accessibility especially) rather than implying full coverage.
5. **Report.** Emit the audit result and present the findings. Recommend only.

## Guardrails

- **Recommendations only.** This skill audits and advises; it changes no application or test code.
- **Be honest about coverage.** Automated accessibility catches a fraction of WCAG; an automated security scan finds hygiene, not exploits. State the manual-check gaps; never imply an automated pass means "accessible" or "secure".
- **Gate on regression where absolute numbers mislead** (performance, visual) — compare to a baseline, and report the conditions.
- **Redact evidence.** HARs and logs are analyzed through the redacting analyzer; no secret appears in a finding.

## Tooling

Resolve the bundled library once, then invoke as documented in [references/deterministic-tooling.md](references/deterministic-tooling.md):

```bash
QA_LIB="$(ls -d .agents/skills/qa-audit/scripts/lib .claude/skills/qa-audit/scripts/lib 2>/dev/null | head -1)"
```

| Tool | Invocation | Output | Fallback |
| --- | --- | --- | --- |
| HAR analyzer | `PYTHONPATH="$QA_LIB" python3 -m qa_analysis.cli har <file.har> [--slow-ms N]` | Redacted headers and timings for performance and security checks | Audit from other available signals and note the gap |
| Artifact discovery | `PYTHONPATH="$QA_LIB" python3 -m qa_analysis.cli discover --root <dir>` | Which audit inputs exist, by type, with presence flags | Ask for artifact paths rather than assuming any |
| Redaction | `PYTHONPATH="$QA_LIB" python3 -m qa_analysis.cli redact <file>` | The file's text with credentials masked, before anything is quoted | Do not quote captured headers at all |

Empty `QA_LIB` means the engine is not installed: say so, recommend `qa repair`, and mark the audit degraded. Live in-page scans (axe, Lighthouse) run through the project's browser tooling and are consumed as evidence; findings from a scan that did not run are never inferred.

## Output

An audit result under `qa-artifacts/`, conforming to [contracts/audit-result.schema.json](contracts/audit-result.schema.json): the overall outcome, the audit type(s) run, issues ranked by severity with evidence and remediation (and a manual-check flag where relevant), and recommendations. Validate against the schema before completion, and present the audit in prose.
