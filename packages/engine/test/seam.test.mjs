// Seam regression tests: Analysis → Diagnostics internal contracts.
//
// The two halves of the engine talk through JSON, not function calls, so the shape
// of what crosses between them is the interface. A change on the analysis side that
// the diagnostics side cannot read is not a type error anybody sees — it is a
// diagnosis that quietly stops matching its own schema.
//
// These held the seam when the two halves were separate Python packages. They still
// do, for the same reason: the internal contracts are enforced at runtime, and a
// test that exercises them is the only thing proving that enforcement fires.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as taxonomy from '../lib/analysis/taxonomy.mjs';
import { diagnose, planRepairs, summarize } from '../lib/diagnostics/engine.mjs';
import {
  InternalContractError,
  validateAnalysisResult,
  validateExecutionResultMin,
  validateDiagnosis,
  schemaDir,
} from '../lib/diagnostics/internal-contracts.mjs';

const failingRun = {
  tests: { passed: 0, failed: 1, flaky: 0, skipped: 0 },
  executed: [{ title: 'login', status: 'failed', message: 'no such element', file: 'login.spec.ts' }],
};

test('seam: a diagnosis validates against the internal schema it declares', () => {
  // diagnose() validates before returning, so reaching this line is the assertion —
  // but it is stated explicitly, because a future refactor could drop that call and
  // nothing else would notice.
  const diagnosis = diagnose(failingRun);
  assert.deepEqual(validateDiagnosis(diagnosis), diagnosis);
  assert.ok(diagnosis.entries.length > 0);
});

test('seam: the analysis classification crosses over intact', () => {
  const diagnosis = diagnose(failingRun, {
    analysisResult: {
      findings: [{
        classification: taxonomy.APPLICATION_BUG,
        confidence: 0.9,
        reason: 'The API returned 500 for a valid request.',
        affectedTests: ['login'],
        evidence: [{ type: 'network', description: 'POST /login 500', source: 'net.har' }],
      }],
    },
  });
  assert.equal(diagnosis.entries[0].rootCause.classification, taxonomy.APPLICATION_BUG);
  assert.equal(diagnosis.entries[0].rootCause.ownership, 'product');
  // And a product bug is not something the pack offers to "repair".
  assert.equal(planRepairs(diagnosis)[0].repairable, false);
});

test('seam: a payload of the wrong shape is refused', () => {
  // The minimal execution schema is deliberately permissive about what is *absent* —
  // callers pass a subset — but strict about what is present, so a wrong type in a
  // field the engine reads cannot slip through.
  assert.throws(() => validateExecutionResultMin({ tests: { passed: 'two' } }), InternalContractError);
  assert.throws(() => validateExecutionResultMin({ executed: [{ status: 'invented' }] }), InternalContractError);
  assert.throws(() => validateExecutionResultMin({ executed: [{ title: 'no status' }] }), InternalContractError);

  // The analysis schema does require its findings, because the engine has nothing
  // to work from without them.
  assert.throws(() => validateAnalysisResult({}), InternalContractError);
  assert.throws(() => validateAnalysisResult({ findings: 'not a list' }), InternalContractError);
  assert.throws(() => validateAnalysisResult({ findings: [{ classification: 'x' }] }), InternalContractError);
});

test('seam: a subset execution result is accepted, because callers pass subsets', () => {
  assert.doesNotThrow(() => validateExecutionResultMin({ tests: { failed: 1 } }));
  assert.doesNotThrow(() => validateExecutionResultMin({ executed: [{ status: 'passed' }] }));
});

test('seam: a hand-edited diagnosis is refused rather than half-understood', () => {
  const diagnosis = diagnose(failingRun);
  const tampered = { ...diagnosis, entries: [{ rootCause: { classification: 'invented' } }] };
  assert.throws(() => validateDiagnosis(tampered), InternalContractError);
});

test('seam: the internal schemas travel with the engine', () => {
  // If they do not, every diagnosis raises at runtime in an installed skill — the
  // failure the bundled-data check exists to prevent.
  assert.match(schemaDir(), /diagnostics[\\/]schemas[\\/]internal$/);
});

test('seam: a clean run summarizes as ready, with nothing to repair', () => {
  const clean = { tests: { total: 2, passed: 2, failed: 0, skipped: 0 }, executed: [] };
  const diagnosis = diagnose(clean);
  assert.deepEqual(diagnosis.entries, []);
  assert.equal(summarize(clean, diagnosis).releaseReadiness, 'ready');
  assert.deepEqual(planRepairs(diagnosis), []);
});
