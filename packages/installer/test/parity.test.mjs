// Validator parity (JavaScript side).
//
// The pack ships two validators — Python for output contracts, JavaScript for
// installer config — and documents that "a document that passes one passes the
// other". This test holds up the JavaScript half of that promise against the
// shared corpus in tests/parity/validator-cases.json;
// shared/analysis/lib/tests/test_parity.py holds up the Python half against the
// same file. It also asserts the two keyword sets are literally identical, so a
// keyword added to one validator cannot quietly be missing from the other.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, SUPPORTED_KEYWORDS } from '../lib/core/schema-validate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const corpusPath = path.join(repoRoot, 'tests', 'parity', 'validator-cases.json');
const pythonValidator = path.join(
  repoRoot, 'shared', 'analysis', 'lib', 'qa_analysis', 'contracts.py',
);

test('every parity case matches its expected verdict', () => {
  const { cases } = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  assert.ok(cases.length > 20, 'parity corpus should be meaningful');
  for (const testCase of cases) {
    const errors = validate(testCase.instance, testCase.schema);
    assert.equal(
      errors.length === 0,
      testCase.valid,
      `${testCase.name}: expected valid=${testCase.valid}, errors=${JSON.stringify(errors)}`,
    );
  }
});

test('an unsupported keyword is reported, never silently ignored', () => {
  const errors = validate({}, { type: 'object', anyOf: [{ type: 'object' }] });
  assert.ok(errors.some((e) => e.includes('unsupported keyword')), JSON.stringify(errors));
});

test('the supported keyword set is identical in both validators', () => {
  const source = fs.readFileSync(pythonValidator, 'utf8');
  const block = source.match(/SUPPORTED_KEYWORDS = frozenset\(\{([\s\S]*?)\}\)/);
  assert.ok(block, 'could not find SUPPORTED_KEYWORDS in contracts.py');
  const pythonKeywords = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(
    SUPPORTED_KEYWORDS,
    pythonKeywords,
    'validator keyword sets have drifted between Python and JavaScript',
  );
});

test('the runtime invariant rejects a hallucinated-green execution result', () => {
  const schema = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, 'skills', 'qa-run', 'contracts', 'execution-result.schema.json'),
      'utf8',
    ),
  );
  const base = {
    contract: { name: 'qa-run/execution-result', version: '1.0.0' },
    skill: { name: 'qa-run', version: '0.2.0' },
    generatedAt: '2026-07-24T10:05:03Z',
    summary: 'Smoke run.',
    classification: 'passed',
    evidence: [{ type: 'command', description: 'Runner exited zero', source: 'exit code 0' }],
    execution: { strategy: 'smoke', command: 'npx playwright test', exitCode: 0 },
    framework: { name: 'playwright' },
    tests: { total: 2, passed: 2, failed: 0, skipped: 0 },
    artifacts: [],
    environment: { location: 'local', headless: true },
  };
  assert.deepEqual(validate(base, schema), [], 'an honest pass must validate');

  const hallucinated = structuredClone(base);
  hallucinated.execution.exitCode = 1;
  hallucinated.tests = { total: 12, passed: 11, failed: 1, skipped: 0 };
  assert.ok(
    validate(hallucinated, schema).length > 0,
    'passed + exitCode 1 + failed 1 must not validate',
  );
});
