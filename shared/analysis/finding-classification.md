# Finding Classification

How an analyzer turns normalized data into a classified finding. Classification sits between parsing and reporting: the artifact is already parsed and validated; this is the step that assigns meaning, and it does so by rule, not by feel.

## The path from data to finding

1. **Gather signals.** From the normalized artifact: the error message, an HTTP status, an exit code, the presence or absence of expected artifacts.
2. **Apply the taxonomy.** Run the signals through the [failure taxonomy](failure-taxonomy.md)'s ordered rules to get a class, a confidence, and a reason.
3. **Attach evidence.** Bind the finding to the artifact and excerpt that produced the signals, redacted.
4. **Set confidence.** Calibrate per the [confidence model](confidence-model.md) — high for a directly observed cause, lower for an inference, low with an honest reason when unknown.
5. **Recommend.** Derive safe next actions from the class, per the [recommendation guidelines](recommendation-guidelines.md).

## Rules

- **Classify from evidence, not from expectation.** A test named "login" that failed is not automatically an `authentication` failure; the class comes from the error's signals, not the test's name.
- **One primary class per finding.** A finding has a single classification. When signals genuinely point two ways (a timeout that might be network or environment), pick the better-supported class and record the alternative in the reason — do not emit two conflicting findings for one failure.
- **Corroborate across artifacts when possible.** A `network` classification from an error message is stronger when a HAR shows the matching failed request; classification pulls in related artifacts as evidence where they exist.
- **Unknown is a valid outcome.** When the signals do not match any rule, the finding is classified `unknown` at low confidence with a reason stating what would resolve it. This is a correct finding, not a failure to produce one.

## Determinism

Given the same normalized data, classification produces the same finding every time. It is implemented by the analysis core's taxonomy module and is unit-tested against representative signals, so its behavior is fixed and auditable — the opposite of a model deciding case by case.
