<!-- synced-from: shared/diagnostics/repair-strategy.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# Repair Strategy

How the engine turns a root cause into a repair *plan*. This milestone plans repairs; it never writes code. `qa-fix` consumes these plans, and a later milestone applies them — always through the diff guard, always with permission.

## Repairable versus escalation

Not every failure is a test-side repair. The engine decides deterministically from the classification:

| Classification | Disposition | Candidate type |
| --- | --- | --- |
| `locator-failure` | Repairable | locator-update |
| `assertion-failure` | Repairable (confirm product first) | assertion-improvement |
| `timeout` | Repairable | wait-strategy |
| `flaky` | Repairable | synchronization |
| `test-data` | Repairable | test-data |
| `configuration` | Repairable | configuration |
| `authentication` | Repairable (test's own credentials/setup) | authentication |
| `authorization` | Escalation | — grant permission, not a code change |
| `network`, `infrastructure` | Escalation | — investigate upstream |
| `application-bug` | Escalation | — file a product bug |
| `framework-failure` | Escalation | — update/pin the framework |
| `unknown` | Escalation | — investigate first |

An escalation produces a plan with no proposed changes and a clear statement of who should act — because the safest repair for a real product bug is not to touch the test.

## What a repair plan contains

Every plan carries, and never more than, these fields:

| Field | Meaning |
| --- | --- |
| `repairable` | Whether a test-side repair is appropriate |
| `candidateType` | The kind of repair |
| `proposedChanges` | Abstract descriptions of the change — **never code** |
| `affectedFiles` | The files a repair would touch |
| `risk` | The plan's risk level |
| `permissionRequired` | Always true — no repair is applied without consent |
| `rollbackStrategy` | How to undo, should the repair be applied |
| `safetyReview` | That the diff guard will gate any resulting edit |

## Plans, not code

The `proposedChanges` are descriptions — "update the failing locator to target the same element in the current DOM" — not diffs or source. Generating the actual code is a later capability; keeping this milestone at the plan level means `qa-fix` can be trusted (it changes nothing) and the plan can be reviewed before any code exists. The engine's repair module enforces this: its output is prose intent, unit-tested to contain no code.

## The diff guard is the gate

Every repairable plan states that any eventual edit will pass through the diff guard before it is proposed as complete — the guard rejects removed assertions, added skips, forced passes, and timeout inflation. So even when a later milestone applies these plans, the safety rail is already specified here: a repair that would make the suite pass without proving the software works cannot survive the guard.
