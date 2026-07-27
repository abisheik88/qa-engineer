# Recommendation Ranking

How the engine orders the recommendations a diagnosis produces, so the most important, best-supported action appears first. A diagnosis of many failures yields many recommendations; ranking turns them into a queue a team can work top-down.

## The inputs to a recommendation

Every recommendation is bound to the four things the milestone requires — it is never free-floating advice:

| Reference | Source |
| --- | --- |
| Evidence | The finding's evidence entries |
| Taxonomy | The root cause's classification |
| Confidence | The root cause's calibrated confidence |
| Project context | The owner and, where relevant, `.qa/context.md` facts |

A recommendation with no evidence behind it is not produced; the engine has nothing to recommend when it has concluded nothing.

## The ranking

Recommendations are ordered by:

1. **Priority** of the finding they come from (P1 before P2 before P3) — the prioritization algorithm has already weighed severity, impact, and confidence into that priority.
2. **Confidence**, as the tie-breaker within a priority — better-supported advice first.

De-duplication follows: when several findings yield the same recommendation (three locator failures all recommending "inspect and update the locator"), it appears once, at the highest priority any of them warranted, so the queue is actions, not repetition.

## Safe by construction

Ranking never changes *what* is recommended, only the order. The recommendations themselves come from the root-cause analysis and the analysis platform's recommendation guidelines, which never suggest making a failing test pass without addressing the cause. So a ranked list is a list of safe actions in priority order — the top item is the most urgent legitimate fix, never the easiest way to turn the suite green.

## Use across skills

`qa-debug` presents the ranked recommendations for a single failure's investigation; `qa-report` presents them aggregated across a run, so a reader sees the whole queue. Both consume the same ranked output from the engine — the ranking is computed once, in the engine's recommendation logic, and presented differently.
