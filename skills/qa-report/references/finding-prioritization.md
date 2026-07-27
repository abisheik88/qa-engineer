<!-- synced-from: shared/diagnostics/finding-prioritization.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# Finding Prioritization

The deterministic algorithm that assigns every finding a severity, priority, three impacts, an owner, an estimated effort, and carries its confidence. Prioritization exists so a run with a dozen failures presents in the order a team should act, not the order the tests happened to run.

## What every finding receives

| Field | How it is set |
| --- | --- |
| Severity | Base severity for the classification (high, medium, low) |
| Priority | Computed score (P1–P3) — see the algorithm below |
| Business impact | From the classification's impact profile |
| Technical impact | From the classification's impact profile |
| Testing impact | From the classification's impact profile |
| Confidence | Carried from the root cause |
| Owner | Carried from the root cause's ownership map |
| Estimated effort | Rough effort for the classification (low, medium, high, external, unknown) |

## The algorithm

Priority is a function, not a feeling:

```text
  score  = rank(severity)                       # low=1, medium=2, high=3
  score += 1  if business impact is high
  score -= 1  if confidence < 0.5               # uncertain findings do not top the queue
  score += 1  if the failure blocks a release   # product, network, infra, auth, authz
  score  = clamp(score, 1, 4)

  P1  if score >= 3
  P2  if score == 2
  P3  if score == 1
```

Two properties fall out of this deliberately: a release-blocking `application-bug` at high confidence lands P1, while a low-confidence `unknown` cannot — an uncertain finding is never allowed to outrank a well-evidenced one. And an easily-fixed but low-impact `locator-failure` sits below a high-impact `network` failure, so effort does not masquerade as urgency.

## Severity and impact by class

Severity is high for causes that usually mean real breakage (`application-bug`, `network`, `infrastructure`, `authentication`, `authorization`), medium for the common test-side and environment causes, and low for `unknown`. Impact is split three ways because the same failure lands differently on different audiences: a `locator-failure` is high *testing* impact but low *business* impact, while an `application-bug` is high *business* and *technical* impact. This is what lets `qa-report` speak to executives and engineers from the same finding.

## Determinism

The algorithm is implemented in the engine's `prioritization` module and is unit-tested: the same root cause always produces the same priority. That repeatability is what makes prioritized output trustworthy and comparable across runs — the ranking is computed, not improvised.
