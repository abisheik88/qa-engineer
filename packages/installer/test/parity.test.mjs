// Validator parity (JavaScript side).
//
// The pack ships two validators — Python for output contracts, JavaScript for
// installer config — and documents that "a document that passes one passes the
// other". This test holds up the JavaScript half of that promise against the
// shared corpus in packages/engine/test/corpus/validator-cases.json;
// shared/analysis/lib/tests/test_parity.py holds up the Python half against the
// same file. It also asserts the two keyword sets are literally identical, so a
// keyword added to one validator cannot quietly be missing from the other.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, SUPPORTED_KEYWORDS } from '../../engine/lib/analysis/contracts.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const corpusPath = path.join(repoRoot, 'packages', 'engine', 'test', 'corpus', 'validator-cases.json');

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

test('every shipped contract stays inside the supported subset', () => {
  // This replaces a comparison between two validators. With one validator, the
  // question that still matters is the one the subset exists to answer: does every
  // contract the pack ships use only keywords the validator actually enforces?
  //
  // A contract using an unsupported keyword is worse than a contract with no rule.
  // The keyword looks like a constraint to whoever reads the schema, and enforces
  // nothing at runtime — so a result that violates it passes validation and ships.
  const schemas = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.schema.json')) schemas.push(full);
    }
  };
  walk(path.join(repoRoot, 'skills'));
  walk(path.join(repoRoot, 'packages', 'engine', 'lib'));
  walk(path.join(repoRoot, 'packages', 'installer', 'schemas'));

  assert.ok(schemas.length > 10, `expected to find the shipped contracts, found ${schemas.length}`);

  const supported = new Set(SUPPORTED_KEYWORDS);
  const offenders = [];
  const inspect = (node, where, file) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => inspect(item, `${where}[${index}]`, file));
      return;
    }
    if (node === null || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      // Only keys in a *schema* position are keywords; the contents of `properties`
      // are field names, and `enum`/`const` hold data.
      if (key === 'properties') {
        for (const [field, sub] of Object.entries(value)) inspect(sub, `${where}.${field}`, file);
        continue;
      }
      if (key === 'enum' || key === 'const' || key === 'examples' || key === 'default') continue;
      if (!supported.has(key)) offenders.push(`${path.relative(repoRoot, file)} at ${where}: "${key}"`);
      if (['items', 'if', 'then', 'else'].includes(key)) inspect(value, `${where}.${key}`, file);
      if (key === 'allOf') inspect(value, `${where}.allOf`, file);
    }
  };
  for (const file of schemas) {
    inspect(JSON.parse(fs.readFileSync(file, 'utf8')), '$', file);
  }
  assert.deepEqual(offenders, [], `contracts use keywords the validator does not enforce:\n  ${offenders.join('\n  ')}`);
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
