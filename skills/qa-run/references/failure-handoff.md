<!-- synced-from: shared/execution/failure-handoff.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# Failure Handoff

What an execution skill does the moment a run goes red: it hands the completed result to the diagnostic skill **automatically**, by command name, and shows the diagnosis alongside the run. A red run whose only output is "1 failed — try `/qa-debug`" makes the reader do the one step they were always going to do, and it makes them do it without the run's own knowledge of what was captured and where.

This is the pack's single, deliberately narrow exception to composition-by-recommendation: everywhere else a skill ends by *naming* the next command. The exception exists because a failure is the one outcome where the next step is not a choice.

## When it fires

| Run status | Handoff |
| --- | --- |
| `failed` | Automatic: dispatch the diagnostic command with the execution result |
| `errored` | Automatic: the run itself broke, and *why* is the whole question |
| `passed` with flaky tests | No dispatch. The run is green and nobody is blocked; recommend the flakiness command instead |
| `passed`, `no-tests-run` | No dispatch. There is nothing to diagnose |
| `blocked` | No dispatch. No run was attempted, so there is no failure — the block itself is the finding |

## The rules that keep it bounded

1. **One hop, forward only.** The diagnostic skill may not dispatch onward and may not re-enter execution. A run that diagnoses that re-runs that diagnoses is a loop no user asked for; the chain is exactly two links and then it stops with a recommendation.
2. **The successor must not mutate.** Diagnosis reads artifacts and explains. Anything that edits a file, a test, or a config stays a recommendation the user approves — automation is for *learning* why the run failed, never for acting on the answer.
3. **Dispatch by name, never by path.** The handoff invokes the diagnostic command; it does not load the sibling skill's files, which are not guaranteed to exist at runtime.
4. **The artifact goes first.** The execution result is written and validated against its contract *before* the handoff, and the handoff passes its path. The successor consumes a contract-conformant artifact, exactly as it would from a human invocation — there is no privileged in-memory channel between the two, so the automatic path and the manual path produce the same diagnosis.
5. **Announce it, and let the user decline.** The run says it is diagnosing before it does. An explicit "no debug", "just run it", or a request for the run only suppresses the handoff, and the suppression is recorded rather than silently obeyed.
6. **Degrade honestly.** The diagnostic command may be unavailable — not installed, or its engine missing. The handoff is then recorded as unavailable with the reason, and the recommendation to run it stands. A failed handoff never changes the run's status: the run's own numbers are already final.
7. **The run's verdict is never revised.** The diagnosis explains a failure; it cannot argue it away. Nothing the successor concludes edits the execution result — a "the test is just flaky" diagnosis leaves a `failed` run `failed`.

## What is recorded

The execution result carries the handoff as data, so the automatic step is auditable rather than something that happened in the transcript:

| Field | Meaning |
| --- | --- |
| `skill` | The successor, by command name |
| `command` | The exact command dispatched, with the artifact path |
| `artifact` | The execution result handed over |
| `status` | `dispatched`, `skipped` (the user declined), or `unavailable` (it could not run) |
| `reason` | Required for `skipped` and `unavailable` — why the diagnosis is not there |

A red result that records no handoff at all is incomplete: the reader cannot tell whether the diagnosis was declined, impossible, or forgotten.

## Why the failure evidence floor comes first

The handoff is only worth as much as what the run captured. The diagnostic layer reads screenshots, traces, and logs; a run that failed with none of them produces a diagnosis of "insufficient evidence, re-run with tracing" — the exact round trip the automatic handoff exists to remove. That is why the floor (in the command-builder module) is a floor and not a strategy preference: the two features are one feature, seen from each end.
