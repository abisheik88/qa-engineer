# Output Contracts

The machine-readable report standard. Contracts are what turn skill output from prose into an interface: CI can gate on them, skills can consume each other's results through them, and a claim without a conforming report is treated as no claim at all. Contract compatibility is the pack's versioning surface ([ADR-0003](../architecture/ADR-0003-versioning-strategy.md)).

## When a skill needs a contract

A skill needs a contract when its result is a *finding* — a classification, a set of defects, a statistic — that a human decision or another skill depends on. A skill whose output is code or prose alone (a generated test, a review comment) does not emit a report and has no `contracts/` directory.

## The report envelope

Every report shares one envelope; per-skill contracts extend it. Reports are written to `qa-artifacts/<skill>-<run-id>.json` in the consumer's repository.

```json
{
  "contract": { "name": "qa-example/self-check-report", "version": "1.0.0" },
  "skill": { "name": "qa-example", "version": "0.1.0" },
  "generatedAt": "2026-07-18T09:30:00Z",
  "summary": "One-paragraph human-readable summary of the finding.",
  "classification": "pass",
  "confidence": 0.95,
  "evidence": [
    {
      "type": "command",
      "description": "What this evidence shows and why it supports the classification",
      "source": "the command executed, file examined, or artifact path",
      "excerpt": "the relevant output, quoted verbatim and redacted"
    }
  ],
  "recommendations": [
    {
      "action": "What to do next, imperative and specific",
      "priority": "high",
      "command": "/qa-fix"
    }
  ],
  "metadata": {}
}
```

### Required fields

| Field | Rules |
| --- | --- |
| `contract.name`, `contract.version` | Which schema this report claims to satisfy; version is the schema's semver |
| `skill.name`, `skill.version` | Producer identity — what makes vendored, stale reports diagnosable |
| `generatedAt` | ISO 8601 UTC timestamp |
| `summary` | Human-readable; must stand alone without the structured fields |
| `classification` | The finding, from the closed enum the per-skill contract defines |
| `evidence` | At least one entry. **A report with an empty evidence array is invalid by design** — this is the schema-level enforcement of "evidence or it didn't happen" |

### Optional fields

| Field | Rules |
| --- | --- |
| `confidence` | 0.0–1.0. Include when the skill weighed alternatives; omit rather than fabricate. Calibration guidance: 0.9+ means direct evidence, 0.6–0.9 means strong inference, below 0.6 means the report should say what would raise it |
| `recommendations` | Ordered by priority (`high`, `medium`, `low`); `command` names a pack command when one is the natural next step |
| `metadata` | Open string-keyed extension point — the only place producers may add unschematized data |

### Evidence entries

`type` is a closed enum per contract, drawn from: `command` (executed command and output), `file` (repository content), `network`, `console`, `trace`, `log`, `diff`. Every entry needs `description` and `source`; `excerpt` is strongly recommended and must be verbatim and redacted — evidence is where credentials would leak, and the [security policy](../../SECURITY.md) applies in full.

## Classifications

Each contract defines its own closed enum, chosen so that every value implies a different next action. The canonical example (the failure taxonomy `qa-debug` will use): `product-bug` → file a bug, do not touch the test; `test-bug` → repair the test; `env-issue` → fix the environment; `flake` → quantify and quarantine; `infra` → escalate to CI owners. If two values would lead to the same action, merge them.

## JSON Schema strategy

- **Dialect:** JSON Schema draft 2020-12.
- **Location:** `skills/<name>/contracts/<contract-name>.schema.json` — contracts live with their producer and ship with it ([skill-anatomy.md](skill-anatomy.md)).
- **Identity:** `$id` is `urn:qa-pack:contract:<skill>:<contract-name>:<major>` — stable across minor revisions, new URN on major.
- **Strictness:** `additionalProperties: false` everywhere except `metadata`. Unknown fields are contract violations, not extensions; extensions go in `metadata` until a schema revision admits them properly.
- **One file per contract, self-contained.** The envelope is defined by this document and repeated in each schema rather than `$ref`-ing a shared file — schemas must survive being copied around alone, and cross-skill paths are banned. The validator (below) checks that each schema's envelope portion matches the standard, so the duplication cannot drift silently.

### Supported keyword subset

The pack validates contracts with two dependency-free validators — Python
([`the contract validator`](../../packages/engine/lib/analysis/contracts.mjs)) for
output contracts, JavaScript
([`schema-validate.mjs`](../../packages/engine/lib/analysis/contracts.mjs)) for
installer config. Both implement exactly this subset, and nothing else:

`$id`, `$schema`, `additionalProperties`, `allOf`, `const`, `default`, `description`, `else`, `enum`, `examples`, `format`, `if`, `items`, `maxItems`, `maxLength`, `maximum`, `minItems`, `minLength`, `minimum`, `pattern`, `properties`, `required`, `then`, `title`, `type`

Two rules make that subset trustworthy:

- **A keyword outside the subset is a validation error**, never a silent no-op. A
  contract cannot carry a constraint that looks enforced and isn't.
- **The two validators must agree.** [`packages/engine/test/corpus/validator-cases.json`](../../packages/engine/test/corpus/validator-cases.json)
  runs through both, and CI fails if either disagrees or if the keyword lists
  drift apart — including from the list above.

`format` is checked for `date-time` only, against RFC 3339, identically in both.

### Cross-field invariants

Some guarantees are implications between fields, not shapes: a run reported
`passed` must carry exit code 0; a report that says `ready` must carry zero
failures. Those live in the contract as `allOf` + `if`/`then`, so they are
enforced at runtime by the shipped schema — not only by an evaluation fixture.
Each invariant carries a `title` and `description` explaining what it prevents.

Current invariants:

| Contract | Invariant |
| --- | --- |
| `qa-run/execution-result` | `passed` ⇒ `execution.exitCode == 0` and `tests.failed == 0` |
| `qa-run/execution-result` | `failed` ⇒ `tests.failed >= 1` |
| `qa-run/execution-result` | `no-tests-run` ⇒ `tests.total == 0` |
| `qa-report/report-result` | `ready` ⇒ `testSummary.failed == 0` |
| `qa-report/report-result` | `ready` / `not-ready` ⇒ matching `releaseReadiness.verdict` |
| `qa-fix/fix-result` | `diffGuardReview.status == "fail"` ⇒ disposition is not `repairable` |

Adding an invariant is a MINOR contract change when it only rejects documents
that were already wrong, and MAJOR if it rejects a shape the previous version
legitimately allowed.

## Compatibility and evolution

| Schema change | Contract version | Pack release impact |
| --- | --- | --- |
| New optional field; enum value added | MINOR | Pack MINOR |
| Field removed or renamed; type changed; enum value removed; optional made required | MAJOR | Pack MAJOR |
| Description/annotation changes | PATCH | Pack PATCH |

Consumers must tolerate unknown minor-level additions (read what you know, ignore `metadata` you don't) and must check `contract.version` majors before relying on field presence. Producers never emit a report claiming a contract version the schema does not have.

## Validation

The skill's `## Output` section instructs the agent to check its report against the schema before declaring completion — self-validation is part of the procedure, not an afterthought. Deterministic validation tooling (a schema-check script usable in CI and by agents) ships with the analyzers in Milestone 3; the evaluation harness (Milestone 5) makes schema validity a gating assertion on every golden task. Nothing in this document waits on either: contracts are written, versioned, and reviewable now, against the [contract review checklist](quality-checklists.md).
