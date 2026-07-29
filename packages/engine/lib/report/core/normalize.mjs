// Every input shape the renderer accepts, folded into one internal shape.
//
// ## Why this seam exists
//
// The promise is that a report looks the same whoever produced it — Claude Code,
// Cursor, Codex, a future agent nobody has written yet. That promise is only keepable
// if *no producer ever touches presentation*, which in turn is only enforceable if
// every producer hands over the same kind of thing: structured data, validated, and
// then rendered by code none of them can influence.
//
// This module is where "the same kind of thing" is defined. It accepts:
//
//   qa-engineer/qa-report      the canonical, producer-neutral report (schema 2.0)
//   qa-explore/explore-result  the exploratory contract (schema 1.x)
//   qa-report/report-result    the release rollup (schema 1.x)
//
// and returns one internal shape. Adding a fourth producer means adding a normalizer
// here — not a stylesheet, not a template, and certainly not a second renderer.
//
// ## Why the older contracts are not simply migrated
//
// Reports are archived. A result written a year ago must still render, and an
// installed skill emitting schema 1.1 must not break when the pack updates. So the
// older shapes are translated on read rather than deprecated on write, and the
// canonical shape is what new producers are pointed at.
//
// ## What a producer may not do
//
// Nothing here reads a colour, a class name, a font, or a layout hint, and the
// canonical schema has no field to carry one. An agent that wants its report to look
// different has no mechanism to make it so — which is the point.

import { schemaVersionOf, SUPPORTED_SCHEMA_VERSIONS, isSupportedSchema } from '../version.mjs';

export class SchemaError extends Error {
  name = 'SchemaError';
}

/**
 * The canonical report, unwrapped into the internal shape.
 *
 * The canonical form groups fields by audience — `summary` for the decision,
 * `coverage` for what was looked at, `issues` for the detail — because that is how a
 * producer thinks about filling it in. The internal shape is flat because that is how
 * fifteen sections read from it. Neither is wrong; this function is the join.
 */
function fromCanonical(report) {
  const metadata = report.metadata ?? {};
  const summary = report.summary ?? {};
  const coverage = report.coverage ?? {};
  const recommendations = report.recommendations ?? {};

  return {
    contract: { name: 'qa-engineer/qa-report', version: report.schemaVersion ?? '2.0' },
    skill: metadata.producer
      ? { name: metadata.producer.skill ?? metadata.producer.agent ?? 'unknown', version: metadata.producer.version ?? '' }
      : undefined,
    producer: metadata.producer ?? null,

    title: metadata.title,
    url: metadata.url,
    environment: metadata.environment,
    generatedAt: metadata.generatedAt,
    durationMs: metadata.durationMs,
    reportVersion: metadata.reportVersion,
    browserAdapter: metadata.browserAdapter,
    authentication: metadata.authentication,

    summary: summary.text ?? '',
    classification: summary.classification ?? null,
    executive: {
      verdict: summary.verdict,
      headline: summary.headline,
      health: summary.health,
      risks: summary.risks,
      recommendedAction: summary.recommendedAction,
      estimatedFixHours: summary.estimatedFixHours,
      confidence: summary.confidence,
    },
    scores: summary.scores,
    severityCounts: summary.severityCounts ?? countSeverities(report.issues ?? []),

    scope: {
      objective: coverage.objective,
      covered: coverage.covered,
      notCovered: coverage.notCovered,
    },
    dimensionsRun: coverage.dimensionsRun,
    pages: coverage.pages,
    testCases: coverage.testCases,
    timeline: coverage.timeline,

    // `issues` is the canonical name; `findings` is what fifteen sections already call
    // them. Renaming the sections to match would be churn with no reader benefit.
    findings: report.issues ?? [],
    artifacts: report.artifacts,
    evidence: report.evidence ?? [],

    performance: report.performance,
    security: report.security,
    accessibility: report.accessibility,
    console: report.console,
    network: report.network,
    dbValidation: report.dataValidation,

    fixOrder: recommendations.fixOrder,
    recommendations: recommendations.actions,
    whatWorksWell: recommendations.whatWorksWell,
  };
}

/** Severity totals, when the producer did not count them itself. */
function countSeverities(issues) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of issues) {
    if (counts[issue.severity] !== undefined) counts[issue.severity] += 1;
  }
  return counts;
}

/**
 * Fold `qa-report/report-result` — the release rollup — into the same shape.
 *
 * The rollup describes the same event from further away: one summary of many runs
 * rather than one run of a product. Its readiness verdict becomes the executive
 * verdict and its test summary becomes the test counts. Its failure list stays a list
 * of failures rather than being forced into `findings` with an invented severity for
 * each row — a failing assertion is not a severity-ranked defect, and pretending
 * otherwise would put fabricated numbers in the summary tiles.
 */
function fromRollup(result) {
  const readiness = result.releaseReadiness ?? {};
  const tests = result.testSummary ?? {};
  const summaries = result.summaries ?? {};

  return {
    ...result,
    executive: result.executive ?? {
      verdict: readiness.verdict ?? result.classification,
      headline: readiness.rationale ?? result.summary,
      health: summaries.executive ?? null,
    },
    severityCounts: result.severityCounts ?? { critical: 0, high: 0, medium: 0, low: 0 },
    testCases: result.testCases ?? (Object.keys(tests).length > 0
      ? {
        total: tests.total ?? 0,
        passed: tests.passed ?? 0,
        failed: tests.failed ?? 0,
        blocked: tests.blocked ?? 0,
        skipped: tests.skipped ?? 0,
        cases: [],
      }
      : null),
  };
}

/** The exploratory contract is already the internal shape; nothing to translate. */
function fromExplore(result) {
  return result;
}

const NORMALIZERS = Object.freeze({
  'qa-engineer/qa-report': fromCanonical,
  'qa-explore/explore-result': fromExplore,
  'qa-report/report-result': fromRollup,
});

/** Contract names this renderer accepts, for an error message and for `--help`. */
export function supportedContracts() {
  return Object.keys(NORMALIZERS).sort();
}

/**
 * Which producer made this report, for the provenance block.
 *
 * Recorded and displayed, never acted on: the renderer's behaviour must not vary by
 * producer, or the guarantee that two agents produce identical output is only true
 * until someone adds a special case.
 */
export function producerOf(result) {
  const producer = result?.metadata?.producer ?? result?.producer;
  if (producer) {
    return {
      agent: producer.agent ?? null,
      model: producer.model ?? null,
      skill: producer.skill ?? null,
      version: producer.version ?? null,
    };
  }
  if (result?.skill) {
    return { agent: null, model: null, skill: result.skill.name, version: result.skill.version };
  }
  return null;
}

/**
 * Normalize any accepted contract into the internal shape.
 *
 * Throws rather than guessing. A result whose contract is unknown, or whose schema
 * version this renderer has never been tested against, is refused by name — rendering
 * it half-understood would produce a document that looks authoritative and is missing
 * whatever the unknown version added.
 */
export function normalize(result) {
  const name = result?.contract?.name;
  const normalizer = NORMALIZERS[name];

  if (!normalizer) {
    throw new SchemaError(
      `no renderer for contract ${name === undefined ? 'None' : `'${name}'`}; supported: ` +
        `${supportedContracts().join(', ')}`,
    );
  }

  if (!isSupportedSchema(result)) {
    throw new SchemaError(
      `report declares schema version ${schemaVersionOf(result)}, which this renderer ` +
        `does not support; supported: ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}`,
    );
  }

  const normalized = normalizer(result);
  // Provenance survives normalization so the appendix can state who produced the
  // report even when the contract carried it somewhere else.
  return { ...normalized, producer: producerOf(result) };
}
