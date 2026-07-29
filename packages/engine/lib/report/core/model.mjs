// Contract artifact → view model.
//
// Every renderer reads this shape, never the raw artifact. One place therefore owns
// the questions that would otherwise be answered slightly differently in eight
// sections: which verdict applies when `executive` is absent, what counts as a
// "covered" dimension, what the subject line of the report is, and — the one that
// matters most — what may be *derived* versus what must be *measured*.
//
// ## Derivation discipline
//
// A report is trusted because its numbers came from somewhere. So:
//
//   derived  — the overall score (a fixed function of severity counts), dimension
//              filter counts, page/finding association, totals, the fallback verdict
//   measured — every performance number, every score the producer supplied,
//              artifact existence, request timings
//
// Nothing here invents a measurement. If a run never checked accessibility there is
// no accessibility score, and the report says the area was not examined rather than
// printing a plausible number. A fabricated 87 is worse than a blank, because the
// blank prompts a question and the 87 ends one.

import path from 'node:path';

import { createRegistry } from '../../artifacts/manager.mjs';
import { VERDICT, SEVERITY_ORDER } from '../theme/tokens.mjs';
import { DIMENSION_LABEL } from '../components/findings.mjs';
import { normalize } from './normalize.mjs';
import { versionStamp } from '../version.mjs';

/**
 * What the report is *about*, short enough to be a heading.
 *
 * The contract has no title field on a 1.0 result and the summary is a paragraph —
 * using it as an `<h1>` produced a five-line heading. The host is the honest short
 * answer, the way Lighthouse titles a report by its URL.
 */
export function subjectOf(result) {
  if (result.title) return String(result.title);
  const url = String(result.url ?? '').trim();
  if (url) {
    const withoutScheme = url.includes('://') ? url.slice(url.indexOf('://') + 3) : url;
    return withoutScheme.replace(/\/+$/, '') || url;
  }
  return String(result.summary ?? 'QA report').split('.')[0].slice(0, 80);
}

/**
 * The release decision.
 *
 * `executive.verdict` is authoritative when the run supplied one. Otherwise the
 * classification maps onto the same surface, so a 1.0 result still renders a verdict
 * banner instead of an empty strip. The severity counts are the last resort and the
 * safest one: any critical means do-not-ship, whatever the prose says.
 */
export function verdictOf(result) {
  const executive = result.executive ?? {};
  let key = executive.verdict;

  if (!key) {
    const counts = result.severityCounts ?? {};
    if (result.classification === 'blocked') key = 'blocked';
    else if (result.classification === 'insufficient-data') key = 'insufficient-data';
    else if ((counts.critical ?? 0) > 0) key = 'do-not-ship';
    else if ((counts.high ?? 0) > 0) key = 'ship-with-risks';
    else key = result.classification === 'pass' ? 'pass' : 'issues-found';
  }

  const spec = VERDICT[key] ?? VERDICT['insufficient-data'];
  return {
    key,
    label: spec.label,
    tone: spec.tone,
    blurb: executive.headline ?? spec.blurb,
    headline: executive.headline ?? null,
    health: executive.health ?? null,
    risks: executive.risks ?? [],
    recommendedAction: executive.recommendedAction ?? null,
    estimatedFixHours: executive.estimatedFixHours ?? null,
    confidence: Number.isFinite(executive.confidence) ? executive.confidence : null,
    // True when nothing in the artifact stated a verdict and this one was inferred.
    inferred: !executive.verdict,
  };
}

/**
 * An overall score from severity counts.
 *
 * Deliberately a fixed, published function rather than a judgement: a critical costs
 * 35 points, a high 12, a medium 4, a low 1, floored at zero. Two runs of the same
 * application produce the same number, and a reader can check the arithmetic. It is
 * shown as "derived" precisely so nobody mistakes it for a measurement.
 */
export function deriveOverall(counts) {
  const penalty =
    (counts.critical ?? 0) * 35 + (counts.high ?? 0) * 12 + (counts.medium ?? 0) * 4 + (counts.low ?? 0) * 1;
  return Math.max(0, 100 - penalty);
}

/** Dimension facets for the filter bar, counted from the findings themselves. */
function dimensionFacets(findings) {
  const counts = new Map();
  for (const finding of findings) {
    const key = finding.dimension;
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ key, label: DIMENSION_LABEL[key] ?? key, count }));
}

/**
 * The boundary of the run, assembled from what was declared and what is derivable.
 *
 * An unstated boundary reads as "everything was checked". Blocked cases and unrun
 * dimensions are boundaries the artifact already knows about, so they are added to
 * whatever the run declared rather than left to the producer to remember.
 */
function notCovered(result) {
  const items = [...(result.scope?.notCovered ?? []).map(String)];
  const ran = new Set(result.dimensionsRun ?? []);

  if (ran.size > 0) {
    for (const [key, label] of Object.entries(DIMENSION_LABEL)) {
      if (ran.has(key)) continue;
      items.push(`${label} was not examined in this run.`);
    }
  }

  const db = result.dbValidation ?? {};
  if (db.inScope === false && !db.summary) {
    items.push('Data was not compared against the system of record — no access was provided.');
  }

  const blocked = (result.testCases?.cases ?? []).filter((testCase) => testCase.status === 'blocked');
  if (blocked.length > 0) {
    items.push(`Could not be run: ${blocked.map((c) => `${c.id} (${c.title})`).join(', ')}`);
  }

  return items;
}

/**
 * Requests worth showing, ranked by how much trouble they represent.
 *
 * A raw endpoint list sorted by URL buries the 4-second call among ninety static
 * assets. Failures first, then slow, then everything flagged with any issue.
 */
function rankEndpoints(endpoints) {
  const weight = (endpoint) => {
    if (endpoint.issue === 'failed' || Number(endpoint.status) >= 500) return 0;
    if (Number(endpoint.status) >= 400) return 1;
    if (endpoint.issue === 'slow') return 2;
    if (endpoint.issue) return 3;
    return 4;
  };
  return [...endpoints].sort(
    (a, b) => weight(a) - weight(b) || (Number(b.durationMs) || 0) - (Number(a.durationMs) || 0),
  );
}

/**
 * Build the view model.
 *
 * `resultPath` locates the artifact on disk so evidence paths resolve against the
 * right directory; `outPath` is where the document will be written, which is what
 * every href is made relative to. They are usually the same directory and must never
 * be assumed to be.
 */
export function buildModel(input, options = {}) {
  // Whatever the producer's contract, it becomes one shape here — and it is refused by
  // name if this renderer has never been tested against it.
  const result = normalize(input);

  const resultPath = options.resultPath ? path.resolve(options.resultPath) : null;
  const baseDir = options.baseDir
    ? path.resolve(options.baseDir)
    : resultPath
      ? path.dirname(resultPath)
      : process.cwd();
  const outDir = options.outPath ? path.dirname(path.resolve(options.outPath)) : baseDir;

  const registry = createRegistry(result, {
    baseDir,
    outDir,
    hash: options.hash !== false,
    embed: options.embed === true,
    embedLimit: options.embedLimit,
    // Set by the bundler, which copies evidence into its own tree and needs every link
    // pointed at the copy rather than at wherever the file was found.
    hrefMap: options.hrefMap ?? null,
  });

  const findings = [...(result.findings ?? [])];
  const counts = result.severityCounts ?? { critical: 0, high: 0, medium: 0, low: 0 };
  const testCases = result.testCases ?? null;
  const suppliedScores = result.scores ?? {};

  const scores = { ...suppliedScores };
  const overallDerived = !Number.isFinite(suppliedScores.overall);
  if (overallDerived) scores.overall = deriveOverall(counts);

  const network = result.network ?? null;
  const endpoints = rankEndpoints(network?.endpoints ?? []);

  return {
    // Identity
    title: result.title ?? null,
    subject: subjectOf(result),
    url: result.url ?? null,
    summary: result.summary ?? '',
    generatedAt: result.generatedAt ?? null,
    environment: result.environment ?? null,
    reportVersion: result.reportVersion ?? null,
    browserAdapter: result.browserAdapter ?? null,
    durationMs: Number.isFinite(result.durationMs) ? result.durationMs : null,
    contract: result.contract ?? null,
    skill: result.skill ?? null,

    // Decision
    classification: result.classification ?? null,
    verdict: verdictOf(result),
    scores,
    overallDerived,

    // Findings
    findings,
    severityCounts: counts,
    totalFindings: SEVERITY_ORDER.reduce((sum, key) => sum + (counts[key] ?? 0), 0),
    dimensions: dimensionFacets(findings),

    // Coverage
    scope: result.scope ?? null,
    dimensionsRun: result.dimensionsRun ?? [],
    notCovered: notCovered(result),
    testCases,
    pages: result.pages ?? [],
    authentication: result.authentication ?? null,

    // Analysis
    timeline: result.timeline ?? [],
    network: network ? { ...network, endpoints } : null,
    performance: result.performance ?? null,
    accessibility: result.accessibility ?? null,
    security: result.security ?? null,
    console: result.console ?? null,
    dbValidation: result.dbValidation ?? null,

    // Release rollup only: the per-test failure list and the two written summaries.
    failures: result.failureSummary ?? [],
    summaries: result.summaries ?? null,

    // Guidance
    whatWorksWell: result.whatWorksWell ?? [],
    fixOrder: result.fixOrder ?? [],
    recommendations: result.recommendations ?? [],

    // Evidence
    registry,
    evidence: result.evidence ?? [],
    artifactStats: registry.stats(),

    // Provenance, for the appendix. `producer` is displayed and never branched on:
    // the renderer must behave identically whoever made the report.
    producer: result.producer ?? null,
    versions: versionStamp(),
    paths: { resultPath, baseDir, outDir },
  };
}
