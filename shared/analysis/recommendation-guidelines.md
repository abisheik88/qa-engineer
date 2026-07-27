# Recommendation Guidelines

How a finding becomes an actionable, safe recommendation. Analysis stops at recommending; it never fixes. But a finding that only names a problem is half a diagnosis — the value is in a specific, safe next step, tied to the failure's cause.

## From class to action

Each [failure class](failure-taxonomy.md) maps to a characteristic recommendation:

| Class | Recommendation |
| --- | --- |
| `application-bug` | File a bug against the product; **do not modify the test to pass** |
| `assertion-failure` | Confirm whether the app or the expectation is wrong; fix whichever is genuinely incorrect |
| `locator-failure` | Inspect the current DOM and update the locator to target the same element |
| `timeout` | Investigate the slowness; raise a wait only if the operation is legitimately slower, never to mask a hang |
| `network` | Check the upstream service and the request; retry only if the failure is genuinely transient |
| `authentication` | Fix the auth setup or credentials; do not weaken the auth check |
| `environment` | Fix the environment (base URL, service availability); the test is likely fine |
| `configuration` | Correct the configuration; do not work around it in the test |
| `infrastructure` | Escalate to CI or infrastructure owners; increase resources, do not shrink the suite |
| `test-data` | Repair or reseed the data; do not delete the assertion that caught the gap |
| `framework-failure` | Update or pin the framework/driver; report upstream if it is a genuine defect |
| `unknown` | Investigate further; state exactly what evidence is missing to classify |

## Rules

- **Never recommend making a failing test pass without addressing the cause.** No recommendation ever suggests deleting an assertion, adding a skip, forcing a pass, or loosening a check to go green — those are precisely what the [diff guard](../../skills/qa-generate/README.md) exists to block, and the analysis platform never proposes them.
- **Specific, not generic.** "Update the locator on line 42 to match the renamed button" beats "check your locators". Recommendations name the artifact, the location, and the concrete change where the evidence supports it.
- **Scaled to confidence.** A high-confidence finding warrants a definitive action; a low-confidence one warrants investigation with the open questions stated ([confidence model](confidence-model.md)).
- **Ordered and owned.** Recommendations carry a priority and, where a pack command is the natural next step, name it — so a diagnostic skill can hand off cleanly.

## The boundary

Recommendations are advice, not edits. The analysis platform produces them; a human or a future repair skill decides and acts, with the diff guard standing between any proposed edit and a claim of success. Keeping analysis on the advice side of that line is what makes its output trustworthy.
