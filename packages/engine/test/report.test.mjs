// The report platform: artifact resolution, rendering, and every export format.
//
// The centre of gravity here is the artifact registry, because the two failures that
// caused this subsystem to be written were both about *paths and presence* rather than
// about markup: a report whose every screenshot 404ed, and a report that silently
// dropped fields the contract required. Both are regression-tested below by asserting
// on the rendered output, not on an intermediate.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { createRegistry, verify, scan, hashFile } from '../lib/artifacts/manager.mjs';
import { createZip } from '../lib/artifacts/zip-write.mjs';
import { listEntries, readEntry, isZip } from '../lib/analysis/zip.mjs';
import { writeBundle } from '../lib/report/export/bundle.mjs';
import { mimeFor, kindFor, formatBytes } from '../lib/artifacts/mime.mjs';
import { render, renderBody } from '../lib/report/export/html.mjs';
import { renderMarkdown } from '../lib/report/export/markdown.mjs';
import { renderSarif, renderJUnit, renderCsv, bundleManifest } from '../lib/report/export/machine.mjs';
import { buildModel, deriveOverall, verdictOf, subjectOf } from '../lib/report/core/model.mjs';
import { renderFile } from '../lib/analysis/report-html.mjs';

/* ── Fixtures ─────────────────────────────────────────────────────────────── */

/** A real 2×2 PNG, built here so the fixture carries no binary blob. */
function pngBytes() {
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  const crc32 = (buffer) => {
    let c = 0xffffffff;
    for (const byte of buffer) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc(2 * (1 + 2 * 3));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A project root containing one run folder with real evidence files. */
function makeRun() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-report-'));
  const runDir = path.join(root, 'qa-artifacts', 'explore-t1');
  fs.mkdirSync(path.join(runDir, 'screenshots'), { recursive: true });
  fs.writeFileSync(path.join(runDir, 'screenshots', 'one.png'), pngBytes());
  fs.writeFileSync(path.join(runDir, 'screenshots', 'empty.png'), Buffer.alloc(0));
  fs.writeFileSync(path.join(runDir, 'network.json'), '{"entries":[]}');
  return { root, runDir };
}

function baseResult(overrides = {}) {
  return {
    contract: { name: 'qa-explore/explore-result', version: '1.1.0' },
    skill: { name: 'qa-explore', version: '0.2.0' },
    generatedAt: '2026-07-29T00:00:00Z',
    url: 'https://admin.example.com/users',
    summary: 'One finding.',
    classification: 'issues-found',
    severityCounts: { critical: 0, high: 1, medium: 0, low: 0 },
    evidence: [{ type: 'screenshot', description: 'Proof', source: 'screenshots/one.png' }],
    findings: [
      {
        id: 'EXP-1',
        severity: 'high',
        dimension: 'functional',
        title: 'Save silently fails',
        repro: '1. Open /users  2. Click Save',
        actual: 'The dialog stays open and nothing is written.',
        expected: 'The user is created and the dialog closes.',
        fixDirection: 'Surface the API error and validate roleId.',
        status: 'confirmed',
        evidence: [{ type: 'screenshot', source: 'screenshots/one.png' }],
      },
    ],
    ...overrides,
  };
}

/* ── Path resolution: the bug this subsystem exists for ───────────────────── */

test('a project-root-relative evidence path resolves and renders as a working image', () => {
  const { root, runDir } = makeRun();
  // The exact shape that 404ed: the path is relative to the project root while the
  // report is written inside the run folder.
  const result = baseResult({
    findings: [
      {
        ...baseResult().findings[0],
        evidence: [{ type: 'screenshot', source: 'qa-artifacts/explore-t1/screenshots/one.png' }],
      },
    ],
  });
  fs.writeFileSync(path.join(runDir, 'explore-result.json'), JSON.stringify(result));

  const html = render(result, {
    resultPath: path.join(runDir, 'explore-result.json'),
    outPath: path.join(runDir, 'explore-report.html'),
  });

  assert.match(html, /src="\.\/screenshots\/one\.png"/, 'href must be relative to the report');
  assert.doesNotMatch(html, /qa-artifacts\/explore-t1\/qa-artifacts/, 'must not double the prefix');
  assert.doesNotMatch(html, /Artifact missing/, 'the file exists and must render');
  fs.rmSync(root, { recursive: true, force: true });
});

test('hrefs are recomputed when the report is written outside the run folder', () => {
  const { root, runDir } = makeRun();
  const result = baseResult();
  const html = render(result, {
    resultPath: path.join(runDir, 'explore-result.json'),
    outPath: path.join(root, 'summary.html'),
  });
  assert.match(html, /src="\.\/qa-artifacts\/explore-t1\/screenshots\/one\.png"/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a missing file is stated, never emitted as an image', () => {
  const { root, runDir } = makeRun();
  const result = baseResult({
    findings: [
      {
        ...baseResult().findings[0],
        evidence: [{ type: 'screenshot', source: 'screenshots/never-written.png' }],
      },
    ],
  });
  const html = render(result, { resultPath: path.join(runDir, 'explore-result.json') });

  assert.match(html, /Artifact missing/);
  assert.match(html, /never-written\.png/, 'the searched path is shown so it can be fixed');
  assert.doesNotMatch(html, /<img[^>]+never-written/, 'no img tag for a file that is not there');
  fs.rmSync(root, { recursive: true, force: true });
});

test('a zero-byte capture counts as missing', () => {
  const { root, runDir } = makeRun();
  const registry = createRegistry(
    { artifacts: [{ id: 'a', kind: 'screenshot', path: 'screenshots/empty.png' }] },
    { baseDir: runDir },
  );
  const record = registry.get('a');
  assert.equal(record.exists, false);
  assert.match(record.missingReason, /empty/i);
  fs.rmSync(root, { recursive: true, force: true });
});

test('resolution refuses to escape the search root', () => {
  const { root, runDir } = makeRun();
  const registry = createRegistry(
    { artifacts: [{ id: 'esc', kind: 'file', path: '../../../../../../../../etc/passwd' }] },
    { baseDir: runDir, searchRoot: root },
  );
  const record = registry.get('esc');
  assert.equal(record.exists, false);
  assert.equal(record.absolutePath, null);
  fs.rmSync(root, { recursive: true, force: true });
});

test('an evidence entry pointing at an unregistered id is reported, not crashed on', () => {
  const { root, runDir } = makeRun();
  const registry = createRegistry({ artifacts: [] }, { baseDir: runDir });
  const record = registry.forEvidence({ type: 'screenshot', artifactId: 'nope' });
  assert.equal(record.exists, false);
  assert.match(record.missingReason, /No artifact registered/);
  fs.rmSync(root, { recursive: true, force: true });
});

/* ── Verification gate ────────────────────────────────────────────────────── */

test('verify reports ok only when every referenced file is present and non-empty', () => {
  const { root, runDir } = makeRun();

  const clean = verify(
    { artifacts: [{ id: 'a', kind: 'screenshot', path: 'screenshots/one.png' }] },
    { baseDir: runDir },
  );
  assert.equal(clean.ok, true);
  assert.equal(clean.stats.present, 1);

  const dirty = verify(
    {
      artifacts: [
        { id: 'a', kind: 'screenshot', path: 'screenshots/one.png' },
        { id: 'b', kind: 'screenshot', path: 'screenshots/gone.png' },
      ],
    },
    { baseDir: runDir },
  );
  assert.equal(dirty.ok, false);
  assert.equal(dirty.missing.length, 1);
  assert.equal(dirty.missing[0].id, 'b');
  fs.rmSync(root, { recursive: true, force: true });
});

test('a declared hash that disagrees with the file is reported as a mismatch', () => {
  const { root, runDir } = makeRun();
  const report = verify(
    {
      artifacts: [
        { id: 'a', kind: 'screenshot', path: 'screenshots/one.png', sha256: 'f'.repeat(64) },
      ],
    },
    { baseDir: runDir },
  );
  assert.equal(report.ok, false);
  assert.equal(report.hashMismatches.length, 1);
  assert.equal(report.hashMismatches[0].declared, 'f'.repeat(64));
  fs.rmSync(root, { recursive: true, force: true });
});

test('scan reads the directory rather than the JSON, and flags empty files', () => {
  const { root, runDir } = makeRun();
  const found = scan(runDir);
  const empty = found.filter((entry) => entry.empty);
  assert.equal(found.length, 3);
  assert.equal(empty.length, 1);
  assert.match(empty[0].path, /empty\.png$/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('hashFile is a real SHA-256 of the bytes', () => {
  const { root, runDir } = makeRun();
  const digest = hashFile(path.join(runDir, 'network.json'));
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(digest, hashFile(path.join(runDir, 'network.json')), 'stable across calls');
  fs.rmSync(root, { recursive: true, force: true });
});

/* ── Rendering completeness: the other original failure ───────────────────── */

test('every required finding field reaches the rendered HTML', () => {
  const { root, runDir } = makeRun();
  const html = render(baseResult(), { resultPath: path.join(runDir, 'explore-result.json') });
  for (const needle of [
    'The dialog stays open and nothing is written.',
    'The user is created and the dialog closes.',
    'Surface the API error and validate roleId.',
    'EXP-1',
  ]) {
    assert.ok(html.includes(needle), `rendered report is missing: ${needle}`);
  }
  fs.rmSync(root, { recursive: true, force: true });
});

test('the optional investigation fields render when supplied', () => {
  const { root, runDir } = makeRun();
  const result = baseResult();
  result.findings[0].businessImpact = 'Administrators believe they created a user who does not exist.';
  result.findings[0].rootCause = {
    summary: 'The frontend ignores the API response.',
    chain: ['POST /api/users returns 500', 'The subscribe call has no error handler'],
    layer: 'frontend',
    confidence: 0.9,
  };
  result.findings[0].regressionRisk = { level: 'low', retest: ['A valid user still saves'] };
  result.findings[0].developerNotes = 'users.component.ts line 140';

  const html = render(result, { resultPath: path.join(runDir, 'explore-result.json') });
  assert.match(html, /Administrators believe they created a user/);
  assert.match(html, /The frontend ignores the API response\./);
  assert.match(html, /The subscribe call has no error handler/);
  assert.match(html, /A valid user still saves/);
  assert.match(html, /users\.component\.ts line 140/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('untrusted text in a finding cannot inject markup or break out of the script block', () => {
  const { root, runDir } = makeRun();
  const result = baseResult();
  result.findings[0].title = '<img src=x onerror=alert(1)>';
  result.findings[0].actual = '</script><script>alert(2)</script>';

  const html = render(result, { resultPath: path.join(runDir, 'explore-result.json') });
  assert.doesNotMatch(html, /<img src=x onerror/);
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.doesNotMatch(html, /<script>alert\(2\)<\/script>/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('the document is self-contained: no external stylesheet, script, font, or image host', () => {
  const { root, runDir } = makeRun();
  const html = render(baseResult(), { resultPath: path.join(runDir, 'explore-result.json') });
  assert.doesNotMatch(html, /<link[^>]+stylesheet/i);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /@import/);
  assert.doesNotMatch(html, /src="https?:\/\//i, 'no remote asset may be referenced');
  fs.rmSync(root, { recursive: true, force: true });
});

test('the report carries the attribution footer', () => {
  const { root, runDir } = makeRun();
  const html = render(baseResult(), { resultPath: path.join(runDir, 'explore-result.json') });
  assert.match(html, /qa-pack-attribution/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('both themes and the print rendering are styled', () => {
  const { root, runDir } = makeRun();
  const html = render(baseResult(), { resultPath: path.join(runDir, 'explore-result.json') });
  assert.match(html, /\[data-theme="dark"\]/, 'explicit dark theme');
  assert.match(html, /prefers-color-scheme:dark/, 'OS dark preference');
  assert.match(html, /@media print/, 'print rendering');
  assert.match(html, /prefers-reduced-motion/, 'motion preference honoured');
  fs.rmSync(root, { recursive: true, force: true });
});

test('embedding inlines images so the report survives travelling alone', () => {
  const { root, runDir } = makeRun();
  const html = render(baseResult(), {
    resultPath: path.join(runDir, 'explore-result.json'),
    embed: true,
  });
  assert.match(html, /src="data:image\/png;base64,/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('no element carries two class attributes', () => {
  // A duplicated `class` is silently dropped by every browser, so the styling simply
  // never applies. It cost the API table its severity colours: a 500 rendered in
  // body-text grey because the second class attribute — the one naming the severity —
  // was ignored.
  const { root, runDir } = makeRun();
  const html = render(
    baseResult({
      network: {
        totalRequests: 2,
        endpoints: [
          { method: 'GET', url: 'https://x.test/a', status: 500, durationMs: 20, issue: 'failed' },
          { method: 'GET', url: 'https://x.test/b', status: 404, durationMs: 10 },
          { method: 'GET', url: 'https://x.test/c', status: 200, durationMs: 10 },
        ],
      },
    }),
    { resultPath: path.join(runDir, 'explore-result.json') },
  );

  const doubled = html.match(/<[a-z]+[^>]*\sclass="[^"]*"[^>]*\sclass="/g) ?? [];
  assert.deepEqual(doubled, [], 'an element has two class attributes; the second is ignored');
  assert.match(html, /class="num sev-critical"/, 'a 500 must carry the critical colour');
  fs.rmSync(root, { recursive: true, force: true });
});

test('an unsupported contract is refused by name, listing what is supported', () => {
  assert.throws(
    () => render({ contract: { name: 'qa-run/execution-result', version: '1.0.0' } }),
    (error) =>
      error.name === 'ReportError' &&
      /no renderer for contract 'qa-run\/execution-result'/.test(error.message) &&
      /qa-engineer\/qa-report/.test(error.message),
  );
});

test('an unsupported schema version is refused rather than half-rendered', () => {
  assert.throws(
    () => render({ contract: { name: 'qa-explore/explore-result', version: '9.4.0' } }),
    /schema version 9\.4, which this renderer does not support/,
  );
});

test('renderFile reads from disk and resolves evidence against the file it read', () => {
  const { root, runDir } = makeRun();
  const file = path.join(runDir, 'explore-result.json');
  fs.writeFileSync(file, JSON.stringify(baseResult()));
  const html = renderFile(file, { outPath: path.join(runDir, 'explore-report.html') });
  assert.match(html, /src="\.\/screenshots\/one\.png"/);
  fs.rmSync(root, { recursive: true, force: true });
});

/* ── Model ────────────────────────────────────────────────────────────────── */

test('the overall score is a published function of the severity counts', () => {
  assert.equal(deriveOverall({ critical: 0, high: 0, medium: 0, low: 0 }), 100);
  assert.equal(deriveOverall({ critical: 0, high: 1, medium: 0, low: 0 }), 88);
  assert.equal(deriveOverall({ critical: 1, high: 2, medium: 2, low: 1 }), 100 - 35 - 24 - 8 - 1);
  assert.equal(deriveOverall({ critical: 9, high: 0, medium: 0, low: 0 }), 0, 'floors at zero');
});

test('a critical finding cannot render as shippable when no verdict was stated', () => {
  const verdict = verdictOf({
    classification: 'issues-found',
    severityCounts: { critical: 1, high: 0, medium: 0, low: 0 },
  });
  assert.equal(verdict.key, 'do-not-ship');
  assert.equal(verdict.inferred, true);
});

test('a stated verdict wins over the inferred one', () => {
  const verdict = verdictOf({
    classification: 'issues-found',
    severityCounts: { critical: 0, high: 0, medium: 0, low: 1 },
    executive: { verdict: 'ship-with-risks', headline: 'One cosmetic issue.' },
  });
  assert.equal(verdict.key, 'ship-with-risks');
  assert.equal(verdict.inferred, false);
  assert.equal(verdict.headline, 'One cosmetic issue.');
});

test('the subject is the title, then the host, never a paragraph', () => {
  assert.equal(subjectOf({ title: 'Walkzero Admin', url: 'https://x.test' }), 'Walkzero Admin');
  assert.equal(subjectOf({ url: 'https://admin.example.com/users/' }), 'admin.example.com/users');
  assert.ok(subjectOf({ summary: 'A very long sentence. And another.' }).length <= 80);
});

test('a measured score is never overwritten by a derived one', () => {
  const { root, runDir } = makeRun();
  const model = buildModel(baseResult({ scores: { overall: 42, security: 30 } }), {
    resultPath: path.join(runDir, 'explore-result.json'),
  });
  assert.equal(model.scores.overall, 42);
  assert.equal(model.overallDerived, false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a release rollup renders through the same pipeline', () => {
  const rollup = {
    contract: { name: 'qa-report/report-result', version: '1.0.0' },
    skill: { name: 'qa-report', version: '0.1.0' },
    generatedAt: '2026-07-29T00:00:00Z',
    summary: 'Two tests failing.',
    classification: 'not-ready',
    evidence: [{ type: 'report', description: 'Run', source: 'run.json' }],
    releaseReadiness: { verdict: 'not-ready', rationale: 'Checkout is broken.' },
    testSummary: { total: 40, passed: 38, failed: 2, skipped: 0 },
    summaries: { executive: 'Checkout regressed.', engineering: 'Two specs fail on the payment step.' },
    failureSummary: [{ test: 'checkout.spec.ts', classification: 'assertion-failure', reason: 'Total mismatched' }],
  };
  const html = render(rollup, {});
  assert.match(html, /Not ready/);
  assert.match(html, /Checkout regressed\./);
  assert.match(html, /Two specs fail on the payment step\./);
  assert.match(html, /checkout\.spec\.ts/);
  // The empty-findings card, specifically — the donut's aria-label legitimately says
  // "No findings recorded" when the count is zero, and that is the correct label.
  assert.doesNotMatch(
    html,
    /class="card-body empty">No findings recorded/,
    'a rollup has failing tests, not findings; the empty-findings card must not appear',
  );
});

test('renderBody omits the document wrapper so a host page can embed it', () => {
  const model = buildModel(baseResult(), {});
  const body = renderBody(model);
  assert.doesNotMatch(body, /<!DOCTYPE/i);
  assert.doesNotMatch(body, /<html/i);
  assert.match(body, /class="shell"/);
});

/* ── Agent agnosticism ────────────────────────────────────────────────────── */

/** The canonical, producer-neutral report — what any agent is asked to emit. */
function canonical(producer, overrides = {}) {
  return {
    contract: { name: 'qa-engineer/qa-report', version: '2.0' },
    schemaVersion: '2.0',
    metadata: {
      title: 'Admin Console',
      url: 'https://admin.example.com/users',
      generatedAt: '2026-07-29T00:00:00Z',
      producer,
    },
    summary: {
      text: 'One finding.',
      classification: 'issues-found',
      severityCounts: { critical: 0, high: 1, medium: 0, low: 0 },
    },
    issues: [
      {
        id: 'EXP-1',
        severity: 'high',
        dimension: 'functional',
        title: 'Save silently fails',
        actual: 'The dialog stays open and nothing is written.',
        expected: 'The user is created and the dialog closes.',
        fixDirection: 'Surface the API error and validate roleId.',
        repro: '1. Open /users  2. Click Save',
        status: 'confirmed',
        evidence: [{ type: 'screenshot', source: 'screenshots/one.png' }],
      },
    ],
    ...overrides,
  };
}

test('two different agents emitting the same report produce identical documents', () => {
  // The whole promise of the canonical schema. If this ever fails, some part of the
  // renderer has started branching on who produced the data.
  const claude = render(canonical({ agent: 'claude-code', model: 'opus', version: '2.0' }), {});
  const cursor = render(canonical({ agent: 'cursor', model: 'gpt-5', version: '2.0' }), {});

  const strip = (html) => html.replace(/<tr><td>Produced by<\/td><td>.*?<\/td><\/tr>/, '');
  assert.equal(
    strip(claude),
    strip(cursor),
    'the documents differ somewhere other than the provenance line',
  );

  // And the provenance line is genuinely there, so the equality above is not vacuous.
  assert.match(claude, /claude-code · opus/);
  assert.match(cursor, /cursor · gpt-5/);
});

test('the canonical schema carries no way for an agent to influence presentation', () => {
  const schema = JSON.parse(
    fs.readFileSync(
      new URL('../lib/report/schemas/qa-report.schema.json', import.meta.url),
      'utf8',
    ),
  );
  const text = JSON.stringify(schema).toLowerCase();
  for (const forbidden of ['"css"', '"style"', '"classname"', '"theme"', '"template"', '"font"', '"colour"', '"color"']) {
    assert.ok(!text.includes(`${forbidden}:`), `the schema exposes a presentation hook: ${forbidden}`);
  }
});

test('a canonical report and the equivalent explore result render the same findings', () => {
  const { root, runDir } = makeRun();
  const options = { resultPath: path.join(runDir, 'explore-result.json') };
  const fromCanonical = render(canonical({ agent: 'codex' }), options);
  const fromExplore = render(baseResult(), options);

  // Same finding, same evidence, same rails — the normalizer must not lose anything.
  for (const needle of [
    'The dialog stays open and nothing is written.',
    'The user is created and the dialog closes.',
    'Surface the API error and validate roleId.',
    'src="./screenshots/one.png"',
  ]) {
    assert.ok(fromCanonical.includes(needle), `canonical rendering lost: ${needle}`);
    assert.ok(fromExplore.includes(needle), `explore rendering lost: ${needle}`);
  }
  fs.rmSync(root, { recursive: true, force: true });
});

test('the canonical report counts its own severities when the producer did not', () => {
  const report = canonical({ agent: 'gemini-cli' });
  delete report.summary.severityCounts;
  const model = buildModel(report, {});
  assert.deepEqual(model.severityCounts, { critical: 0, high: 1, medium: 0, low: 0 });
});

test('every rendering is stamped with the schema, theme, and renderer version', () => {
  const html = render(canonical({ agent: 'claude-code' }), {});
  assert.match(html, /<meta name="qa-schema-version" content="2\.0"\/>/);
  assert.match(html, /<meta name="qa-theme-version" content="Enterprise v1\.0"\/>/);
  assert.match(html, /<meta name="qa-renderer-version" content="1\.0"\/>/);
  assert.match(html, /<td>Schema version<\/td>/);
  assert.match(html, /<td>Theme version<\/td>/);
  assert.match(html, /<td>Renderer version<\/td>/);
});

/* ── Rendering modes ──────────────────────────────────────────────────────── */

test('the artifact mode omits the document wrapper but keeps the identical styling', () => {
  const report = canonical({ agent: 'claude-code' });
  const full = render(report, { mode: 'full' });
  const embedded = render(report, { mode: 'artifact' });

  assert.doesNotMatch(embedded, /<!DOCTYPE/i);
  assert.doesNotMatch(embedded, /<html/i);
  assert.doesNotMatch(embedded, /<body>/i);
  assert.match(embedded, /<style>/, 'the host page does not supply the theme');

  // The visual identity must be byte-identical, or an embedded report is a different
  // product from a standalone one.
  const styleOf = (html) => html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  assert.equal(styleOf(embedded), styleOf(full));
});

test('the executive and developer modes are filters, never rewrites', () => {
  const { root, runDir } = makeRun();
  const options = { resultPath: path.join(runDir, 'explore-result.json') };
  const executive = render(baseResult(), { ...options, mode: 'executive' });
  const developer = render(baseResult(), { ...options, mode: 'developer' });

  assert.doesNotMatch(executive, /id="findings"/, 'the executive rendering drops the findings list');
  assert.match(developer, /id="findings"/);
  assert.doesNotMatch(developer, /id="summary"/, 'the developer rendering drops the exec summary');

  // Whatever each one does keep is the same text the full report shows.
  assert.match(developer, /The dialog stays open and nothing is written\./);
  fs.rmSync(root, { recursive: true, force: true });
});

test('an unknown rendering mode is refused rather than silently rendering everything', () => {
  assert.throws(
    () => render(canonical({ agent: 'x' }), { mode: 'pretty' }),
    /unknown rendering mode 'pretty'/,
  );
});

/* ── Exports ──────────────────────────────────────────────────────────────── */

test('markdown carries every required field and states a missing artifact', () => {
  const { root, runDir } = makeRun();
  const result = baseResult({
    findings: [
      {
        ...baseResult().findings[0],
        evidence: [{ type: 'screenshot', source: 'screenshots/gone.png' }],
      },
    ],
  });
  const md = renderMarkdown(result, { resultPath: path.join(runDir, 'explore-result.json') });
  assert.match(md, /\*\*Current behaviour\*\* — The dialog stays open/);
  assert.match(md, /\*\*Expected behaviour\*\* — The user is created/);
  assert.match(md, /\*\*Suggested fix\*\* — Surface the API error/);
  assert.match(md, /\*Artifact missing\*/);
  assert.doesNotMatch(md, /!\[.*\]\(.*gone\.png\)/, 'no image reference for a file that is not there');
  fs.rmSync(root, { recursive: true, force: true });
});

test('a pipe in a finding cannot break the markdown table', () => {
  const { root, runDir } = makeRun();
  const result = baseResult({ url: 'https://x.test/a|b' });
  const md = renderMarkdown(result, { resultPath: path.join(runDir, 'explore-result.json') });
  assert.match(md, /https:\/\/x\.test\/a\\\|b/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('SARIF is well-formed, ranked, and locates findings at their page', () => {
  const sarif = renderSarif(baseResult(), {});
  assert.equal(sarif.version, '2.1.0');
  assert.equal(sarif.runs.length, 1);
  assert.equal(sarif.runs[0].results.length, 1);
  const [finding] = sarif.runs[0].results;
  assert.equal(finding.level, 'error');
  assert.equal(finding.rank, 8);
  assert.equal(finding.partialFingerprints.findingId, 'EXP-1');
  assert.equal(
    finding.locations[0].physicalLocation.artifactLocation.uri,
    'https://admin.example.com/users',
  );
  assert.ok(sarif.runs[0].tool.driver.rules.length >= 1);
});

test('JUnit separates executed cases from findings, and escapes control characters', () => {
  const result = baseResult({
    testCases: {
      total: 2,
      passed: 1,
      failed: 1,
      blocked: 0,
      skipped: 0,
      cases: [
        { id: 'TC-1', title: 'Sign in', status: 'pass' },
        { id: 'TC-2', title: 'Create user', status: 'fail', findingId: 'EXP-1' },
      ],
    },
  });
  result.findings[0].actual = 'Broken\u0000output';

  const xml = renderJUnit(result, {});
  assert.match(xml, /<testsuite name="qa-explore\.cases"/);
  assert.match(xml, /<testsuite name="qa-explore\.findings"/);
  assert.doesNotMatch(xml, /\u0000/, 'a control character would make the XML unparseable');
  assert.match(xml, /type="high"/, 'severity travels in the failure type');
});

test('CSV quotes correctly and leads with a BOM so Excel reads it as UTF-8', () => {
  const result = baseResult();
  result.findings[0].actual = 'It says "no", and, then stops';
  const csv = renderCsv(result, {});
  assert.ok(csv.startsWith('\ufeff'));
  assert.match(csv, /"It says ""no"", and, then stops"/);
  assert.match(csv.split('\r\n')[0], /^\ufeff?id,severity,dimension/);
});

test('the bundle manifest lists what an archive must contain and whether it is complete', () => {
  const { root, runDir } = makeRun();
  const manifest = bundleManifest(
    baseResult({
      artifacts: [
        { id: 'a', kind: 'screenshot', path: 'screenshots/one.png' },
        { id: 'b', kind: 'screenshot', path: 'screenshots/gone.png' },
      ],
    }),
    { resultPath: path.join(runDir, 'explore-result.json') },
  );
  assert.equal(manifest.complete, false);
  assert.equal(manifest.counts.missing, 1);
  assert.ok(manifest.files.find((file) => file.path === 'screenshots/one.png').sha256);
  fs.rmSync(root, { recursive: true, force: true });
});

/* ── The portable bundle ──────────────────────────────────────────────────── */

test('the bundle is self-contained: every link resolves inside the folder', () => {
  const { root, runDir } = makeRun();
  const resultPath = path.join(runDir, 'explore-result.json');
  fs.writeFileSync(resultPath, JSON.stringify(baseResult()));

  const out = path.join(root, 'report');
  const manifest = writeBundle(baseResult(), { resultPath, outDir: out });

  assert.equal(manifest.complete, true);
  assert.deepEqual(manifest.brokenReferences, []);

  // The layout a stakeholder receives.
  for (const relative of ['index.html', 'report.json', 'manifest.json', 'assets/css/report.css', 'assets/js/report.js']) {
    assert.ok(fs.existsSync(path.join(out, relative)), `bundle is missing ${relative}`);
  }
  assert.ok(fs.existsSync(path.join(out, 'assets/screenshots/one.png')), 'evidence was not copied in');

  // The check that matters: nothing in the page reaches outside the bundle.
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  const local = references.filter((reference) => !/^(https?:|mailto:|data:|#)/i.test(reference));
  assert.ok(local.length > 0, 'the page should reference its own assets');
  for (const reference of local) {
    const resolved = path.resolve(out, decodeURI(reference));
    assert.ok(fs.existsSync(resolved), `dangling reference in the bundle: ${reference}`);
    assert.ok(!path.relative(out, resolved).startsWith('..'), `${reference} escapes the bundle`);
  }
  fs.rmSync(root, { recursive: true, force: true });
});

test('the bundle loads no remote asset, so it opens offline', () => {
  const { root, runDir } = makeRun();
  const resultPath = path.join(runDir, 'explore-result.json');
  const out = path.join(root, 'report');
  writeBundle(baseResult(), { resultPath, outDir: out });

  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  // An <a href> to the tested URL is fine — a reader clicks it. A *loaded* asset is
  // not: it is what makes a report render differently on a train.
  assert.doesNotMatch(html, /<link[^>]+href="https?:/i);
  assert.doesNotMatch(html, /<script[^>]+src="https?:/i);
  assert.doesNotMatch(html, /<img[^>]+src="https?:/i);
  assert.doesNotMatch(html, /@import/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a rewritten bundle drops evidence the new run no longer references', () => {
  const { root, runDir } = makeRun();
  const resultPath = path.join(runDir, 'explore-result.json');
  const out = path.join(root, 'report');

  writeBundle(baseResult(), { resultPath, outDir: out });
  assert.ok(fs.existsSync(path.join(out, 'assets/screenshots/one.png')));

  // A later run that cites nothing must not leave the earlier screenshot behind, or the
  // bundle accumulates evidence for findings it no longer contains.
  const withoutEvidence = baseResult();
  withoutEvidence.findings = [];
  withoutEvidence.severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  withoutEvidence.evidence = [{ type: 'report', description: 'Run log', source: 'network.json' }];
  writeBundle(withoutEvidence, { resultPath, outDir: out });

  assert.ok(!fs.existsSync(path.join(out, 'assets/screenshots/one.png')), 'stale evidence survived');
  fs.rmSync(root, { recursive: true, force: true });
});

test('the bundle refuses to overwrite a directory holding unrelated files', () => {
  const { root, runDir } = makeRun();
  const out = path.join(root, 'not-a-bundle');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'important.txt'), 'do not delete me');

  assert.throws(
    () => writeBundle(baseResult(), { resultPath: path.join(runDir, 'explore-result.json'), outDir: out }),
    /refusing to write a bundle/,
  );
  assert.ok(fs.existsSync(path.join(out, 'important.txt')));
  fs.rmSync(root, { recursive: true, force: true });
});

test('the manifest hashes every file it wrote', () => {
  const { root, runDir } = makeRun();
  const out = path.join(root, 'report');
  const manifest = writeBundle(baseResult(), {
    resultPath: path.join(runDir, 'explore-result.json'),
    outDir: out,
  });
  for (const entry of manifest.files) {
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    assert.equal(entry.sha256, hashFile(path.join(out, entry.path)), `${entry.path} hash is wrong`);
  }
  fs.rmSync(root, { recursive: true, force: true });
});

/* ── ZIP writer ───────────────────────────────────────────────────────────── */

test('the ZIP round-trips through the reader, entry for entry', () => {
  // Cross-checking the writer against the pack's own reader catches a header the
  // writer got wrong without needing an external unzip on the test machine.
  const payload = Buffer.from('a'.repeat(4096), 'utf8');
  const binary = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0x03]);
  const zip = createZip(
    [
      { name: 'report/index.html', data: '<h1>QA</h1>' },
      { name: 'report/assets/big.txt', data: payload },
      { name: 'report/assets/shot.png', data: binary },
    ],
    { modifiedAt: new Date('2026-07-29T09:20:00Z') },
  );

  assert.ok(isZip(zip), 'the writer did not produce something the reader recognises');
  const entries = listEntries(zip);
  assert.deepEqual(
    entries.map((entry) => entry.name).sort(),
    ['report/assets/big.txt', 'report/assets/shot.png', 'report/index.html'],
  );

  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  assert.equal(readEntry(zip, byName.get('report/index.html')).toString('utf8'), '<h1>QA</h1>');
  assert.ok(readEntry(zip, byName.get('report/assets/big.txt')).equals(payload));
  assert.ok(readEntry(zip, byName.get('report/assets/shot.png')).equals(binary));
});

test('the end-of-central-directory record puts its fields where extractors look', () => {
  // A two-byte slip here writes an archive that opens in nothing: the directory size
  // and offset are read as garbage and every extractor reports the file as truncated.
  const zip = createZip([{ name: 'a.txt', data: 'hello' }], { modifiedAt: new Date('2026-07-29T00:00:00Z') });
  const eocd = zip.length - 22;
  assert.equal(zip.readUInt32LE(eocd), 0x06054b50, 'EOCD signature is not at the end');
  assert.equal(zip.readUInt16LE(eocd + 8), 1, 'entry count on this disk');
  assert.equal(zip.readUInt16LE(eocd + 10), 1, 'total entry count');

  const centralSize = zip.readUInt32LE(eocd + 12);
  const centralOffset = zip.readUInt32LE(eocd + 16);
  assert.equal(centralOffset + centralSize, eocd, 'the central directory must end where the EOCD begins');
  assert.equal(zip.readUInt32LE(centralOffset), 0x02014b50, 'central directory header not at the stated offset');
});

test('already-compressed bytes are stored rather than re-deflated', () => {
  // Deflating a PNG costs time and usually adds bytes.
  const png = pngBytes();
  const zip = createZip([{ name: 'shot.png', data: png }]);
  // Method lives at offset 8 of the local header, which starts the file.
  assert.equal(zip.readUInt16LE(8), 0, 'a .png should be stored, not deflated');

  const text = createZip([{ name: 'a.txt', data: 'b'.repeat(2000) }]);
  assert.equal(text.readUInt16LE(8), 8, 'compressible text should be deflated');
});

test('a zip entry name never carries a backslash', () => {
  const zip = createZip([{ name: 'report\\assets\\a.txt', data: 'x' }]);
  assert.equal(listEntries(zip)[0].name, 'report/assets/a.txt');
});

/* ── MIME ─────────────────────────────────────────────────────────────────── */

test('file types are recognised, and an unknown one is not guessed', () => {
  assert.equal(mimeFor('a/b/shot.PNG'), 'image/png');
  assert.equal(mimeFor('trace.zip'), 'application/zip');
  assert.equal(mimeFor('mystery.qqq'), null);
  assert.equal(kindFor('capture.har'), 'har');
  assert.equal(kindFor('run.webm'), 'video');
});

test('byte sizes read the way a human would write them', () => {
  assert.equal(formatBytes(812), '812 B');
  // A decimal below ten, where it changes the reading; an integer above, where it does
  // not. "1.4 MB" is worth the character; "44.1 KB" is not.
  assert.equal(formatBytes(9_216), '9.0 KB');
  assert.equal(formatBytes(45_158), '44 KB');
  assert.equal(formatBytes(3_355_443), '3.2 MB');
  assert.equal(formatBytes(-1), '');
});
