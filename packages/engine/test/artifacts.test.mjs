// Tests for the artifact-reading half of the engine: HAR, discovery, evidence.
//
// The theme is refusal. Each of these reads a file somebody else produced, and
// the failure mode that matters is not crashing — it is quietly turning a broken
// artifact into a clean-looking measurement, which is how a QA report ends up
// confidently wrong.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parseHarData } from '../lib/analysis/har.mjs';
import { MalformedArtifact } from '../lib/analysis/junit.mjs';
import { discover, integrity, isZipFile } from '../lib/analysis/discovery.mjs';
import { evidence, finding, artifact, analyzerOutput, EVIDENCE_TYPES } from '../lib/analysis/evidence.mjs';
import { validate } from '../lib/analysis/contracts.mjs';

function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-engine-'));
  for (const [relative, contents] of Object.entries(files)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  }
  return root;
}

test('har: summarizes entries and flags failures and slow calls', () => {
  const result = parseHarData(
    {
      log: {
        entries: [
          { request: { method: 'GET', url: 'https://x.test/a' }, response: { status: 200 }, time: 50 },
          { request: { method: 'POST', url: 'https://x.test/b' }, response: { status: 500 }, time: 2000 },
          { request: { method: 'GET', url: 'https://x.test/c' }, response: { status: 0 }, time: 10 },
        ],
      },
    },
    { slowMs: 1000 },
  );
  assert.equal(result.entries.length, 3);
  assert.equal(result.failures.length, 2, 'a 500 and a no-response are both failures');
  assert.equal(result.slow.length, 1);
  assert.equal(result.redacted, true);
});

test('har: credentials in a URL are gone before anything is exposed', () => {
  const result = parseHarData({
    log: { entries: [{ request: { method: 'GET', url: 'https://user:pass@x.test/a?token=abc123' }, response: { status: 200 }, time: 1 }] },
  });
  assert.ok(!result.entries[0].url.includes('pass'));
  assert.ok(!result.entries[0].url.includes('abc123'));
});

test('har: sensitive headers are masked on both request and response', () => {
  const result = parseHarData({
    log: {
      entries: [{
        request: { method: 'GET', url: 'https://x.test', headers: [{ name: 'Authorization', value: 'Bearer abc' }] },
        response: { status: 200, headers: [{ name: 'Set-Cookie', value: 'sid=1' }] },
        time: 1,
      }],
    },
  });
  assert.equal(result.entries[0].requestHeaders[0].value, '[REDACTED:header]');
  assert.equal(result.entries[0].responseHeaders[0].value, '[REDACTED:header]');
});

test('har: a document that is not a HAR is refused', () => {
  for (const bad of [{}, { log: {} }, { log: { entries: 'nope' } }, { log: { entries: [1, 2] } }]) {
    assert.throws(() => parseHarData(bad), MalformedArtifact, JSON.stringify(bad));
  }
});

test('har: an unreadable entry time is refused, not zeroed', () => {
  assert.throws(
    () => parseHarData({ log: { entries: [{ time: 'not-a-number' }] } }),
    MalformedArtifact,
  );
});

test('discovery: finds artifacts by convention and classifies their state', () => {
  const root = tree({
    'results.xml': '<testsuite/>',
    'nested/results.json': '{"ok":true}',
    'broken/report.json': '{not json',
    'empty/results.xml': '',
    'net/session.har': '{"log":{"entries":[]}}',
  });
  try {
    const result = discover({ root });
    const located = (list) => list.map((a) => a.location).sort();
    // An absolute root yields a location relative to it, so the run folder stays
    // portable — the same rule the Python implementation applied.
    assert.deepEqual(located(result.present).filter((l) => l.endsWith('results.xml')), ['results.xml']);
    assert.deepEqual(located(result.present).filter((l) => l.endsWith('.json')), ['nested/results.json']);
    assert.equal(result.partial.length, 1, 'the empty file is partial, not present');
    assert.equal(result.corrupted.length, 1, 'the unparsable JSON is corrupted');
    assert.deepEqual(result.missing, [], 'convention discovery never reports missing');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('discovery: an explicit path that does not exist is reported missing', () => {
  const root = tree({ 'results.xml': '<testsuite/>' });
  try {
    const result = discover({ root, explicit: [path.join(root, 'results.xml'), path.join(root, 'gone.xml')] });
    assert.equal(result.present.length, 1);
    assert.equal(result.missing.length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('discovery: a wildcard does not descend into a dot-directory', () => {
  // Matching `.git` or a tool's cache would report artifacts that are not this
  // run's, and the Python glob it replaces skips them too.
  const root = tree({ '.hidden/results.xml': '<testsuite/>', 'visible/results.xml': '<testsuite/>' });
  try {
    const found = discover({ root }).present.map((a) => a.location);
    assert.equal(found.length, 1);
    assert.ok(found[0].includes('visible'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('discovery: a truncated trace is corrupted, not present', () => {
  // It still starts with the ZIP magic bytes, so a header check would call it
  // intact — which is why the end-of-central-directory record is what gets read.
  const root = tree({});
  const truncated = path.join(root, 'trace.zip');
  fs.writeFileSync(truncated, Buffer.concat([Buffer.from('PK\x03\x04'), Buffer.alloc(40)]));
  const complete = path.join(root, 'good.zip');
  fs.writeFileSync(complete, Buffer.concat([Buffer.alloc(8), Buffer.from('PK\x05\x06'), Buffer.alloc(18)]));
  try {
    assert.equal(isZipFile(truncated), false);
    assert.equal(integrity('trace', truncated), 'corrupted');
    assert.equal(isZipFile(complete), true);
    assert.equal(integrity('trace', complete), 'present');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('discovery: a file that is not there at all is missing, not corrupted', () => {
  assert.equal(integrity('junit', path.join(os.tmpdir(), 'qa-does-not-exist.xml')), 'missing');
});

test('evidence: an excerpt is redacted at construction', () => {
  const entry = evidence({ type: 'log', description: 'runner output', source: 'run.log', excerpt: 'password=hunter2' });
  assert.ok(!entry.excerpt.includes('hunter2'));
});

test('evidence: an unknown type is refused rather than recorded', () => {
  assert.throws(() => evidence({ type: 'vibes', description: 'd', source: 's' }), /unknown evidence type/);
  assert.ok(EVIDENCE_TYPES.has('trace'));
});

test('evidence: an empty excerpt is omitted rather than serialized as empty', () => {
  assert.deepEqual(Object.keys(evidence({ type: 'file', description: 'd', source: 's' })).sort(),
    ['description', 'source', 'type']);
});

test('evidence: a finding omits confidence when none was calibrated', () => {
  const without = finding({ classification: 'timeout', reason: 'r', artifact: 'a', location: 'l' });
  assert.ok(!('confidence' in without));
  const withValue = finding({ classification: 'timeout', reason: 'r', artifact: 'a', location: 'l', confidence: 0.75 });
  assert.equal(withValue.confidence, 0.75);
});

test('evidence: the analyzer envelope carries findings, artifacts, and warnings', () => {
  const output = analyzerOutput({
    analyzer: 'junit',
    findings: [finding({ classification: 'timeout', reason: 'r', artifact: 'a', location: 'l' })],
    artifacts: [artifact({ type: 'junit', location: 'results.xml' })],
    warnings: ['one shard was missing'],
  });
  assert.equal(output.analyzer, 'junit');
  assert.equal(output.findings.length, 1);
  assert.equal(output.artifacts[0].ownership, 'qa-analysis');
  assert.equal(output.warnings.length, 1);
  assert.match(output.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('contracts: enforces the subset and reports an unsupported keyword', () => {
  assert.deepEqual(validate('hello', { type: 'string' }), []);
  assert.equal(validate(5, { type: 'string' }).length, 1);
  const unsupported = validate({}, { type: 'object', uniqueItems: true });
  assert.equal(unsupported.length, 1);
  assert.match(unsupported[0], /unsupported keyword/);
});

test('contracts: a cross-field invariant rejects a result contradicting itself', () => {
  // The rule that stops a "passed" result carrying a non-zero exit code.
  const schema = {
    type: 'object',
    properties: { classification: { type: 'string' }, exitCode: { type: 'integer' } },
    if: { properties: { classification: { const: 'passed' } }, required: ['classification'] },
    then: { properties: { exitCode: { const: 0 } } },
  };
  assert.deepEqual(validate({ classification: 'passed', exitCode: 0 }, schema), []);
  assert.equal(validate({ classification: 'passed', exitCode: 1 }, schema).length, 1);
  assert.deepEqual(validate({ classification: 'failed', exitCode: 1 }, schema), []);
});
