// HAR → the report's `network` block.
//
// The point of these tests is the boundary the module exists to enforce: a *fact* read
// from the HAR must be exact, and an *inference* must fire only under its stated rule.
// A detector that flags too eagerly is worse than one that flags too little — a section
// full of false positives is a section readers learn to skip, and then the real finding
// in the middle of it goes unread too.

import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeHarData, analyzeEntries, templatePath, DEFAULTS } from '../lib/analysis/network.mjs';

const T0 = Date.parse('2026-07-29T10:00:00.000Z');
const at = (ms) => new Date(T0 + ms).toISOString();

/** One HAR entry. `size` of null means the HAR did not record a size. */
function entry(method, url, status, time, startedMs, size = 100, headers = []) {
  return {
    startedDateTime: at(startedMs),
    time,
    request: { method, url, headers: [] },
    response: {
      status,
      headers,
      ...(size === null ? {} : { content: { size }, bodySize: size }),
    },
  };
}

const har = (entries) => ({ log: { version: '1.2', entries } });

/* ── Facts ────────────────────────────────────────────────────────────────── */

test('counts and totals are exact', () => {
  const result = analyzeHarData(
    har([
      entry('GET', 'https://x.test/a', 200, 50, 0, 1000),
      entry('GET', 'https://x.test/b', 500, 80, 100, 200),
      entry('GET', 'https://x.test/c', 0, 10, 200, 0),
      entry('GET', 'https://x.test/d', 200, 2000, 300, 500),
    ]),
  );
  assert.equal(result.totalRequests, 4);
  assert.equal(result.failedRequests, 2, 'a 500 and a no-response are both failures');
  assert.equal(result.slowRequests, 1);
  assert.equal(result.totalBytes, 1700);
  assert.equal(result.slowThresholdMs, DEFAULTS.slowMs);
});

test('a HAR that records no sizes reports no total, rather than zero', () => {
  // "We do not know how big this was" and "this was empty" are different findings.
  const result = analyzeHarData(
    har([entry('GET', 'https://x.test/a', 200, 50, 0, null)]),
  );
  assert.equal('totalBytes' in result, false);
  assert.equal('bytes' in result.endpoints[0], false);
});

test('start offsets are relative to the first request', () => {
  const result = analyzeHarData(
    har([
      entry('GET', 'https://x.test/late', 200, 10, 500),
      entry('GET', 'https://x.test/first', 200, 10, 0),
    ]),
  );
  const first = result.endpoints.find((e) => e.url.endsWith('/first'));
  const late = result.endpoints.find((e) => e.url.endsWith('/late'));
  assert.equal(first.startedMs, 0);
  assert.equal(late.startedMs, 500);
});

test('a HAR with no timestamps omits offsets instead of inventing them', () => {
  const result = analyzeEntries([
    { method: 'GET', url: 'https://x.test/a', status: 200, durationMs: 10, bytes: 5, startedAt: null },
  ]);
  assert.equal('startedMs' in result.endpoints[0], false);
});

test('an endpoint reports its worst status and slowest call', () => {
  const result = analyzeHarData(
    har([
      entry('GET', 'https://x.test/flaky', 200, 50, 0),
      entry('GET', 'https://x.test/flaky', 500, 900, 100),
    ]),
  );
  assert.equal(result.endpoints.length, 1, 'one endpoint, called twice');
  assert.equal(result.endpoints[0].count, 2);
  assert.equal(result.endpoints[0].status, 500);
  assert.equal(result.endpoints[0].durationMs, 900);
});

test('secrets in a URL never reach the block', () => {
  const result = analyzeHarData(
    har([entry('GET', 'https://x.test/pay?token=abc123secret', 200, 10, 0)]),
  );
  assert.ok(!result.endpoints[0].url.includes('abc123secret'));
});

/* ── Inferences ───────────────────────────────────────────────────────────── */

test('duplicate counts the wasted calls, not the repeated endpoints', () => {
  const result = analyzeHarData(
    har([
      entry('POST', 'https://x.test/login', 200, 40, 0),
      entry('POST', 'https://x.test/login', 200, 40, 50),
      entry('POST', 'https://x.test/login', 200, 40, 90),
    ]),
  );
  // Three calls to one endpoint is two wasted, not three.
  assert.equal(result.duplicateRequests, 2);
  assert.equal(result.endpoints[0].issue, 'duplicate');
  assert.equal(result.endpoints[0].count, 3);
});

test('the same path with a different query is not a duplicate', () => {
  const result = analyzeHarData(
    har([
      entry('GET', 'https://x.test/search?q=a', 200, 10, 0),
      entry('GET', 'https://x.test/search?q=b', 200, 10, 50),
    ]),
  );
  assert.equal(result.duplicateRequests, 0);
  for (const endpoint of result.endpoints) assert.notEqual(endpoint.issue, 'duplicate');
});

test('evenly spaced repeats are polling, not duplicates', () => {
  const result = analyzeHarData(
    har([0, 5000, 10000, 15000].map((ms) => entry('GET', 'https://x.test/poll', 200, 20, ms))),
  );
  assert.equal(result.endpoints[0].issue, 'polling');
});

test('a burst is a duplicate, not polling', () => {
  // Four calls inside 200 ms is a double-submit storm, not a timer.
  const result = analyzeHarData(
    har([0, 60, 120, 180].map((ms) => entry('POST', 'https://x.test/submit', 200, 20, ms))),
  );
  assert.equal(result.endpoints[0].issue, 'duplicate');
});

test('distinct ids on one path shape inside the window are an N+1', () => {
  const result = analyzeHarData(
    har([41, 42, 43, 44].map((id, i) => entry('GET', `https://x.test/api/users/${id}`, 200, 30, i * 40))),
  );
  assert.equal(result.endpoints.length, 4);
  for (const endpoint of result.endpoints) assert.equal(endpoint.issue, 'n-plus-one');
});

test('the same ids spread over a long session are not an N+1', () => {
  // Four user fetches across half a minute is a person browsing, not a loop.
  const result = analyzeHarData(
    har([41, 42, 43, 44].map((id, i) => entry('GET', `https://x.test/api/users/${id}`, 200, 30, i * 9000))),
  );
  for (const endpoint of result.endpoints) assert.notEqual(endpoint.issue, 'n-plus-one');
});

test('three ids is below the bar for an N+1', () => {
  const result = analyzeHarData(
    har([1, 2, 3].map((id, i) => entry('GET', `https://x.test/api/items/${id}`, 200, 20, i * 30))),
  );
  for (const endpoint of result.endpoints) assert.notEqual(endpoint.issue, 'n-plus-one');
});

test('a static asset with no caching headers is flagged; one with them is not', () => {
  const result = analyzeHarData(
    har([
      entry('GET', 'https://x.test/app.css', 200, 20, 0, 1000),
      entry('GET', 'https://x.test/vendor.js', 200, 20, 50, 1000, [
        { name: 'Cache-Control', value: 'max-age=31536000' },
      ]),
      entry('GET', 'https://x.test/logo.png', 200, 20, 100, 1000, [{ name: 'ETag', value: 'W/"abc"' }]),
    ]),
  );
  const byPath = Object.fromEntries(result.endpoints.map((e) => [e.url.split('/').pop(), e.issue]));
  assert.equal(byPath['app.css'], 'uncached');
  assert.equal(byPath['vendor.js'], undefined, 'Cache-Control means cached');
  assert.equal(byPath['logo.png'], undefined, 'an ETag is enough');
});

test('an uncached API response is not flagged — freshness is usually the point', () => {
  const result = analyzeHarData(
    har([entry('GET', 'https://x.test/api/me', 200, 20, 0, 500)]),
  );
  assert.equal(result.endpoints[0].issue, undefined);
});

test('a large payload is flagged at the threshold, and the threshold is configurable', () => {
  const big = har([entry('GET', 'https://x.test/data.json', 200, 20, 0, 600 * 1024)]);
  assert.equal(analyzeHarData(big).endpoints[0].issue, 'large-payload');
  assert.equal(analyzeHarData(big, { largeBytes: 1024 * 1024 }).endpoints[0].issue, undefined);
});

/* ── Precedence and ordering ──────────────────────────────────────────────── */

test('a failing call that is also slow is reported as failing', () => {
  // One flag per endpoint, and the reader must act on the failure.
  const result = analyzeHarData(
    har([entry('GET', 'https://x.test/broken', 500, 5000, 0)]),
  );
  assert.equal(result.endpoints[0].issue, 'failed');
});

test('endpoints come back worst first', () => {
  const result = analyzeHarData(
    har([
      entry('GET', 'https://x.test/fine', 200, 10, 0),
      entry('GET', 'https://x.test/slow', 200, 4000, 10),
      entry('GET', 'https://x.test/broken', 500, 20, 20),
    ]),
  );
  assert.deepEqual(
    result.endpoints.map((e) => e.issue),
    ['failed', 'slow', undefined],
  );
});

test('the slow threshold is configurable and reported back', () => {
  const doc = har([entry('GET', 'https://x.test/a', 200, 600, 0)]);
  assert.equal(analyzeHarData(doc).slowRequests, 0);
  const strict = analyzeHarData(doc, { slowMs: 500 });
  assert.equal(strict.slowRequests, 1);
  assert.equal(strict.slowThresholdMs, 500, 'a reader must see which threshold produced the count');
});

/* ── Path templating ──────────────────────────────────────────────────────── */

test('only identifier-shaped segments collapse', () => {
  assert.equal(templatePath('https://x.test/api/users/41/posts'), '/api/users/:id/posts');
  assert.equal(
    templatePath('https://x.test/o/3f2504e0-4f89-11d3-9a0c-0305e82c3301'),
    '/o/:uuid',
  );
  assert.equal(templatePath('https://x.test/blob/deadbeefdeadbeef99'), '/blob/:hash');
  // Words stay words, or genuinely different endpoints would collapse into one.
  assert.equal(templatePath('https://x.test/api/users/settings'), '/api/users/settings');
  assert.equal(templatePath('https://x.test/a?b=1#c'), '/a');
});

/* ── Contract fit ─────────────────────────────────────────────────────────── */

test('the output validates as the contract network block', async () => {
  const fs = await import('node:fs');
  const { validate } = await import('../lib/analysis/contracts.mjs');
  const schema = JSON.parse(
    fs.readFileSync(new URL('../../../skills/qa-explore/contracts/explore-result.schema.json', import.meta.url), 'utf8'),
  );

  const result = analyzeHarData(
    har([
      entry('POST', 'https://x.test/login', 200, 400, 0, 1800),
      entry('POST', 'https://x.test/login', 200, 380, 120, 1800),
      entry('GET', 'https://x.test/api/billing', 500, 3100, 200, 340),
      entry('GET', 'https://x.test/app.css', 200, 90, 300, 184000),
    ]),
  );

  const errors = validate(result, schema.properties.network);
  assert.deepEqual(errors, [], 'the generated block must drop into a result unchanged');
});
