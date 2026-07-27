# Timeline Builder

How the engine reconstructs the ordered sequence of a run. A timeline turns scattered artifacts and results into a legible story — start, browser launch, navigation, requests and responses, console errors, assertions, failure, cleanup — that both `qa-debug` and `qa-report` present. It is deterministic and evidenced: only stages with supporting data appear.

## The canonical phases

```text
  execution-start → browser-launch → navigation → request → response
      → console-error → assertion → failure → cleanup → execution-finish
```

This order is the logical spine. Because per-event wall-clock timestamps are frequently unavailable, the phase order is the primary sort key; a real timestamp, when present, orders events within a phase. The result is stable and repeatable.

## How stages are populated

Each stage is added only when there is evidence for it:

| Stage | Evidenced by |
| --- | --- |
| execution-start / execution-finish | The execution result's start and finish timestamps |
| navigation | A trace evidence entry |
| request / response | Network evidence (a HAR entry, a failed request) |
| console-error | Console evidence |
| assertion | A JUnit or report finding |
| failure | A failed test in the execution result |
| cleanup | The presence of a finish (a run that completed cleaned up) |

A stage with no supporting evidence is simply absent — the builder never inserts a "browser-launch" event it cannot evidence, because an invented event is a false story.

## Reuse

The timeline is built once, in the engine's `timeline` module, from the execution result and the analysis findings. `qa-debug` uses it to walk a reader through a single failure; `qa-report` uses it to show the shape of a run. Neither rebuilds it. Because it is deterministic, the same run always produces the same timeline — a property `qa-report` relies on for trend comparison.

## Honesty over completeness

A sparse timeline is a correct timeline when the evidence is sparse. The builder favors an accurate three-stage timeline over a fabricated ten-stage one. Where richer per-event data exists (a full trace), later analyzers can contribute more stages through evidence entries — the builder grows with the evidence, it does not pad without it.
