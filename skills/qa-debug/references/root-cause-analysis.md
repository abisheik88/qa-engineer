<!-- synced-from: shared/diagnostics/root-cause-analysis.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# Root-Cause Analysis

How the engine decides *why* a test failed. Root-cause analysis is deterministic and evidence-bound: every classification references evidence, references the taxonomy, and produces a confidence, a recommendation, and an owner. No unsupported conclusions.

## The classes

Root cause uses the analysis platform's failure taxonomy — one taxonomy, shared across analysis and diagnostics:

`locator-failure` · `assertion-failure` · `application-bug` · `network` · `authentication` · `authorization` · `environment` · `configuration` · `timeout` · `infrastructure` · `framework-failure` · `flaky` · `unknown`

## How a class is decided

Deterministic, in priority order:

1. **Flakiness is metadata.** A test that passed only on retry, or is flagged intermittent, is `flaky` — decided from run metadata, never from message text.
2. **A prior classification is trusted.** When the analysis platform already classified the finding, the engine uses that classification rather than re-deriving it — the analysis layer is the classifier.
3. **A concrete HTTP status wins.** 401 is `authentication`, 403 is `authorization`, 5xx is `network`.
4. **Otherwise, the taxonomy classifies the message.** The taxonomy's ordered rules apply; the most specific match wins (a locator timeout is `locator-failure`, not `timeout`).
5. **No match is `unknown`.** Insufficient signal yields `unknown` at low confidence with an honest reason — never a guess.

## What every classification produces

The four things the milestone requires of every classification, plus the taxonomy reference:

| Output | Source |
| --- | --- |
| Classification | The taxonomy class |
| Confidence | Calibrated per the analysis confidence model |
| Reason | One sentence, tied to the deciding evidence |
| Recommendation | The safe action for the class (the analysis recommendation guidelines) |
| Owner | The party that typically owns the fix, from the ownership map |

## Ownership map

Each class maps to a default owner, so a finding says not just *what* but *who*:

- `locator-failure`, `flaky` → the test author.
- `assertion-failure` → the test author or product, depending on which is wrong.
- `application-bug` → product.
- `network`, `infrastructure` → backend or infrastructure.
- `authentication` → auth service or test setup; `authorization` → permissions or the test account.
- `environment`, `configuration` → their respective owners.
- `framework-failure` → the framework or driver.
- `unknown` → triage.

## The rule against unsupported conclusions

A root cause is only emitted with evidence behind it. The `application-bug` class is held to the highest bar, because concluding the product is broken has consequences: it is asserted only with direct evidence (a server error, a concrete defect signal), never inferred from a bare test failure. When the evidence does not reach that bar, the honest result is a lower-confidence class or `unknown` — the engine would rather say "investigate further" than blame the wrong owner.
