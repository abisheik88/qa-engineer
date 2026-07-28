# Deterministic tooling invocation

How a skill runs the pack's deterministic tooling. One recipe, identical in every
skill that bundles an engine, so an agent never has to invent the glue.

**The rule this module exists to enforce:** deterministic code owns facts. If a
value could have been computed by a tool, the skill runs the tool and cites its
output. Hand-normalizing a reporter, hand-counting failures, or hand-classifying
an error message is a boundary violation, not a shortcut — see the pack's
*Deterministic Execution Boundary* architecture document.

## 1. One command shape, every platform

The engine is bundled inside the installed skill, and a launcher beside it
resolves its own location. There is nothing to set up and no shell features are
involved:

```bash
python3 <skill-dir>/scripts/qa_tool.py <tool> <subcommand> [args]
```

`<skill-dir>` is wherever the host installed this skill — usually
`.agents/skills/<skill>` or, for Claude Code, `.claude/skills/<skill>`. Use
whichever exists.

```bash
python3 .agents/skills/qa-run/scripts/qa_tool.py analysis junit test-results/results.xml
```

That line is identical in bash, zsh, PowerShell, and cmd.exe. **On Windows, use
`python` if `python3` is not on PATH** — that is the only platform difference.

An earlier version of this contract used a shell recipe
(`QA_LIB="$(ls -d … | head -1)"` with a `PYTHONPATH=` prefix). It was POSIX-only,
so on Windows every deterministic call failed, each skill fell back to its manual
path, and the user silently got guesswork while believing the tooling had run.
Never reintroduce a shell-dependent invocation.

If `qa_tool.py` is missing, the engine is not installed: say so, recommend
`qa repair`, use the skill's documented fallback, and mark the result degraded.

Every tool writes JSON to stdout. Exit `0` means success; exit `1` means an
invalid contract; exit `2` means unreadable input, a malformed artifact, or a
payload that failed its seam contract, and the JSON body carries `error` and
`detail`. Treat a non-zero exit as missing evidence, never as a value to guess.

Standard-library Python 3.8+ only — nothing to install.

## 2. Analysis core — `qa_tool.py analysis`

Framework-agnostic parsing, redaction, and validation.

| Subcommand | Invocation | Returns |
| --- | --- | --- |
| `junit` | `python3 <skill-dir>/scripts/qa_tool.py analysis junit <report.xml>` | `{tests: {...}, executed: [...]}` normalized counts and per-test outcomes |
| `har` | `python3 <skill-dir>/scripts/qa_tool.py analysis har <file.har> [--slow-ms N]` | Redacted request/response summary, failures, slow calls |
| `discover` | `python3 <skill-dir>/scripts/qa_tool.py analysis discover [--root DIR] [--path P]` | Artifacts found, by type, with presence flags |
| `diff-guard` | `python3 <skill-dir>/scripts/qa_tool.py analysis diff-guard <diff-file>` | `{issues: [...], safe: bool}` — `safe:false` blocks the change |
| `redact` | `python3 <skill-dir>/scripts/qa_tool.py analysis redact <file>` | The file's text with credentials masked |
| `validate` | `python3 <skill-dir>/scripts/qa_tool.py analysis validate <instance.json> <schema.json>` | `{valid: bool, errors: [...]}`; exit 1 when invalid |
| `classify` | `python3 <skill-dir>/scripts/qa_tool.py analysis classify "<error message>" [--http-status N]` | `{classification, confidence, reason}` from the shared taxonomy |
| `context` | `python3 <skill-dir>/scripts/qa_tool.py analysis context [--root DIR] [--path .qa/context.md]` | The parsed, schema-validated project context as JSON |

## 3. Diagnostic engine — `qa_tool.py diagnostics`

One engine, consumed by the diagnostic skills. Reasoning lives here once.

| Subcommand | Invocation | Returns |
| --- | --- | --- |
| `diagnose` | `python3 <skill-dir>/scripts/qa_tool.py diagnostics diagnose --execution-result <path> [--analysis-result <path>]` | `{entries: [...], timeline: [...], recommendations: [...]}` |
| `plan-repairs` | `python3 <skill-dir>/scripts/qa_tool.py diagnostics plan-repairs --diagnosis <path>` | `{plans: [...]}` — one plan per entry, escalations included |
| `summarize` | `python3 <skill-dir>/scripts/qa_tool.py diagnostics summarize --execution-result <path> --diagnosis <path>` | `{totals, byClassification, topPriority, releaseReadiness}` |
| `report` | `python3 <skill-dir>/scripts/qa_tool.py diagnostics report --execution-result <path> [--analysis-result <path>]` | `{diagnosis, plans, summary}` — all three in one call |

**Inputs.** `--execution-result` takes a `qa-run` execution result, or the minimal
subset (`tests` counts plus `executed[]` entries carrying `status`).
`--analysis-result` takes `{findings: [...]}` and is preferred over `executed[]`
when available. Both are validated against the internal seam contracts before
the engine runs, so a malformed payload fails loudly with `exit 2` instead of
producing a confident-looking diagnosis from nothing.

**Output.** Every diagnosis is validated against the internal diagnosis contract
before it is returned. The skill adds explanation, never new facts.

**The engine's shape is internal; the public contract is a projection of it.** Do
not copy an engine object wholesale into a contract field — the internal shape
carries more than the public contract accepts, and every public contract sets
`additionalProperties: false`, so a wholesale copy is rejected. Map the fields the
contract names:

| Contract field | Take from | Note |
| --- | --- | --- |
| `rootCause` | `entries[i].rootCause` | Exactly five keys: `classification`, `confidence`, `reason`, `ownership`, `recommendation`. The engine also returns per-cause `evidence` — that belongs in the envelope's `evidence[]`, not nested here. |
| `priority` | `entries[i].priority` | Copied as-is |
| `timeline` | `diagnosis.timeline` | Add `order` if absent |
| `evidence[]` | the artifacts and commands you actually ran | Include a `command` entry citing the invocation |
| `classification` | `entries[0].rootCause.classification` | The envelope mirrors the top cause |

This mapping is not busywork: the strictness is what stops a skill from shipping a
result whose shape nobody checked. Validate before completion —
`python3 <skill-dir>/scripts/qa_tool.py analysis validate <result.json> <schema.json>` — and fix the
result, never the claim.

## 4. Framework adapters

Framework-specific artifact shapes stay in the adapter. The core CLI never takes
a `--framework` flag.

| Adapter | Invocation | Returns |
| --- | --- | --- |
| Playwright report | `python3 <skill-dir>/scripts/qa_tool.py playwright report <results.json>` | The same `{tests, executed}` shape as `junit` |
| Playwright trace | `python3 <skill-dir>/scripts/qa_tool.py playwright trace <trace.zip>` | Actions, console/network counts, errors, classification |

For Selenium, Cypress, and WebdriverIO, normalize through
`qa_tool.py analysis junit` — those adapters have no richer artifact than JUnit, and
the skill says so rather than implying trace-grade depth.

## 5. Reporting what ran

Cite the invocation in `evidence[]`: the command, the file it read, and the field
that carried the fact. A skill that reports a fact no tool produced has violated
its own contract, and the adversarial evaluation cases exist to catch it.

When a tool is unavailable, the skill's documented fallback applies — and the
result must state that it is degraded, name what was missing, and lower
confidence accordingly. Silence about a missing tool is the failure mode; an
honest "I could not run the trace analyzer" is not.
