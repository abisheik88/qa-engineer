// Tests for the diff guard.
//
// The guard sits between "the suite is green" and "the suite was made green", and
// it has two failure modes that pull in opposite directions:
//
//   - A rule that stops firing is a safety hole nobody notices, because the
//     symptom is a *quiet* pass.
//   - A rule that fires on legitimate repair work is worse than no guard: people
//     learn to override it, and then it protects nothing.
//
// So both directions are tested. Every rule has a case that triggers it, and the
// repairs `/qa-fix` legitimately performs have cases proving they stay clean.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkDiff, MASS_DELETION_THRESHOLD } from '../lib/analysis/diff-guard.mjs';

const rules = (diff) => new Set(checkDiff(diff).map((issue) => issue.rule));
const highs = (diff) => checkDiff(diff).filter((issue) => issue.severity === 'high');
const diff = (file, ...lines) => `--- a/${file}\n+++ b/${file}\n${lines.join('\n')}\n`;

test('an empty or documentation-only diff is clean', () => {
  assert.deepEqual(checkDiff(''), []);
  assert.deepEqual(checkDiff(diff('README.md', '+a documentation line')), []);
});

test('every flag explains itself', () => {
  // A flag a reader cannot act on is a flag they will override.
  const issues = checkDiff(diff('t.spec.ts', '-expect(total).toBe(42)', '+test.skip("x", () => {})'));
  assert.ok(issues.length > 0);
  for (const issue of issues) {
    assert.ok(issue.why && issue.why.length > 20, `no explanation: ${issue.rule}`);
    assert.ok(issue.rule && issue.severity && issue.file !== undefined);
  }
});

test('an assertion removed with nothing replacing it is high severity', () => {
  assert.ok(rules(diff('t.spec.ts', '-expect(total).toBe(42)')).has('removed-assertion'));
});

test('an assertion replaced by a weaker one is high severity', () => {
  assert.ok(
    rules(diff('t.spec.ts', '-expect(total).toBe(42)', '+expect(total).toBeTruthy()'))
      .has('weakened-assertion'),
  );
});

test('a hard assertion swapped for a soft one is a weakening', () => {
  // expect.soft does not stop the test, so the failure no longer fails the run.
  assert.ok(
    rules(diff('t.spec.ts', '-expect(total).toBe(42)', '+expect.soft(total).toBe(42)'))
      .has('weakened-assertion'),
  );
});

test('keeping the matcher but dropping the expected value is a weakening', () => {
  const issues = checkDiff(
    diff('t.spec.ts',
      '-expect(page.locator("#total")).toHaveText("42")',
      '+expect(page.locator("#total")).toHaveText(value)'),
  );
  const weakened = issues.find((issue) => issue.rule === 'weakened-assertion');
  assert.ok(weakened);
  // Reported once, not twice: "42" is both a string literal and a number.
  assert.match(weakened.why, /\['42'\]/);
});

test('an inline locator repair is low severity, not high', () => {
  // This is /qa-fix's primary job, in the style Playwright is actually written.
  // Flagging it `high` trains everyone to override the guard, and then it protects
  // nothing. The selector is the assertion's subject, not its expected value.
  const target = diff('e2e/checkout.spec.ts',
    '-  await expect(page.locator("#total")).toHaveText("42");',
    '+  await expect(page.getByTestId("total")).toHaveText("42");');
  assert.deepEqual(highs(target), []);
  assert.ok(rules(target).has('assertion-modified'));
});

test('dropping the real expected value is still high', () => {
  // The scoping must not blind the rule to what it exists for.
  const target = diff('e2e/checkout.spec.ts',
    '-  await expect(page.locator("#total")).toHaveText("42");',
    '+  await expect(page.getByTestId("total")).toHaveText(value);');
  assert.ok(highs(target).length > 0);
  assert.ok(rules(target).has('weakened-assertion'));
});

test('an identical re-added assertion is a move, not a change', () => {
  assert.deepEqual(checkDiff(diff('t.spec.ts', '-expect(total).toBe(42)', '+expect(total).toBe(42)')), []);
});

test('skips, only-markers, and forced passes are high severity', () => {
  assert.ok(rules(diff('t.spec.ts', '+test.skip("checkout", async () => {})')).has('added-skip-or-only'));
  assert.ok(rules(diff('t.spec.ts', '+test.only("checkout", async () => {})')).has('added-skip-or-only'));
  assert.ok(rules(diff('t_test.py', '+@pytest.mark.skip')).has('added-skip-or-only'));
  assert.ok(rules(diff('t.spec.ts', '+expect(true).toBe(true)')).has('forced-pass'));
});

test('an early return in a test file is a skip in disguise', () => {
  assert.ok(rules(diff('t.spec.ts', '+  return;')).has('conditional-skip'));
  assert.ok(rules(diff('t.spec.ts', '+  if (!ready) return;')).has('conditional-skip'));
});

test('an early return in product code is not the guard\'s business', () => {
  assert.ok(!rules(diff('src/app.ts', '+  return;')).has('conditional-skip'));
});

test('excluding specs from the run is caught without any test file changing', () => {
  assert.ok(rules(diff('playwright.config.ts', '+  testIgnore: ["**/checkout.spec.ts"],')).has('suite-exclusion'));
  assert.ok(rules(diff('jest.config.js', '+  testPathIgnorePatterns: ["checkout"],')).has('suite-exclusion'));
});

test('making the command exit zero regardless is caught', () => {
  assert.ok(rules(diff('package.json', '+    "test": "playwright test || true"')).has('forced-pass-command'));
  assert.ok(rules(diff('.github/workflows/ci.yml', '+        continue-on-error: true')).has('forced-pass-command'));
});

test('a swallowed failure is caught, and ordinary error handling is only a warning', () => {
  assert.ok(rules(diff('t.spec.ts', '+  try { await expect(x).toBe(1) } catch {}')).has('swallowed-failure'));
  assert.ok(rules(diff('t_test.py', '+    except AssertionError: pass')).has('swallowed-failure'));

  const handled = checkDiff(diff('t.spec.ts', '+  } catch (error) {'));
  assert.ok(handled.some((issue) => issue.rule === 'added-error-handling'));
  assert.deepEqual(handled.filter((issue) => issue.severity === 'high'), []);
});

test('an emptied test body is caught in both languages', () => {
  assert.ok(rules(diff('t.spec.ts', '+test("checkout", async () => {})')).has('empty-test-body'));
  assert.ok(rules(diff('t_test.py', '+def test_checkout(): pass')).has('empty-test-body'));
});

test('a removed wait is flagged, and the rule is reachable at all', () => {
  // It once was not: its own pattern matched `expect(`, which the assertion branch
  // consumed first.
  assert.ok(rules(diff('t.spec.ts', '-  await page.waitForSelector("#total")')).has('removed-wait'));
});

test('a substantially inflated timeout is flagged; a modest one is not', () => {
  assert.ok(rules(diff('t.spec.ts', '-  timeout: 5000', '+  timeout: 30000')).has('timeout-inflation'));
  assert.ok(!rules(diff('t.spec.ts', '-  timeout: 5000', '+  timeout: 6000')).has('timeout-inflation'));
});

test('a realistic retry increase is flagged', () => {
  // The rule read its number from a shared two-or-more-digit scan, so it could not
  // fire below ten — dead for every value a real config carries.
  assert.ok(rules(diff('playwright.config.ts', '-  retries: 1', '+  retries: 5')).has('unsafe-retry-increase'));
  assert.ok(!rules(diff('playwright.config.ts', '-  retries: 2', '+  retries: 3')).has('unsafe-retry-increase'));
});

test('an inflation rule reads its own number, not the largest on the line', () => {
  assert.ok(
    !rules(diff('c.ts', '-  { timeout: 5000, port: 8080 }', '+  { timeout: 6000, port: 8080 }'))
      .has('timeout-inflation'),
  );
});

test('a deleted test file is flagged regardless of its size', () => {
  const deleted = '--- a/tests/checkout.spec.ts\n+++ /dev/null\n-expect(total).toBe(42)\n';
  const found = rules(deleted);
  assert.ok(found.has('test-file-deleted'));
  // And not double-reported as a removed assertion.
  assert.ok(!found.has('removed-assertion'));
});

test('a deleted non-test file is not the guard\'s business', () => {
  assert.deepEqual(checkDiff('--- a/src/helper.ts\n+++ /dev/null\n-export const x = 1\n'), []);
});

test('mass deletion fires at the threshold and not below it', () => {
  const removals = (count) => Array.from({ length: count }, (_, i) => `-line ${i}`);
  assert.ok(!rules(diff('t.spec.ts', ...removals(MASS_DELETION_THRESHOLD - 1))).has('mass-deletion'));
  assert.ok(rules(diff('t.spec.ts', ...removals(MASS_DELETION_THRESHOLD))).has('mass-deletion'));
});

test('a changed locator is worth confirming, at low severity', () => {
  const changed = diff('t.spec.ts', '-  const el = page.locator("#old")', '+  const el = page.locator(".new")');
  assert.ok(rules(changed).has('suspicious-locator-change'));
  assert.deepEqual(highs(changed), []);
});

test('a sample is trimmed and bounded, so a minified line cannot flood the report', () => {
  const long = `+expect(true).toBe(true) // ${'x'.repeat(500)}`;
  const [issue] = checkDiff(diff('t.spec.ts', long));
  assert.ok(issue.sample.length <= 200);
});
