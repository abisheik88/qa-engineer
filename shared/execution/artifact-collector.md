# Artifact Collector

The common, framework-independent model for everything a run produces, and the rules for collecting it. This model is the interface between execution and the analysis layer of later milestones: a future analyzer consumes artifacts by their normalized type and never needs to know which framework produced them.

## The artifact model

Every collected artifact is described by the same fields, whatever produced it:

| Field | Meaning |
| --- | --- |
| `type` | Normalized kind, from the closed set below — the field analyzers key on |
| `location` | Path to the artifact, relative to the repository root |
| `framework` | The framework that produced it, for provenance (analyzers do not branch on this) |
| `timestamp` | ISO 8601 UTC time the artifact was produced |
| `mediaType` | The artifact's media type where meaningful (for example, the type for a video or an XML report) |
| `ownership` | The skill and run that produced it, for example `qa-run` |
| `testRef` | The test the artifact belongs to, when it is test-scoped rather than run-scoped |

## Normalized types

The `type` set is fixed so analyzers can rely on it across frameworks:

```text
stdout · stderr · console-log · network-log · screenshot · video · trace · har · junit · html-report · attachment
```

A framework that emits something outside this set maps it to the closest type or to `attachment` with a descriptive note; it never invents a new top-level type, because a new type is a change every future analyzer would have to learn.

## Collection rules

- **Locate, describe, never move.** Collection records where the framework wrote each artifact; it does not relocate or rewrite them. The result points at real files in place.
- **Run-scoped and test-scoped.** Some artifacts belong to the whole run (stdout, the JUnit report); others belong to one test (a trace, a failure screenshot). Test-scoped artifacts carry `testRef`.
- **Collect what the strategy planned.** The evidence plan chose what to capture and when (for example, a trace only on failure). Collection gathers exactly that set, so cost matches the strategy.
- **Redact at the boundary.** Text artifacts (stdout, logs) may contain credentials from the environment; any credential or token is redacted as the artifact is described, before it appears in a result or is shown. This applies to the description and any excerpt, not to the file on disk, which the user controls.
- **Absence is data.** A planned artifact that is missing (no trace though a test failed) is recorded as an expected-but-absent note, not silently dropped — its absence may matter to an analyzer.

## Why normalize now

Normalizing artifacts at collection time, rather than leaving each framework's raw layout for analyzers to decode, is what lets the analysis layer be written once against one model. It is the concrete form of the pack's promise that `qa-debug` and `qa-report` will work across frameworks: they will read this model, not Playwright's or Selenium's native output. The decision is recorded in the pack's architecture decision on the normalized result.
