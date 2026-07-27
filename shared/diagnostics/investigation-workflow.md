# The Investigation Workflow

The end-to-end stages a diagnosis moves through, from a finished run to a report. Every diagnostic skill follows this workflow; each stops at the stage its job requires. The workflow is deterministic where it can be and honest where it cannot.

## The stages

```text
  1. Execution result      what happened: status, counts, artifacts, environment
        ↓
  2. Artifact discovery     locate the run's artifacts; classify their integrity
        ↓
  3. Analysis               parse artifacts into evidence-backed findings
        ↓
  4. Evidence               the observations that support each finding, redacted
        ↓
  5. Finding                a classified conclusion tied to its evidence
        ↓
  6. Root cause             why it failed: taxonomy class, confidence, reason, owner
        ↓
  7. Confidence             calibrated trust in the root cause
        ↓
  8. Recommendations        safe next actions, ranked by priority and confidence
        ↓
  9. Repair candidates      abstract repair plans for the fixable causes (no code)
        ↓
 10. Reports                audience-specific summaries and a release-readiness call
```

## Who stops where

| Skill | Runs stages | Then |
| --- | --- | --- |
| qa-debug | 1–8 | Presents the diagnosis; recommends `/qa-fix` when the cause is test-side |
| qa-fix | consumes 6–8, runs 9 | Presents repair plans gated by the diff guard; awaits permission |
| qa-report | consumes 1–8 across runs, runs 10 | Presents summaries and release readiness |

Stages 2–5 are the analysis platform; stages 6–10 are this platform. The engine consumes the analysis output rather than repeating it.

## Determinism and honesty

- Stages 2–7 and 9 are deterministic: discovery, parsing, classification, prioritization, and repair planning are computed, and repeat identically.
- Stage 6's *narrative* and stage 10's *framing* are the skill's judgment over deterministic inputs.
- At every stage, a gap is reported, not filled: a missing artifact, an unclassifiable failure, an unrepairable cause. Unknown is preferable to incorrect, all the way through.

## Entry points

The workflow does not require a full pipeline. `qa-debug` can start from an execution result alone (deriving signals from failed tests) or from a richer analysis result. `qa-report` can aggregate whatever results exist. The engine uses what it is given and states what it lacks — the workflow degrades gracefully rather than demanding every upstream stage ran.
