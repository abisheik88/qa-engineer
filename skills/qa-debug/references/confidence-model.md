<!-- synced-from: shared/analysis/confidence-model.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# Confidence Model

How much to trust a finding, expressed as a calibrated number and, more importantly, held honest. Confidence exists to tell a downstream skill and a human when a finding is solid and when it needs a second look — not to decorate a guess with a number.

## The scale

Confidence is a number from 0.0 to 1.0, calibrated to observable support:

| Range | Meaning |
| --- | --- |
| 0.85–1.0 | Directly observed cause — a concrete HTTP status, an exact error signature, corroborating artifacts agree |
| 0.6–0.85 | Strong inference — a clear error message pattern, but without independent corroboration |
| 0.4–0.6 | Weak inference — signals are suggestive but ambiguous; the reason states what would raise it |
| below 0.4 | Unknown — no rule matched; the finding exists to record the gap, not to assert a cause |

## Rules

- **Calibrated, not decorative.** A number is attached only when the analyzer actually weighed evidence. If it did not, confidence is omitted rather than fabricated — an absent confidence is honest; a made-up 0.99 is not.
- **Corroboration raises it; contradiction lowers it.** Two artifacts agreeing on a cause raises confidence; a contradiction between artifacts caps it low and is surfaced as the reason.
- **Missing evidence lowers it.** A classification asserted without its characteristic evidence (per the failure taxonomy) is downgraded toward unknown, not reported at face value.
- **The reason carries what the number cannot.** Every non-high confidence is paired with a reason that says *why* it is not higher and *what* would raise it, so a human knows exactly what to check.

## Use downstream

A diagnostic skill uses confidence to decide how firmly to state a conclusion and whether to recommend a definitive action or further investigation. A high-confidence `application-bug` finding warrants "file a bug"; a low-confidence one warrants "investigate further, here is what is unresolved". The confidence model is what keeps the pack from overstating — the operational form of *unknown over incorrect*.
