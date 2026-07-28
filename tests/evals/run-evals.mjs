#!/usr/bin/env node
// Deterministic behavioral-evaluation harness.
//
// Scores skill outputs against their contracts and case-specific assertions. It is
// the CI-gating, deterministic layer of the eval framework described in README.md:
// "deterministic assertions gate; judgment is advisory."
//
// Two kinds of case:
//
//   - **golden** — an output that represents correct behavior. It MUST validate
//     against the skill's contract and satisfy every assertion. A golden case that
//     stops passing is a regression.
//   - **adversarial** — an output that represents a failure mode the pack promises
//     to prevent (a run reported "passed" with a non-zero exit code; a "fix" that
//     removes an assertion; a report that says "ready" with failing tests). The
//     scorer MUST reject it — contract-invalid, or an assertion must fail. An
//     adversarial output that slips through is a scorer blind spot, and fails CI.
//
// This layer needs no live agent, so it runs deterministically in CI. When a live
// agent runner captures real agent output for the same cases, it feeds those outputs
// into this same scorer — the cases and assertions do not change.
//
// Reuses the pack's contract validator; no second schema engine.
//
//   node tests/evals/run-evals.mjs            run all cases, gate on failure
//   node tests/evals/run-evals.mjs --json     machine-readable report to stdout
//   node tests/evals/run-evals.mjs --skill qa-run

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../../packages/engine/lib/analysis/contracts.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');

// A distinct marker for "the path does not exist", which is not the same as a path
// that exists and holds null.
const MISSING = Symbol('missing');

/** Resolve a dotted path (object keys and integer array indices), or MISSING. */
function resolvePath(value, dotted) {
  if (dotted === '') return value;
  let current = value;
  for (const segment of dotted.split('.')) {
    if (Array.isArray(current)) {
      if (!/^-?\d+$/.test(segment)) return MISSING;
      const index = Number.parseInt(segment, 10);
      if (index < 0 || index >= current.length) return MISSING;
      current = current[index];
    } else if (current !== null && typeof current === 'object') {
      if (!Object.prototype.hasOwnProperty.call(current, segment)) return MISSING;
      current = current[segment];
    } else {
      return MISSING;
    }
  }
  return current;
}

/** Python's truthiness for the values an assertion calls "empty". */
function isEmpty(value) {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Return `[ok, message]` for one assertion against the output. */
function checkAssertion(output, assertion) {
  // anyOf passes if any sub-assertion passes. It lets a case express an implication
  // like "reported passed => exit code 0" as two alternatives.
  if ('anyOf' in assertion) {
    const results = assertion.anyOf.map((sub) => checkAssertion(output, sub));
    const ok = results.some(([passed]) => passed);
    return [ok, `anyOf unsatisfied: ${results.filter(([p]) => !p).map(([, m]) => m).join('; ')}`];
  }

  const dotted = assertion.path ?? '';
  const actual = resolvePath(output, dotted);

  if ('present' in assertion) {
    const present = actual !== MISSING && !isEmpty(actual);
    return [
      present === Boolean(assertion.present),
      `${dotted}: present expected ${assertion.present}, got ${actual === MISSING ? 'absent' : 'present'}`,
    ];
  }
  if ('absent' in assertion) {
    const absent = actual === MISSING || isEmpty(actual);
    return [absent === Boolean(assertion.absent), `${dotted}: absent expected ${assertion.absent}`];
  }

  if (actual === MISSING) return [false, `${dotted}: path not found`];

  if ('equals' in assertion) {
    return [same(actual, assertion.equals), `${dotted}: expected ${JSON.stringify(assertion.equals)}, got ${JSON.stringify(actual)}`];
  }
  if ('notEquals' in assertion) {
    return [!same(actual, assertion.notEquals), `${dotted}: must not equal ${JSON.stringify(assertion.notEquals)}`];
  }
  if ('in' in assertion) {
    return [assertion.in.some((option) => same(option, actual)), `${dotted}: ${JSON.stringify(actual)} not in ${JSON.stringify(assertion.in)}`];
  }
  if ('gte' in assertion) {
    return [typeof actual === 'number' && actual >= assertion.gte, `${dotted}: ${JSON.stringify(actual)} not >= ${assertion.gte}`];
  }
  if ('lte' in assertion) {
    return [typeof actual === 'number' && actual <= assertion.lte, `${dotted}: ${JSON.stringify(actual)} not <= ${assertion.lte}`];
  }
  if ('minItems' in assertion) {
    return [Array.isArray(actual) && actual.length >= assertion.minItems, `${dotted}: fewer than ${assertion.minItems} items`];
  }
  if ('contains' in assertion) {
    return [
      typeof actual === 'string' && actual.toLowerCase().includes(assertion.contains.toLowerCase()),
      `${dotted}: does not contain ${JSON.stringify(assertion.contains)}`,
    ];
  }
  if ('notContains' in assertion) {
    const text = typeof actual === 'string' ? actual : JSON.stringify(actual);
    return [
      !text.toLowerCase().includes(assertion.notContains.toLowerCase()),
      `${dotted}: must not contain ${JSON.stringify(assertion.notContains)}`,
    ];
  }
  if ('noneContains' in assertion) {
    // For arrays of strings: no element may contain the substring.
    const needle = assertion.noneContains.toLowerCase();
    const items = Array.isArray(actual) ? actual : [actual];
    const bad = items.filter((item) => typeof item === 'string' && item.toLowerCase().includes(needle));
    return [bad.length === 0, `${dotted}: an item contains forbidden ${JSON.stringify(assertion.noneContains)}: ${JSON.stringify(bad)}`];
  }

  return [false, `${dotted}: unknown assertion ${JSON.stringify(assertion)}`];
}

/** The output under test: inline `output`, or loaded from `goldenFile`. */
function loadOutput(testCase) {
  if ('output' in testCase) return testCase.output;
  return JSON.parse(fs.readFileSync(path.join(here, testCase.goldenFile), 'utf8'));
}

/** Evaluate one case. */
export function scoreCase(testCase) {
  const skill = testCase.skill;
  const kind = testCase.kind ?? 'golden';
  const output = loadOutput(testCase);

  const schema = JSON.parse(fs.readFileSync(path.join(repo, testCase.contract), 'utf8'));
  const contractErrors = validate(output, schema);
  const contractOk = contractErrors.length === 0;

  const assertions = [...(testCase.assertions ?? [])];
  if ('minConfidence' in testCase) {
    assertions.push({ path: 'confidence', gte: testCase.minConfidence });
  }

  const checks = assertions.map((assertion) => [assertion, ...checkAssertion(output, assertion)]);
  const assertionsPassed = checks.filter(([, ok]) => ok).length;
  const assertionsTotal = checks.length;
  const failures = checks.filter(([, ok]) => !ok).map(([, , message]) => message);

  // A "good" output = valid contract AND all assertions hold.
  const good = contractOk && failures.length === 0;

  let passed;
  let score;
  let detail;
  if (kind === 'golden') {
    passed = good;
    score = (contractOk ? 1 : 0) * (assertionsTotal ? assertionsPassed / assertionsTotal : 1);
    detail = failures.length > 0 ? failures : (contractOk ? [] : contractErrors);
  } else if (kind === 'adversarial') {
    // The scorer must REJECT this output.
    passed = !good;
    score = passed ? 1 : 0;
    detail = passed ? [] : ['scorer accepted an output it should have rejected'];
  } else {
    return { id: testCase.id, skill, kind, passed: false, score: 0, detail: [`unknown kind '${kind}'`] };
  }

  return {
    id: testCase.id ?? '?',
    skill,
    kind,
    passed,
    score: Math.round(score * 1000) / 1000,
    contractValid: contractOk,
    assertions: `${assertionsPassed}/${assertionsTotal}`,
    detail,
  };
}

/** Every case file: one level down, plus anything under safety/. */
export function discover(skillFilter = null) {
  const found = [];
  const walk = (dir, depth) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth < 3) walk(full, depth + 1);
      } else if (entry.name.endsWith('.case.json')) {
        found.push(full);
      }
    }
  };
  walk(here, 0);

  const cases = [];
  for (const file of found.sort()) {
    const testCase = JSON.parse(fs.readFileSync(file, 'utf8'));
    testCase.id ??= path.basename(file).replace(/\.case\.json$/, '');
    if (skillFilter && testCase.skill !== skillFilter) continue;
    cases.push(testCase);
  }
  return cases;
}

function main(argv) {
  const asJson = argv.includes('--json');
  const skillIndex = argv.indexOf('--skill');
  const skill = skillIndex === -1 ? null : argv[skillIndex + 1];

  const results = discover(skill).map((testCase) => scoreCase(testCase));

  const bySkill = {};
  for (const result of results) {
    bySkill[result.skill] ??= { passed: 0, total: 0 };
    bySkill[result.skill].total += 1;
    if (result.passed) bySkill[result.skill].passed += 1;
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const golden = results.filter((r) => r.kind === 'golden').length;
  const adversarial = results.filter((r) => r.kind === 'adversarial').length;

  if (asJson) {
    process.stdout.write(`${JSON.stringify({
      total, passed, failed: total - passed, golden, adversarial, bySkill, cases: results,
    }, null, 2)}\n`);
  } else {
    for (const result of results) {
      const mark = result.passed ? 'ok  ' : 'FAIL';
      process.stdout.write(
        `  ${mark} [${result.kind.padEnd(11)}] ${result.id.padEnd(34)} ` +
          `contract=${(result.contractValid ? 'ok' : 'invalid').padEnd(7)} assertions=${result.assertions}\n`,
      );
      for (const line of result.detail) process.stdout.write(`         - ${line}\n`);
    }
    process.stdout.write(
      `\nrun-evals: ${passed}/${total} cases passed ` +
        `(${golden} golden, ${adversarial} adversarial) across ${Object.keys(bySkill).length} skill(s)\n`,
    );
  }

  return passed === total ? 0 : 1;
}

// Only gate when invoked directly. The live runner imports scoreCase from here and
// must not trigger a whole eval run as a side effect of importing it.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
