// Deterministic repair planning.
//
// Turns a root cause into a repair *plan* — never code. It decides whether the
// failure is test-side repairable at all, and if so proposes an abstract change,
// the candidate type, the risk, and a rollback. qa-fix consumes these plans; the
// plan is always gated by the diff guard and always requires permission before any
// edit is applied.

import * as taxonomy from '../analysis/taxonomy.mjs';

// classification -> [repairable, candidate type, abstract change, risk].
// Only test-side causes are repairable; product, network, infra, authorization and
// environment failures are escalations, not repairs.
const PLANS = {
  [taxonomy.LOCATOR]: [true, 'locator-update',
    'Update the failing locator to target the same element in the current DOM.', 'low'],
  [taxonomy.ASSERTION]: [true, 'assertion-improvement',
    'Correct the assertion to match the intended behavior, or confirm a product bug first.', 'medium'],
  [taxonomy.TIMEOUT]: [true, 'wait-strategy',
    'Replace a fixed or missing wait with a web-first wait on the awaited condition.', 'medium'],
  [taxonomy.FLAKY]: [true, 'synchronization',
    'Remove the race by awaiting the real condition; add a tracked quarantine only if needed.', 'medium'],
  [taxonomy.TEST_DATA]: [true, 'test-data',
    'Repair or reseed the test data the scenario depends on.', 'medium'],
  [taxonomy.CONFIGURATION]: [true, 'configuration',
    'Correct the test configuration the run depends on.', 'low'],
  [taxonomy.ENVIRONMENT]: [false, 'environment',
    'Fix the environment (base URL, service availability); not a test-side repair.', 'n/a'],
  [taxonomy.AUTH]: [true, 'authentication',
    "Repair the test's credentials or auth setup; do not weaken the check.", 'medium'],
  [taxonomy.AUTHORIZATION]: [false, 'authorization',
    'Grant the test account permission or use an authorized role; not a code repair.', 'n/a'],
  [taxonomy.NETWORK]: [false, 'network',
    'Investigate the upstream service; not a test-side repair.', 'n/a'],
  [taxonomy.INFRASTRUCTURE]: [false, 'infrastructure',
    'Escalate to CI/infra; not a test-side repair.', 'n/a'],
  [taxonomy.APPLICATION_BUG]: [false, 'application-bug',
    'File a product bug; the test correctly caught a real defect.', 'n/a'],
  [taxonomy.FRAMEWORK]: [false, 'framework',
    'Update or pin the framework/driver; not a test-side repair.', 'n/a'],
  [taxonomy.UNKNOWN]: [false, 'unknown',
    'Investigate further before any repair.', 'n/a'],
};

/**
 * Produce a repair plan for a root cause.
 *
 * `{repairable, candidateType, proposedChanges, affectedFiles, risk,
 * permissionRequired, rollbackStrategy, safetyReview}`. Never contains code.
 */
export function planRepair(rootCause, affectedFiles = null) {
  const [repairable, candidate, change, risk] =
    PLANS[rootCause.classification] ?? PLANS[taxonomy.UNKNOWN];

  const safety = repairable
    ? 'Any edit will be checked by the diff guard before it is proposed as complete; ' +
      'the guard rejects removed assertions, added skips, forced passes, and timeout inflation.'
    : 'No test-side edit is appropriate; this is an escalation, not a repair.';
  const rollback = repairable
    ? 'No source is changed without approval; revert the proposed edits to roll back.'
    : 'Not applicable — no change is proposed.';

  return {
    repairable,
    candidateType: candidate,
    proposedChanges: repairable ? [change] : [],
    affectedFiles: [...(affectedFiles ?? [])],
    risk,
    permissionRequired: true,
    rollbackStrategy: rollback,
    safetyReview: safety,
  };
}
