// Playwright-specific analyzers: trace and JSON report.
//
// This is the Playwright *adapter* for the analysis platform. It depends on the
// framework-agnostic analysis core for the evidence model, redaction, and the
// failure taxonomy; it adds only what is Playwright-specific — the shape of a
// trace.zip and of Playwright's JSON reporter. Everything it emits is in the shared
// normalized shape, so nothing downstream knows it was Playwright.
//
// Framework knowledge stays inside the adapter: the core never grows a
// `--framework` flag (ADR-0013).

import fs from 'node:fs';

import { MalformedArtifact } from '../analysis/junit.mjs';
import { redactText } from '../analysis/redaction.mjs';
import * as taxonomy from '../analysis/taxonomy.mjs';
import { openZip, isZip, ZipError } from '../analysis/zip.mjs';

export const FRAMEWORK = 'playwright';

/**
 * Parse Playwright's JSON reporter output into the normalized result shape.
 *
 * Mirrors the JUnit parser's output (`{tests, executed}`) so a Playwright run
 * normalizes identically whether it emitted JSON or JUnit.
 */
export function parseReport(path) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (error) {
    throw new MalformedArtifact(`could not parse Playwright report at ${path}: ${error.message}`);
  }

  const executed = [];
  for (const suite of data.suites ?? []) walkSuite(suite, executed);

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

function walkSuite(suite, executed) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const results = test.results ?? [];
      const status = statusOf(results);
      let message = '';
      if (status === 'failed' && results.length > 0) {
        const errors = results[results.length - 1].errors ?? [];
        if (errors.length > 0) {
          message = redactText((errors[0].message ?? '').trim());
        }
      }
      const entry = {
        title: spec.title ?? '',
        file: suite.file ?? '',
        status,
        durationMs: results.length > 0 ? (results[results.length - 1].duration ?? 0) : 0,
        retries: Math.max(0, results.length - 1),
      };
      if (message) entry.message = message;
      executed.push(entry);
    }
  }
  for (const child of suite.suites ?? []) walkSuite(child, executed);
}

function statusOf(results) {
  if (results.length === 0) return 'skipped';
  const final = results[results.length - 1].status;
  if (final === 'passed' || final === 'expected') return results.length > 1 ? 'flaky' : 'passed';
  if (final === 'skipped') return 'skipped';
  return 'failed';
}

/**
 * Extract a deterministic summary from a Playwright trace.zip.
 *
 * A trace is a zip of newline-delimited JSON event files. This lists the actions,
 * surfaces the last error, and counts console and network events — enough for a
 * diagnostic skill to reason over, without decoding the full binary.
 */
export function analyzeTrace(path) {
  let archive;
  try {
    const buffer = fs.readFileSync(path);
    if (!isZip(buffer)) throw new MalformedArtifact(`not a valid trace zip: ${path}`);
    archive = openZip(path);
  } catch (error) {
    if (error instanceof MalformedArtifact) throw error;
    throw new MalformedArtifact(`not a valid trace zip: ${path}`);
  }

  const actions = [];
  const errors = [];
  let console = 0;
  let network = 0;

  try {
    const named = archive.entries.filter(
      (entry) => entry.name.endsWith('.trace') || entry.name.endsWith('.jsonl') || entry.name.includes('trace'),
    );
    for (const entry of named.length > 0 ? named : archive.entries) {
      const text = archive.read(entry).toString('utf8');
      for (const line of text.split('\n')) {
        const raw = line.trim();
        if (!raw || !raw.startsWith('{')) continue;
        let event;
        try {
          event = JSON.parse(raw);
        } catch {
          continue;
        }
        const kind = event.type ?? event.kind;
        if (kind === 'action' || kind === 'before') {
          actions.push(redactText(String(event.apiName ?? event.method ?? '')));
        } else if (kind === 'console') {
          console += 1;
        } else if (kind === 'resource' || kind === 'network' || kind === 'http') {
          network += 1;
        }
        if (event.error || kind === 'error') {
          const message = event.error && typeof event.error === 'object'
            ? event.error.message
            : event.message;
          if (message) errors.push(redactText(String(message)));
        }
      }
    }
  } catch (error) {
    if (error instanceof ZipError) {
      throw new MalformedArtifact(`could not read trace ${path}: ${error.message}`);
    }
    throw error;
  }

  const lastError = errors.length > 0 ? errors[errors.length - 1] : '';
  const classified = lastError
    ? taxonomy.classify(lastError)
    : { classification: taxonomy.UNKNOWN, confidence: 0.2, reason: 'No error found in trace.' };

  return {
    actions: actions.filter(Boolean),
    consoleEvents: console,
    networkEvents: network,
    errors,
    classification: classified.classification,
    confidence: classified.confidence,
    reason: classified.reason,
  };
}
