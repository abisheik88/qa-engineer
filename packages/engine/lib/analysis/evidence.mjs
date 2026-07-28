// The evidence and finding model shared by every analyzer.
//
// Every finding an analyzer produces carries the same structure, so downstream
// skills (qa-debug, qa-report, qa-fix) consume one shape regardless of which
// analyzer or framework produced it. Text fields are redacted at construction.
//
// Ported from qa_analysis/evidence.py. Python used dataclasses with a `to_dict()`;
// here each factory returns the serialized shape directly, because that shape —
// not the object — is what every consumer actually uses, and one representation
// cannot drift from the other.

import { redactText } from './redaction.mjs';

export const EVIDENCE_TYPES = new Set([
  'trace', 'har', 'junit', 'report', 'console', 'network', 'stdout',
  'stderr', 'screenshot', 'video', 'log', 'file', 'diff',
]);

/** ISO 8601 UTC timestamp. Isolated so tests can substitute it. */
export function utcNow() {
  return new Date().toISOString();
}

/**
 * One observation supporting a finding. Excerpts are redacted here, at
 * construction, so no caller can forget to do it.
 */
export function evidence({ type, description, source, excerpt = '' }) {
  if (!EVIDENCE_TYPES.has(type)) {
    throw new Error(`unknown evidence type: ${type}`);
  }
  const redacted = redactText(excerpt);
  const entry = { type, description, source };
  if (redacted) entry.excerpt = redacted;
  return entry;
}

/**
 * A single diagnostic conclusion, traceable to a specific artifact.
 *
 * Carries everything the evidence model requires: the artifact and location it
 * came from, when, why, the supporting evidence, a calibrated confidence, the
 * affected tests, related artifacts, and recommended actions.
 */
export function finding({
  classification,
  reason,
  artifact: artifactPath,
  location,
  confidence = null,
  timestamp = undefined,
  evidence: items = [],
  affectedTests = [],
  relatedArtifacts = [],
  recommendations = [],
}) {
  const result = {
    classification,
    reason,
    artifact: artifactPath,
    location,
    timestamp: timestamp ?? utcNow(),
    evidence: items,
    affectedTests,
    relatedArtifacts,
    recommendations,
  };
  if (confidence !== null && confidence !== undefined) result.confidence = confidence;
  return result;
}

/**
 * The envelope an analyzer emits: findings plus the artifacts it examined.
 *
 * A downstream skill wraps this in its own output contract; on its own it is the
 * deterministic, machine-readable result of one analysis.
 */
export function analyzerOutput({
  analyzer,
  findings = [],
  artifacts = [],
  warnings = [],
  generatedAt = undefined,
}) {
  return {
    analyzer,
    generatedAt: generatedAt ?? utcNow(),
    findings,
    artifacts,
    warnings,
  };
}

/** A discovered artifact, in the common model shared with the execution engine. */
export function artifact({
  type,
  location,
  framework = 'unknown',
  ownership = 'qa-analysis',
  timestamp = undefined,
  mediaType = '',
  testRef = '',
  present = true,
}) {
  const entry = {
    type,
    location,
    framework,
    timestamp: timestamp ?? utcNow(),
    ownership,
    present,
  };
  if (mediaType) entry.mediaType = mediaType;
  if (testRef) entry.testRef = testRef;
  return entry;
}
