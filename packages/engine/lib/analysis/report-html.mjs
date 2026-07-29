// Render a contract artifact as a presentation-grade HTML report.
//
// ## What this module is now
//
// A stable entry point. The rendering itself moved to `lib/report/`, which is split
// into theme, components, core, and export — because a single 700-line file could not
// hold an enterprise report and stay reviewable, and because the Markdown, SARIF,
// JUnit, and CSV renderings all need the same view model the HTML uses.
//
// This file stays because it is the *published* seam: `qa-tool.mjs analysis
// report-html` is documented in nine installed skills and in every report-pipeline
// reference. Moving code is cheap; moving a documented command out from under
// installed copies is not.
//
// ## Why the report is rendered rather than typed
//
// The first real `/qa-explore` run on a live application produced a valid artifact and
// a *lossy* report. Every finding in the contract carries `repro`, `actual`,
// `expected`, and `fixDirection` — all four required — and the hand-written HTML
// collapsed them into a single sentence:
//
//     EXP-1 · high — Double-click Login fires two GraphQL auth requests
//     Two identical POSTs to /graphql. Disable Login while in flight.
//
// The reader is left to infer what was expected, how to reproduce it, and what
// "correct" would look like. The data existed; the rendering discarded it.
//
// The second live run produced a beautiful report in which **every screenshot was
// broken**, because the declared paths were relative to the project root and the
// report was written inside the run folder. Both failures have the same cause: a human
// or a model retyping what a renderer should own. So the renderer owns it, and
// `lib/artifacts/manager.mjs` owns the difference between where a file is and how this
// document links to it.
//
// No dependencies, one self-contained file out, no external assets — a report must
// open from an email attachment on a plane.

import fs from 'node:fs';
import path from 'node:path';

import {
  render as renderDocument, ReportError, supportedContracts, supportedModes,
  versionStamp, versionLine,
} from '../report/export/html.mjs';

export { ReportError, supportedContracts, supportedModes, versionStamp, versionLine };

/**
 * Render a full standalone HTML document for a supported artifact.
 *
 * `resultPath` and `outPath` are how evidence links come out correct: the first says
 * what declared paths are relative to, the second says what hrefs must be relative to.
 * Both are optional and both should be supplied — without them every artifact resolves
 * against the process working directory, which is right only by luck.
 */
export function render(result, options = {}) {
  return renderDocument(result, options);
}

/** Read an artifact from disk and render it. */
export function renderFile(file, options = {}) {
  let result;
  try {
    result = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new ReportError(`could not read artifact at ${file}: ${error.message}`);
  }
  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    throw new ReportError(`artifact at ${file} is not a JSON object`);
  }
  return renderDocument(result, {
    ...options,
    resultPath: path.resolve(file),
    outPath: options.outPath ?? null,
  });
}
