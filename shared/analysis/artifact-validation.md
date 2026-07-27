# Artifact Validation

Confirming an artifact is trustworthy before an analyzer relies on it. Validation is the gate between discovery and parsing: an artifact that has not been validated is never treated as fact.

## Levels

Validation is layered, cheapest check first, so a bad artifact is rejected before expensive parsing:

1. **Presence.** The artifact exists and is non-empty. A zero-length file is `partial`, not empty data to reason over.
2. **Structure.** The artifact matches its format's basic shape — a trace is a valid zip, a report or HAR is valid JSON, a JUnit file has a testsuite root. This is a cheap structural check, not a full parse.
3. **Parse.** The full parse succeeds. A parse failure raises a malformed-artifact error that names the artifact and the failure; it is never caught and turned into an empty or partial result silently.

## The rule against guessing

A malformed artifact is a hard stop for the conclusion that depended on it, not a soft fallback to inference. If a JUnit file will not parse, the analyzer does not scrape the console for counts instead — it reports the artifact as unusable and lets the diagnostic skill decide, with that fact as evidence. This is the operational form of *unknown over incorrect*.

## Cross-checks

Where two artifacts should agree, validation notes when they do not, and treats the disagreement as evidence rather than resolving it silently:

- A runner exit code that disagrees with a parsed report count is a discrepancy, surfaced, not reconciled by preferring the convenient one.
- A result claiming a passing test alongside a failure screenshot for that test is a contradiction worth flagging.

## Output

Validation contributes each artifact's integrity classification to discovery, and raises on parse failure. It produces no findings of its own; it makes the difference between a finding built on solid evidence and one built on a corrupted file — which is the difference between analysis and guessing.
