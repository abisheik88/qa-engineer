<!-- synced-from: shared/analysis/failure-taxonomy.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# Failure Taxonomy

The canonical classification of why a test failed. Every value implies a different owner and a different next action; if two would lead to the same action, they are merged. Classification is deterministic and conservative — an unrecognized signal is `unknown`, never a confident guess.

## The classes

| Class | Meaning | Typical owner |
| --- | --- | --- |
| `assertion-failure` | An expectation did not hold; the app behaved differently than asserted | Test author or product |
| `locator-failure` | A target element could not be found or resolved | Test author (or a UI change) |
| `timeout` | An operation exceeded its time budget | Test author or environment |
| `network` | A network or upstream service failed | Backend or infrastructure |
| `authentication` | Identity could not be established — bad or missing credentials (HTTP 401) | Test setup or auth service |
| `authorization` | Identity lacked permission for the action (HTTP 403) | Permissions or test-account setup |
| `flaky` | The test is nondeterministic — passed on retry or fails intermittently | Test author |
| `environment` | The environment was wrong — missing base URL, unreachable local service | Environment owner |
| `configuration` | Misconfiguration — missing module, bad option, absent variable | Test or build config owner |
| `infrastructure` | A crash or resource exhaustion — OOM, disk, browser crash, dead worker | CI or infrastructure |
| `test-data` | Test data was missing, duplicated, or invalid | Test data owner |
| `application-bug` | The software under test is genuinely broken | Product |
| `framework-failure` | A fault in the test framework or driver itself | Framework or driver |
| `unknown` | Signals were insufficient to classify | Manual review |

## Classification rules

Classification maps observed signals to a class using ordered rules; the order encodes priority so that the most specific reading wins:

- **A concrete HTTP status outranks message text.** A 401 is `authentication`, a 403 is `authorization`, and a 5xx is `network` — regardless of how the error message is worded.
- **Flakiness comes from run metadata, not message text.** `flaky` is assigned by the diagnostics layer when a test passed on retry or is intermittent across runs — the message alone never yields `flaky`.
- **Specific before general.** A timeout *waiting for a locator* is `locator-failure`, not `timeout`; the locator rule is evaluated first.
- **No match is `unknown`.** When no rule matches with sufficient signal, the result is `unknown` at low confidence, with an honest reason that manual review is needed.

## Required evidence

A classification is only as good as its evidence. Each class states what evidence supports it — an assertion failure cites the failing expectation; a network failure cites the request and status; a locator failure cites the missing selector. A classification asserted without its characteristic evidence is downgraded toward `unknown`, because evidence precedes conclusions.

## Recommended actions

Each class maps to a safe recommendation (recommendation guidelines): a `product` failure recommends filing a bug and **not** touching the test; a `locator-failure` recommends inspecting and updating the locator; an `environment` failure recommends fixing the environment, not the test. The taxonomy is the bridge from "what happened" to "what to do", and it never recommends making a failing test pass without addressing the cause.

## Stability

The class set is closed and implemented by the analysis core's taxonomy module. Adding a class is a deliberate, versioned change, because every diagnostic skill and every consumer of a finding depends on the set being fixed.
