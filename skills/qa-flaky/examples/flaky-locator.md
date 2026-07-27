# Example: a flaky test caused by a race

## Request

```text
/qa-flaky the search test fails about one run in five
```

## Context

Run history over 20 nightly runs shows `search > shows results` failed 4 times. The failures show the assertion running before results rendered; passing runs happened to be slower to assert. No app errors.

## Expected behavior

1. Gather the 20-run history; 4 failures → flake rate 0.2.
2. Classify the cause: the assertion outran the render — a synchronization race, high confidence given the consistent signature.
3. Propose the fix from the knowledge base: wait on the results being present (web-first) rather than asserting immediately.
4. Recommend quarantine only as a tracked action, not applied.

## Expected output

`qa-artifacts/qa-flaky-3c4d.json`:

```json
{
  "contract": { "name": "qa-flaky/flaky-result", "version": "1.0.0" },
  "skill": { "name": "qa-flaky", "version": "0.1.0" },
  "generatedAt": "2026-07-19T11:20:00Z",
  "summary": "The search test is flaky (4/20 runs failed, 20%). The cause is a synchronization race: the assertion runs before results render. Fix by waiting on the results, not a duration. Not quarantined.",
  "classification": "flaky",
  "confidence": 0.85,
  "flakeRate": 0.2,
  "evidence": [
    { "type": "history", "description": "4 of 20 identical runs failed", "source": "nightly run history" },
    { "type": "trace", "description": "Assertion executed before results rendered", "source": "test-results/search/trace.zip" }
  ],
  "rootCauses": [
    { "cause": "race", "confidence": 0.85, "reason": "Failures show the assertion preceding the rendered results; passing runs asserted later." }
  ],
  "mitigations": [
    { "action": "Wait on the results being visible before asserting, instead of asserting immediately.", "priority": "high" },
    { "action": "If needed short-term, quarantine with a tracking issue and an owner — do not skip silently.", "priority": "low" }
  ],
  "metadata": {}
}
```
