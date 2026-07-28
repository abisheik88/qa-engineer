// Deterministic finding prioritization.
//
// Assigns every finding a severity, priority, the three impacts, an owner, and an
// estimated effort — by a fixed algorithm, so the same finding always ranks the
// same way. Priority is not a feeling; it is a function of severity, confidence,
// and business impact.

import * as taxonomy from '../analysis/taxonomy.mjs';

// Base severity per classification (before confidence adjustment).
const SEVERITY = {
  [taxonomy.APPLICATION_BUG]: 'high',
  [taxonomy.INFRASTRUCTURE]: 'high',
  [taxonomy.NETWORK]: 'high',
  [taxonomy.AUTH]: 'high',
  [taxonomy.AUTHORIZATION]: 'high',
  [taxonomy.ASSERTION]: 'medium',
  [taxonomy.LOCATOR]: 'medium',
  [taxonomy.TIMEOUT]: 'medium',
  [taxonomy.TEST_DATA]: 'medium',
  [taxonomy.CONFIGURATION]: 'medium',
  [taxonomy.ENVIRONMENT]: 'medium',
  [taxonomy.FRAMEWORK]: 'medium',
  [taxonomy.FLAKY]: 'medium',
  [taxonomy.UNKNOWN]: 'low',
};

// Where the impact predominantly lands, per classification.
const IMPACT = {
  [taxonomy.APPLICATION_BUG]: { business: 'high', technical: 'high', testing: 'low' },
  [taxonomy.NETWORK]: { business: 'high', technical: 'high', testing: 'medium' },
  [taxonomy.AUTH]: { business: 'high', technical: 'medium', testing: 'medium' },
  [taxonomy.AUTHORIZATION]: { business: 'high', technical: 'medium', testing: 'medium' },
  [taxonomy.INFRASTRUCTURE]: { business: 'medium', technical: 'high', testing: 'high' },
  [taxonomy.LOCATOR]: { business: 'low', technical: 'low', testing: 'high' },
  [taxonomy.ASSERTION]: { business: 'medium', technical: 'medium', testing: 'medium' },
  [taxonomy.TIMEOUT]: { business: 'low', technical: 'medium', testing: 'high' },
  [taxonomy.TEST_DATA]: { business: 'low', technical: 'low', testing: 'high' },
  [taxonomy.CONFIGURATION]: { business: 'low', technical: 'medium', testing: 'high' },
  [taxonomy.ENVIRONMENT]: { business: 'low', technical: 'medium', testing: 'high' },
  [taxonomy.FRAMEWORK]: { business: 'low', technical: 'medium', testing: 'high' },
  [taxonomy.FLAKY]: { business: 'low', technical: 'low', testing: 'high' },
  [taxonomy.UNKNOWN]: { business: 'low', technical: 'low', testing: 'medium' },
};

// Rough effort to resolve, per classification.
const EFFORT = {
  [taxonomy.LOCATOR]: 'low',
  [taxonomy.ASSERTION]: 'low',
  [taxonomy.CONFIGURATION]: 'low',
  [taxonomy.ENVIRONMENT]: 'low',
  [taxonomy.TEST_DATA]: 'medium',
  [taxonomy.TIMEOUT]: 'medium',
  [taxonomy.FLAKY]: 'medium',
  [taxonomy.AUTH]: 'medium',
  [taxonomy.AUTHORIZATION]: 'medium',
  [taxonomy.FRAMEWORK]: 'medium',
  [taxonomy.NETWORK]: 'high',
  [taxonomy.INFRASTRUCTURE]: 'high',
  [taxonomy.APPLICATION_BUG]: 'external',
  [taxonomy.UNKNOWN]: 'unknown',
};

const RANK = { low: 1, medium: 2, high: 3 };
const PRIORITY = { 1: 'P3', 2: 'P2', 3: 'P1', 4: 'P1' };

/**
 * Prioritize a root cause.
 *
 * Priority derives from severity, business impact, and confidence, and is escalated
 * one step when the failure blocks a release.
 */
export function prioritize(rootCause, { blocking = false } = {}) {
  const classification = rootCause.classification;
  const confidence = 'confidence' in rootCause && rootCause.confidence !== undefined
    ? rootCause.confidence
    : 0.5;
  const severity = SEVERITY[classification] ?? 'low';
  const impact = IMPACT[classification] ?? IMPACT[taxonomy.UNKNOWN];

  // Priority score: severity and business impact drive it; low confidence holds it
  // back (an uncertain finding should not top the queue).
  let score = RANK[severity];
  if (impact.business === 'high') score += 1;
  if (confidence < 0.5) score -= 1;
  if (blocking) score += 1;
  score = Math.max(1, Math.min(4, score));

  return {
    severity,
    priority: PRIORITY[score],
    businessImpact: impact.business,
    technicalImpact: impact.technical,
    testingImpact: impact.testing,
    confidence,
    owner: rootCause.ownership ?? 'needs-triage',
    estimatedEffort: EFFORT[classification] ?? 'unknown',
  };
}
