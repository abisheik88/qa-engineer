// The JUnit-XML frameworks: Selenium, Cypress, WebdriverIO.
//
// All three emit JUnit XML, so their normalization *is* the framework-agnostic JUnit
// parser — each adapter only points at the right artifact and tags provenance. That
// thinness is the proof of the pack's multi-framework claim: the second, third and
// fourth frameworks cost a few lines each, because the contract and the parsing are
// shared and only the artifact location differs (ADR-0013).
//
// The three lived in separate Python modules that were identical but for a name and
// a glob list. Here they are one table, because three copies of the same four lines
// is three places for them to drift.

import { parseJUnit } from '../analysis/junit.mjs';
import { classify } from '../analysis/taxonomy.mjs';

/** framework -> where that framework's runners conventionally write JUnit XML. */
export const RESULT_GLOBS = {
  selenium: ['**/target/surefire-reports/*.xml', '**/test-results/*.xml', '**/junit*.xml'],
  cypress: ['**/results/*.xml', '**/cypress/results/*.xml', '**/junit*.xml'],
  webdriverio: ['**/junit*.xml', '**/results/*.xml', '**/test-results/*.xml'],
};

export const FRAMEWORKS = Object.keys(RESULT_GLOBS);

/**
 * Normalize a run into the shared result shape.
 *
 * Identical output for every framework — that is the point. The `framework`
 * argument selects nothing in the parsing; it exists so a caller can be explicit
 * about provenance and so an unknown name is refused rather than silently treated
 * as one of the three.
 */
export function normalize(framework, junitPath) {
  if (!Object.prototype.hasOwnProperty.call(RESULT_GLOBS, framework)) {
    throw new Error(`unknown JUnit framework: ${framework} (known: ${FRAMEWORKS.join(', ')})`);
  }
  return parseJUnit(junitPath);
}

/**
 * Classify a failure using the shared taxonomy.
 *
 * There is no per-framework classifier, because failure classes are
 * framework-agnostic: a missing element is a locator failure whoever reported it.
 */
export function classifyFailure(message, httpStatus = null) {
  return classify(message, httpStatus);
}
