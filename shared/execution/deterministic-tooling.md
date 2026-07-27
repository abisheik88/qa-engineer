# Deterministic tooling invocation

How a skill runs the pack's deterministic tooling. One recipe, identical in every
skill that bundles an engine, so an agent never has to invent the glue.

**The rule this module exists to enforce:** deterministic code owns facts. If a
value could have been computed by a tool, the skill runs the tool and cites its
output. Hand-normalizing a reporter, hand-counting failures, or hand-classifying
an error message is a boundary violation, not a shortcut — see the pack's
*Deterministic Execution Boundary* architecture document.

## 1. Locate the bundled library

The engine is bundled inside the installed skill, at `scripts/lib/`. The skill
lives under whichever discovery path the host agent uses, so resolve it once and
reuse it:

```bash
QA_LIB="$(ls -d .agents/skills/<skill>/scripts/lib .claude/skills/<skill>/scripts/lib 2>/dev/null | head -1)"
```

Replace `<skill>` with the running skill's name (`qa-debug`, `qa-run`, …). If
`QA_LIB` is empty the engine is not installed: say so, recommend
`qa repair`, use the skill's documented fallback, and mark the result degraded.

Every invocation below is then:

```bash
PYTHONPATH="$QA_LIB" python3 -m <module> <subcommand> [args]
```

Standard-library Python 3.8+ only — nothing to install. Every tool writes JSON to
stdout. Exit `0` means success; exit `2` means unreadable input, malformed JSON,
or a payload that failed its contract, and the JSON body carries `error` and
`detail`. Treat a non-zero exit as missing evidence, never as a value to guess.

## 2. Analysis core — `qa_analysis.cli`

Framework-agnostic parsing, redaction, and validation.

| Subcommand | Invocation | Returns |
| --- | --- | --- |
| `junit` | `python3 -m qa_analysis.cli junit <report.xml>` | `{tests: {...}, executed: [...]}` normalized counts and per-test outcomes |
| `har` | `python3 -m qa_analysis.cli har <file.har> [--slow-ms N]` | Redacted request/response summary, failures, slow calls |
| `discover` | `python3 -m qa_analysis.cli discover [--root DIR] [--path P]` | Artifacts found, by type, with presence flags |
| `diff-guard` | `python3 -m qa_analysis.cli diff-guard <diff-file>` | `{issues: [...], safe: bool}` — `safe:false` blocks the change |
| `redact` | `python3 -m qa_analysis.cli redact <file>` | The file's text with credentials masked |
| `validate` | `python3 -m qa_analysis.cli validate <instance.json> <schema.json>` | `{valid: bool, errors: [...]}`; exit 1 when invalid |
| `classify` | `python3 -m qa_analysis.cli classify "<error message>" [--http-status N]` | `{classification, confidence, reason}` from the shared taxonomy |
| `context` | `python3 -m qa_analysis.cli context [--root DIR] [--path .qa/context.md]` | The parsed, schema-validated project context as JSON |

## 3. Diagnostic engine — `qa_diagnostics.cli`

One engine, consumed by the diagnostic skills. Reasoning lives here once.

| Subcommand | Invocation | Returns |
| --- | --- | --- |
| `diagnose` | `python3 -m qa_diagnostics.cli diagnose --execution-result <path> [--analysis-result <path>]` | `{entries: [...], timeline: [...], recommendations: [...]}` |
| `plan-repairs` | `python3 -m qa_diagnostics.cli plan-repairs --diagnosis <path>` | `{plans: [...]}` — one plan per entry, escalations included |
| `summarize` | `python3 -m qa_diagnostics.cli summarize --execution-result <path> --diagnosis <path>` | `{totals, byClassification, topPriority, releaseReadiness}` |
| `report` | `python3 -m qa_diagnostics.cli report --execution-result <path> [--analysis-result <path>]` | `{diagnosis, plans, summary}` — all three in one call |

**Inputs.** `--execution-result` takes a `qa-run` execution result, or the minimal
subset (`tests` counts plus `executed[]` entries carrying `status`).
`--analysis-result` takes `{findings: [...]}` and is preferred over `executed[]`
when available. Both are validated against the internal seam contracts before
the engine runs, so a malformed payload fails loudly with `exit 2` instead of
producing a confident-looking diagnosis from nothing.

**Output.** Every diagnosis is validated against the internal diagnosis contract
before it is returned. What the engine returns is what the skill presents; the
skill adds explanation, never new facts.

## 4. Framework adapters

Framework-specific artifact shapes stay in the adapter. The core CLI never takes
a `--framework` flag.

| Adapter | Invocation | Returns |
| --- | --- | --- |
| Playwright report | `python3 -m playwright_analysis report <results.json>` | The same `{tests, executed}` shape as `junit` |
| Playwright trace | `python3 -m playwright_analysis trace <trace.zip>` | Actions, console/network counts, errors, classification |

For Selenium, Cypress, and WebdriverIO, normalize through
`qa_analysis.cli junit` — those adapters have no richer artifact than JUnit, and
the skill says so rather than implying trace-grade depth.

## 5. Reporting what ran

Cite the invocation in `evidence[]`: the command, the file it read, and the field
that carried the fact. A skill that reports a fact no tool produced has violated
its own contract, and the adversarial evaluation cases exist to catch it.

When a tool is unavailable, the skill's documented fallback applies — and the
result must state that it is degraded, name what was missing, and lower
confidence accordingly. Silence about a missing tool is the failure mode; an
honest "I could not run the trace analyzer" is not.
