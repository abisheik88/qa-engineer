# Report Aggregation

How the engine combines results and diagnoses into the summaries `qa-report` presents, and the deterministic release-readiness call. Aggregation turns per-failure diagnoses into a run-level picture for different audiences.

## The summaries

`qa-report` produces audience-specific views from the same aggregated data:

| Summary | Answers |
| --- | --- |
| Executive | Is the build shippable, in one paragraph and a verdict? |
| Engineering | What broke, why, who owns it, and in what priority? |
| Test | How many ran, passed, failed, were skipped or flaky? |
| Failure | Each failure's root cause, evidence, and recommendation |
| Coverage | What was and was not exercised, where that data exists |
| Risk | The release-blocking findings and their impact |

The three impacts prioritization assigns (business, technical, testing) are what let the executive and engineering summaries be drawn from one set of findings — the same failure is described in business terms up top and technical terms below.

## Release readiness

The verdict is deterministic, computed by the engine from the diagnosis:

| Verdict | Condition |
| --- | --- |
| `ready` | No failures and no findings |
| `not-ready` | Any release-blocking cause present (product bug, network, infrastructure, authentication, authorization) |
| `insufficient-data` | Only `unknown` findings — the evidence cannot support a call |
| `ready-with-risks` | Failures exist but all are test-side or environmental, not release-blocking |

The verdict is never a judgment call the presentation makes; it is computed from the classifications, so the same run always yields the same readiness. `insufficient-data` is a first-class outcome — the engine says "I cannot tell" rather than guessing "ready".

## Output formats

`qa-report` renders the aggregated data in three forms, from one structure: Markdown (for humans and pull requests), HTML-ready (the same content structured for a page), and JSON (the machine-readable report result for downstream tooling and trend tracking). The content is identical across formats; only the rendering differs.

## Trend metadata

Each report carries trend metadata — the run's totals, the by-classification breakdown, and the readiness verdict — in a stable, deterministic shape, so a series of reports can be compared over time. Because aggregation is deterministic, two runs of the same failures produce comparable reports, which is what makes trend tracking meaningful rather than noise.

## Reuse, not recomputation

Aggregation consumes the diagnoses the engine already produced; it does not re-diagnose. `qa-report` calls the engine's summarize step over existing results — the reasoning happened in `qa-debug`'s territory (the engine), and the report presents it. This is the shared-engine principle at the aggregation level.
