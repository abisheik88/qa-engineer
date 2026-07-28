// The diagnostic engine — the one place failure reasoning happens.
//
// Orchestrates the analysis platform and the diagnostics modules into a single
// diagnosis: per-failure root cause, prioritization, a reconstructed timeline, and
// ranked recommendations. qa-debug presents the diagnosis; qa-fix turns it into
// repair plans; qa-report aggregates diagnoses. None of them re-implements this.

import * as taxonomy from '../analysis/taxonomy.mjs';

import { analyze } from './root-cause.mjs';
import { prioritize } from './prioritization.mjs';
import { planRepair } from './repair.mjs';
import { buildTimeline } from './timeline.mjs';
import { validateDiagnosis } from './internal-contracts.mjs';

const PRIORITY_RANK = { P1: 3, P2: 2, P3: 1 };

// Classifications that block a release when they are the cause of a failure.
const RELEASE_BLOCKING = new Set([
  taxonomy.APPLICATION_BUG, taxonomy.NETWORK, taxonomy.INFRASTRUCTURE,
  taxonomy.AUTH, taxonomy.AUTHORIZATION,
]);

/**
 * Produce a full diagnosis from the available results.
 *
 * `{entries, timeline, recommendations}`, where each entry combines a root cause
 * with its prioritization and affected tests.
 */
export function diagnose(executionResult, { analysisResult = null } = {}) {
  const signals = deriveSignals(executionResult, analysisResult);
  const findings = (analysisResult ?? {}).findings ?? [];

  const entries = signals.map((signal) => {
    const rootCause = analyze(signal);
    const blocking = RELEASE_BLOCKING.has(rootCause.classification);
    return {
      rootCause,
      priority: prioritize(rootCause, { blocking }),
      affectedTests: signal.affectedTests ?? [],
    };
  });

  // Highest priority first, then highest confidence. Python's `sort(reverse=True)`
  // on a tuple key is a stable descending sort, so equal keys keep insertion order
  // — reproduced by comparing in reverse and falling back to the original index.
  const decorated = entries.map((entry, index) => ({ entry, index }));
  decorated.sort((a, b) => {
    const rank = (PRIORITY_RANK[b.entry.priority.priority] ?? 0) - (PRIORITY_RANK[a.entry.priority.priority] ?? 0);
    if (rank !== 0) return rank;
    const confidence = b.entry.rootCause.confidence - a.entry.rootCause.confidence;
    if (confidence !== 0) return confidence;
    // Insertion order for ties. Python's `sort(reverse=True)` is stable, so equal
    // keys keep the order they arrived in — reversing the tie-break too would put
    // two equally-ranked locator failures back to front.
    return a.index - b.index;
  });

  const diagnosis = {
    entries: decorated.map(({ entry }) => entry),
    timeline: buildTimeline(executionResult, findings),
    recommendations: recommendations(decorated.map(({ entry }) => entry)),
  };
  // Mechanical seam enforcement: a diagnosis must match the internal contract.
  return validateDiagnosis(diagnosis);
}

/**
 * Turn a diagnosis into repair plans (for qa-fix).
 *
 * One plan per entry; non-repairable causes yield an escalation plan. Never
 * produces code.
 */
export function planRepairs(diagnosis) {
  return diagnosis.entries.map((entry) => ({
    ...planRepair(entry.rootCause, entry.affectedTests),
    priority: entry.priority.priority,
  }));
}

/**
 * Aggregate a diagnosis for qa-report: totals, breakdown by classification, the
 * top-priority findings, and a deterministic release-readiness call.
 */
export function summarize(executionResult, diagnosis) {
  const tests = (executionResult ?? {}).tests ?? {};
  const byClassification = {};
  for (const entry of diagnosis.entries) {
    const cls = entry.rootCause.classification;
    byClassification[cls] = (byClassification[cls] ?? 0) + 1;
  }

  return {
    totals: tests,
    byClassification,
    topPriority: diagnosis.entries.filter((entry) => entry.priority.priority === 'P1'),
    releaseReadiness: releaseReadiness(executionResult, diagnosis),
  };
}

/** Derive failure signals, preferring the analysis platform's findings. */
function deriveSignals(executionResult, analysisResult) {
  const findings = (analysisResult ?? {}).findings ?? [];
  if (findings.length > 0) {
    return findings.map((finding) => ({
      message: finding.reason ?? '',
      classification: finding.classification,
      confidence: finding.confidence,
      reason: finding.reason,
      httpStatus: finding.httpStatus,
      retries: finding.retries ?? 0,
      finalStatus: finding.finalStatus,
      evidence: finding.evidence ?? [],
      affectedTests: finding.affectedTests ?? [],
    }));
  }

  const signals = [];
  for (const test of (executionResult ?? {}).executed ?? []) {
    if (test.status === 'failed' || test.status === 'flaky') {
      signals.push({
        message: test.message ?? '',
        retries: test.retries ?? 0,
        finalStatus: test.status,
        affectedTests: [test.title ?? ''],
        evidence: [{
          type: 'junit',
          description: `${test.status}: ${test.title ?? ''}`,
          source: test.file ?? 'execution-result',
        }],
      });
    }
  }
  return signals;
}

/** Ranked, de-duplicated recommendations — highest priority first. */
function recommendations(entries) {
  const seen = new Set();
  const ranked = [];
  for (const entry of entries) {
    const action = entry.rootCause.recommendation;
    if (seen.has(action)) continue;
    seen.add(action);
    ranked.push({
      action,
      priority: entry.priority.priority,
      owner: entry.rootCause.ownership,
      classification: entry.rootCause.classification,
    });
  }
  return ranked;
}

function releaseReadiness(executionResult, diagnosis) {
  const failed = ((executionResult ?? {}).tests ?? {}).failed ?? 0;
  if (failed === 0 && diagnosis.entries.length === 0) return 'ready';
  const classes = new Set(diagnosis.entries.map((entry) => entry.rootCause.classification));
  for (const blocking of RELEASE_BLOCKING) {
    if (classes.has(blocking)) return 'not-ready';
  }
  // `classes <= {UNKNOWN}` in Python: every class is unknown (or there are none).
  if ([...classes].every((cls) => cls === taxonomy.UNKNOWN)) return 'insufficient-data';
  return 'ready-with-risks';
}
