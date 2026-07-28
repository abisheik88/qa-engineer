# Report format

How to consume what the pack produces. Written for someone building on the
artifacts — a CI reporter, a dashboard, a bot — rather than for someone authoring a
skill. If you are authoring, read
[output-contracts.md](skills/output-contracts.md) instead; it is the normative
standard, and this document is the consumer's view of it.

## Two kinds of output

| Output | Where | Stable? | Branded? |
| --- | --- | --- | --- |
| **Artifacts** — JSON, schema-validated | `qa-artifacts/*.json` | Yes, versioned | Never |
| **Renderings** — Markdown, HTML, PDF | wherever the skill or you put them | No | Attribution footer |

**Build on artifacts, not renderings.** An artifact is an interface with a version
and additive-only evolution rules. A rendering is prose for a human and may change
freely.

## The envelope

Every artifact carries the same six required fields, whichever skill produced it:

```json
{
  "contract":   { "name": "qa-run/execution-result", "version": "1.0.0" },
  "skill":      { "name": "qa-run", "version": "0.2.0" },
  "generatedAt": "2026-07-27T17:38:00Z",
  "summary":    "Smoke run on Playwright/Chromium (headless): 2 passed, 0 failed, 0 skipped.",
  "classification": "passed",
  "evidence":   [ { "type": "command", "description": "Runner exited zero", "source": "exit code 0" } ]
}
```

| Field | Meaning for a consumer |
| --- | --- |
| `contract.name` | Which contract this is. Dispatch on it. |
| `contract.version` | SemVer. Check the **major** before relying on a field. |
| `skill.version` | Which skill produced it. Informational; do not branch on it. |
| `generatedAt` | RFC 3339 UTC. |
| `summary` | One human-readable paragraph. Safe to display, never to parse. |
| `classification` | **The decision.** A closed enum per contract; every value implies a different action. |
| `evidence[]` | Why the classification holds. At least one entry, always. |
| `confidence` | Optional, `0`–`1`. Present when the skill weighed alternatives; absent rather than invented. |

### Evidence entries

```json
{ "type": "report", "description": "Playwright JSON reporter, normalized",
  "source": "test-results/results.json", "excerpt": "{\"expected\": 2, \"unexpected\": 0}" }
```

`type` is a per-contract enum (`report`, `command`, `junit`, `trace`, `har`,
`console`, `network`, `file`, `diff`, …). `source` is where the observation came
from — a path, a command, an exit code. `excerpt` is optional and **already
redacted**: credentials are masked as the evidence is captured, not before display.

## The contracts

| Contract | Produced by | `classification` values |
| --- | --- | --- |
| `qa-run/execution-result` | `/qa-run` | `passed` · `failed` · `errored` · `no-tests-run` · `blocked` |
| `qa-debug/debug-result` | `/qa-debug` | `locator-failure` · `assertion-failure` · `timeout` · `network` · `authentication` · `authorization` · `environment` · `configuration` · `infrastructure` · `test-data` · `application-bug` · `framework-failure` · `flaky` · `unknown` |
| `qa-fix/fix-result` | `/qa-fix` | `repairable` · `not-repairable` · `needs-investigation` · `blocked` |
| `qa-report/report-result` | `/qa-report` | `ready` · `ready-with-risks` · `not-ready` · `insufficient-data` |
| `qa-review/review-result` | `/qa-review` | quality verdict |
| `qa-flaky/flaky-result` | `/qa-flaky` | flakiness verdict |
| `qa-api/api-result` | `/qa-api` | API assessment |
| `qa-audit/audit-result` | `/qa-audit` | audit outcome |
| `qa-explore/explore-result` | `/qa-explore` | exploration outcome |
| `qa-generate/generation-result` | `/qa-generate` | generation outcome |

Schemas live beside their producer: `skills/<skill>/contracts/<name>.schema.json`.

Two commands produce no artifact of their own: `/qa` is a router, and `/qa-init`
writes `.qa/context.md`, governed by
[`context.schema.json`](../shared/analysis/schemas/context.schema.json).

## Distinctions worth handling correctly

**`errored` is not a softer `failed`.** It means the outcome could not be
established — a missing or unparseable reporter, or a disagreement between the exit
code and the reporter. Treat it as *unknown*, not as a failure count of zero.

**`unknown` and `insufficient-data` are real answers.** A skill that cannot
determine something says so. A consumer that maps them to "pass" defeats the point
of the pack.

**`flaky` is not `passed`.** A test that passed only on retry is reported as flaky.

## Invariants you can rely on

The schemas enforce cross-field rules, so these hold for any artifact that
validates. This is what makes the artifacts safe to build a gate on:

| Contract | Guaranteed |
| --- | --- |
| `execution-result` | `classification: "passed"` ⇒ `execution.exitCode === 0` **and** `tests.failed === 0` |
| `execution-result` | `classification: "failed"` ⇒ `tests.failed >= 1` |
| `execution-result` | `classification: "no-tests-run"` ⇒ `tests.total === 0` |
| `report-result` | `classification: "ready"` ⇒ `testSummary.failed === 0` and `releaseReadiness.verdict === "ready"` |
| `fix-result` | `diffGuardReview.status === "fail"` ⇒ classification is **not** `repairable` |

A result that violates one of these is invalid, not merely suspicious. If you
receive one, the producer skipped its own validation step — treat the artifact as
untrusted.

## Validating an artifact yourself

The bundled validator, no dependencies:

```bash
QA_LIB="$(ls -d .agents/skills/qa-run/scripts/lib .claude/skills/qa-run/scripts/lib 2>/dev/null | head -1)"
PYTHONPATH="$QA_LIB" python3 -m qa_analysis.cli validate \
  qa-artifacts/execution-result.json \
  .agents/skills/qa-run/contracts/execution-result.schema.json
```

Exit `0` and `{"valid": true, "errors": []}` when it holds; exit `1` with the list
of violations when it does not.

Any JSON Schema 2020-12 validator also works. The schemas use a deliberately small
keyword subset — `type`, `properties`, `required`, `additionalProperties`, `enum`,
`const`, `pattern`, `format`, `minimum`/`maximum`, `minItems`/`maxItems`,
`minLength`/`maxLength`, `items`, `allOf`, `if`/`then`/`else` — with no `$ref`, so
each schema is self-contained and portable.

## Compatibility rules

`contract.version` is SemVer, and evolution is additive within a major
([ADR-0003](architecture/ADR-0003-versioning-strategy.md)):

| Change | Version impact |
| --- | --- |
| New optional field, or a new enum value | MINOR |
| Field removed or renamed, type changed, enum value removed, optional made required | MAJOR |
| Description or annotation only | PATCH |

As a consumer: **tolerate unknown fields**, check the major before relying on a
field, and treat an unrecognized enum value as unknown rather than as an error. A
consumer that rejects additions will break on the next minor release.

## Reading a rendering instead

Human renderings — Markdown, HTML, PDF — carry the same content plus an attribution
footer, and are not versioned. Two rules:

- Do not parse them. The artifact is the interface.
- The footer appears only on renderings. If you find one inside a `.json` file,
  something has appended prose to an interface; that is a bug worth reporting.

The footer's wording comes from one metadata file and can be rendered directly:

```bash
PYTHONPATH="$QA_LIB" python3 -m qa_analysis.cli branding --format html
```
