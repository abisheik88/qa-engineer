// Deterministic root-cause analysis.
//
// Turns a failure signal into a classified root cause with the four things every
// classification must carry: a taxonomy class (with confidence and evidence-backed
// reason), a recommended action, and an owner. It reuses the analysis platform's
// failure taxonomy; it adds the ownership and recommendation mappings and the
// metadata-driven classes (flaky) the taxonomy cannot infer from a message alone.
//
// No unsupported conclusions: a signal that matches no rule is `unknown`.

import * as taxonomy from '../analysis/taxonomy.mjs';

/** classification -> the party that typically owns the fix. */
export const OWNERSHIP = {
  [taxonomy.ASSERTION]: 'test-author-or-product',
  [taxonomy.LOCATOR]: 'test-author',
  [taxonomy.TIMEOUT]: 'test-author-or-environment',
  [taxonomy.NETWORK]: 'backend-or-infrastructure',
  [taxonomy.AUTH]: 'auth-or-test-setup',
  [taxonomy.AUTHORIZATION]: 'permissions-or-test-account',
  [taxonomy.ENVIRONMENT]: 'environment-owner',
  [taxonomy.CONFIGURATION]: 'config-owner',
  [taxonomy.INFRASTRUCTURE]: 'ci-or-infrastructure',
  [taxonomy.TEST_DATA]: 'test-data-owner',
  [taxonomy.APPLICATION_BUG]: 'product',
  [taxonomy.FRAMEWORK]: 'framework-or-driver',
  [taxonomy.FLAKY]: 'test-author',
  [taxonomy.UNKNOWN]: 'needs-triage',
};

// classification -> the safe recommended action (implements the analysis
// platform's recommendation-guidelines; never recommends forcing a pass).
export const RECOMMENDATION = {
  [taxonomy.ASSERTION]: 'Confirm whether the app or the expectation is wrong; fix whichever is genuinely incorrect.',
  [taxonomy.LOCATOR]: 'Inspect the current DOM and update the locator to target the same element.',
  [taxonomy.TIMEOUT]: 'Investigate the slowness; raise a wait only if the operation is legitimately slower.',
  [taxonomy.NETWORK]: 'Check the upstream service and the request; retry only if the failure is genuinely transient.',
  [taxonomy.AUTH]: 'Fix the credentials or auth setup; do not weaken the authentication check.',
  [taxonomy.AUTHORIZATION]: 'Grant the test account the needed permission or use an authorized role; do not bypass the check.',
  [taxonomy.ENVIRONMENT]: 'Fix the environment (base URL, service availability); the test is likely fine.',
  [taxonomy.CONFIGURATION]: 'Correct the configuration; do not work around it in the test.',
  [taxonomy.INFRASTRUCTURE]: 'Escalate to CI or infrastructure owners; add resources, do not shrink the suite.',
  [taxonomy.TEST_DATA]: 'Repair or reseed the data; do not delete the assertion that caught the gap.',
  [taxonomy.APPLICATION_BUG]: 'File a bug against the product; do NOT modify the test to pass.',
  [taxonomy.FRAMEWORK]: 'Update or pin the framework/driver; report upstream if it is a genuine defect.',
  [taxonomy.FLAKY]: 'Stabilize the test (fix the race or synchronization); quarantine only with a tracking issue.',
  [taxonomy.UNKNOWN]: 'Investigate further; the evidence was insufficient to classify.',
};

/**
 * Classify a failure signal into a root cause.
 *
 * `signal` may carry: message, httpStatus, retries, finalStatus, classification,
 * confidence, reason, evidence. Returns
 * `{classification, confidence, reason, ownership, recommendation, evidence}`.
 */
export function analyze(signal) {
  const message = signal.message ?? '';
  const httpStatus = signal.httpStatus;
  const retries = signal.retries || 0;
  const finalStatus = signal.finalStatus;
  const provided = signal.classification;

  let classification;
  let confidence;
  let reason;

  // Flakiness is a metadata signal, not a message pattern: a test that needed a
  // retry to pass, or is explicitly flagged flaky, is nondeterministic.
  if (finalStatus === 'flaky' || (retries > 0 && ['passed', 'flaky'].includes(finalStatus))) {
    classification = taxonomy.FLAKY;
    confidence = 0.8;
    reason = 'The test passed only after a retry, indicating nondeterministic behavior.';
  } else if (taxonomy.CLASSES.has(provided)) {
    // The analysis platform already classified this deterministically; trust it
    // rather than re-deriving from the message.
    classification = provided;
    confidence = 'confidence' in signal ? signal.confidence : 0.8;
    reason = signal.reason || `Classified ${provided} by the analysis platform.`;
  } else {
    ({ classification, confidence, reason } = taxonomy.classify(message, httpStatus ?? null));
  }

  return {
    classification,
    confidence,
    reason,
    ownership: OWNERSHIP[classification] ?? 'needs-triage',
    recommendation: RECOMMENDATION[classification] ?? RECOMMENDATION[taxonomy.UNKNOWN],
    evidence: signal.evidence ?? [],
  };
}
