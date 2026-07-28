// JUnit XML parser.
//
// Framework-agnostic: Playwright, Selenium, Cypress, WebdriverIO, and most unit
// runners emit JUnit XML, so this one parser normalizes them all into the pack's
// per-test result shape. This is the concrete proof that different frameworks
// share one contract — only where the file lives differs, not how it is read.
//
// Parses deterministically; a malformed document raises rather than guessing.

import fs from 'node:fs';

import { parseXml, find, findAll, XmlError } from './xml.mjs';
import { redactText } from './redaction.mjs';

/** Raised when an artifact cannot be parsed. Never swallowed into a guess. */
export class MalformedArtifact extends Error {}

/**
 * Parse JUnit XML text into a normalized result.
 *
 * `{tests: {total, passed, failed, skipped}, executed: [...]}`, where each
 * executed entry is `{title, file, status, durationMs, message?}`.
 */
export function parseJUnitText(source, label = '<input>') {
  let root;
  try {
    root = parseXml(source);
  } catch (error) {
    if (error instanceof XmlError) {
      throw new MalformedArtifact(`could not parse JUnit XML at ${label}: ${error.message}`);
    }
    throw error;
  }

  // Accept either a <testsuites> root or a single <testsuite> root.
  let suites;
  if (root.tag === 'testsuites') suites = findAll(root, 'testsuite');
  else if (root.tag === 'testsuite') suites = [root];
  else throw new MalformedArtifact(`not a JUnit document (root <${root.tag}>) at ${label}`);

  const executed = [];
  for (const suite of suites) {
    for (const testcase of findAll(suite, 'testcase')) {
      const failure = find(testcase, 'failure');
      const error = find(testcase, 'error');
      const skipped = find(testcase, 'skipped');

      let status;
      let message = '';
      if (failure !== null || error !== null) {
        status = 'failed';
        const node = failure !== null ? failure : error;
        message = redactText((node.attrs.message || node.text || '').trim());
      } else if (skipped !== null) {
        status = 'skipped';
        message = redactText((skipped.attrs.message || '').trim());
      } else {
        status = 'passed';
      }

      const entry = {
        title: testcase.attrs.name ?? '',
        file: testcase.attrs.classname ?? '',
        status,
        durationMs: durationMs(testcase.attrs.time, label),
      };
      if (message) entry.message = message;
      executed.push(entry);
    }
  }

  return {
    tests: {
      total: executed.length,
      passed: executed.filter((e) => e.status === 'passed').length,
      failed: executed.filter((e) => e.status === 'failed').length,
      skipped: executed.filter((e) => e.status === 'skipped').length,
    },
    executed,
  };
}

/**
 * `time` in seconds becomes whole milliseconds.
 *
 * Two subtleties, both pinned by the parity corpus:
 *
 * 1. An absent or empty attribute is zero; a value that is present but not a
 *    finite number raises. Guessing zero there would turn a malformed document
 *    into a plausible result, which is the one thing this parser must not do.
 * 2. Python's `round()` rounds half to *even* and JavaScript's `Math.round`
 *    rounds half *up*, so `time="0.0005"` gives 0 in Python and 1 here unless
 *    the tie is broken the same way. Runners do emit such values.
 */
function durationMs(raw, label) {
  if (raw === undefined || raw === null || raw === '') return 0;
  // Reject what parseFloat would happily truncate ("1.2.3", "5s", "0x10").
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(String(raw).trim())) {
    throw new MalformedArtifact(`testcase time='${raw}' is not a number at ${label}`);
  }
  const seconds = Number(raw);
  if (!Number.isFinite(seconds)) {
    throw new MalformedArtifact(`testcase time='${raw}' is not a finite number at ${label}`);
  }
  return roundHalfToEven(seconds * 1000);
}

/** Python's rounding rule, so a `.5` boundary lands on the same integer. */
function roundHalfToEven(value) {
  const floor = Math.floor(value);
  const remainder = value - floor;
  if (remainder > 0.5) return floor + 1;
  if (remainder < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** Read and parse a JUnit XML file from disk. */
export function parseJUnit(path) {
  let source;
  try {
    source = fs.readFileSync(path, 'utf8');
  } catch (error) {
    throw new MalformedArtifact(`could not parse JUnit XML at ${path}: ${error.message}`);
  }
  return parseJUnitText(source, path);
}
