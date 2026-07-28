// Bundling tests.
//
// The installer materializes the deterministic engine into each bundling skill. Two
// things can go wrong and both are silent: a file the engine reads at runtime is not
// copied, or the copy is complete but does not run. Neither shows up as a failed
// install — they show up later, as a skill that quietly falls back to guesswork.
//
// So these tests copy a real bundle and then *execute* it: the engine's own CLI, out
// of the bundle directory, with the launcher that a skill actually invokes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUNDLE_MANIFEST,
  ENGINE_SOURCE,
  BUNDLE_LAUNCHER,
  BUNDLE_DEST,
} from '../lib/core/manifest.mjs';
import { bundleFilesForSkill } from '../lib/core/bundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const installerRoot = path.resolve(here, '..');
const repoRoot = path.resolve(here, '..', '..', '..');
const cli = path.join(installerRoot, 'bin', 'qa.mjs');

test('every bundling skill declares a payload, and the engine source exists', () => {
  assert.ok(Object.keys(BUNDLE_MANIFEST).length > 0, 'no skill bundles the engine');
  assert.ok(
    fs.existsSync(path.join(repoRoot, ENGINE_SOURCE, 'bin', 'qa-engine.mjs')),
    `engine CLI missing from ${ENGINE_SOURCE}`,
  );
  assert.ok(fs.existsSync(path.join(repoRoot, BUNDLE_LAUNCHER.from)), 'launcher source missing');
});

test('the bundle carries the engine and its runtime data, but not the launcher', () => {
  const entries = bundleFilesForSkill(repoRoot, 'qa-debug');
  const paths = entries.map((entry) => entry.rel);

  // The CLI the launcher executes.
  assert.ok(paths.includes(`${BUNDLE_DEST}/bin/qa-engine.mjs`));
  // NOT the launcher: that is a committed file in the skill, and bundling it too
  // would give one destination path two sources.
  assert.ok(!paths.includes(BUNDLE_LAUNCHER.to));
  assert.ok(
    fs.existsSync(path.join(repoRoot, 'skills', 'qa-debug', BUNDLE_LAUNCHER.to)),
    'the launcher must be committed in the skill, or a file-copy install has no entry point',
  );
  // Data the engine reads at runtime. Without any one of these the engine copies
  // perfectly and then fails on first use.
  assert.ok(paths.includes(`${BUNDLE_DEST}/lib/analysis/branding.json`),
    'branding metadata must travel, or every report footer fails');
  assert.ok(paths.includes(`${BUNDLE_DEST}/lib/analysis/schemas/context.schema.json`),
    'the context contract must travel, or `context` silently skips validation');
  assert.ok(paths.includes(`${BUNDLE_DEST}/lib/diagnostics/schemas/internal/diagnosis.schema.json`),
    'the internal schemas must travel, or every diagnosis raises');
  // Development files stay out.
  assert.ok(!paths.some((rel) => rel.includes('/test/')), 'tests must not be bundled');
  assert.ok(!paths.includes(`${BUNDLE_DEST}/package.json`), 'the engine manifest is not runtime');
});

test('a skill that bundles nothing gets nothing', () => {
  assert.deepEqual(bundleFilesForSkill(repoRoot, 'qa-review'), []);
});

test('an installed bundle carries the engine into every bundling skill', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-bundle-'));
  try {
    const result = spawnSync(process.execPath, [cli, 'install', '--yes', '--project', dir], {
      encoding: 'utf8',
      env: { ...process.env, QA_PACK_SOURCE: repoRoot, QA_LOG_LEVEL: 'error' },
    });
    assert.equal(result.status, 0, result.stderr);

    for (const skill of Object.keys(BUNDLE_MANIFEST)) {
      const lib = path.join(dir, '.agents', 'skills', skill, BUNDLE_DEST);
      assert.ok(fs.existsSync(path.join(lib, 'bin', 'qa-engine.mjs')), `${skill}: engine CLI missing`);
      assert.ok(
        fs.existsSync(path.join(dir, '.agents', 'skills', skill, BUNDLE_LAUNCHER.to)),
        `${skill}: launcher missing`,
      );
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the installed engine RUNS from the bundle, through the launcher a skill invokes', () => {
  // The whole point. A bundle that copied cleanly and cannot run is the failure this
  // test exists for, and the launcher is the path a skill actually takes — so the
  // launcher is what gets executed, not the CLI directly.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-bundle-run-'));
  try {
    const install = spawnSync(process.execPath, [cli, 'install', '--yes', '--project', dir], {
      encoding: 'utf8',
      env: { ...process.env, QA_PACK_SOURCE: repoRoot, QA_LOG_LEVEL: 'error' },
    });
    assert.equal(install.status, 0, install.stderr);

    const launcher = path.join(dir, '.agents', 'skills', 'qa-debug', BUNDLE_LAUNCHER.to);

    // It must resolve to the *bundled* engine — not fall through to npx, which
    // would mean the bundle was never found and the check proves nothing.
    const where = spawnSync(process.execPath, [launcher, '--where'], { encoding: 'utf8' });
    assert.equal(where.status, 0, where.stderr);
    assert.equal(JSON.parse(where.stdout).resolved, 'bundled');

    const execution = path.join(dir, 'execution-result.json');
    fs.writeFileSync(execution, JSON.stringify({
      tests: { total: 1, passed: 0, failed: 1, skipped: 0 },
      executed: [{
        title: 'checkout',
        status: 'failed',
        message: 'locator not found: #cart-button',
        file: 'tests/checkout.spec.ts',
        retries: 0,
      }],
    }));

    const run = spawnSync(
      process.execPath,
      [launcher, 'diagnostics', 'report', '--execution-result', execution],
      { encoding: 'utf8' },
    );
    assert.equal(run.status, 0, `bundled engine failed: ${run.stderr}`);
    const output = JSON.parse(run.stdout);
    assert.ok(output.diagnosis.entries.length > 0, 'no diagnosis entries');
    assert.equal(output.diagnosis.entries[0].rootCause.classification, 'locator-failure');
    assert.ok(output.plans.length > 0, 'no repair plans');
    assert.equal(output.summary.releaseReadiness, 'ready-with-risks');

    // The context validator must work from the bundle too, against the schema that
    // travelled with it.
    fs.mkdirSync(path.join(dir, '.qa'), { recursive: true });
    fs.copyFileSync(
      path.join(repoRoot, 'packages', 'engine', 'test', 'fixtures', 'valid-context.md'),
      path.join(dir, '.qa', 'context.md'),
    );
    const initLauncher = path.join(dir, '.agents', 'skills', 'qa-init', BUNDLE_LAUNCHER.to);
    const context = spawnSync(
      process.execPath,
      [initLauncher, 'analysis', 'context', '--root', dir],
      { encoding: 'utf8' },
    );
    assert.equal(context.status, 0, `bundled context validator failed: ${context.stderr}`);
    const parsed = JSON.parse(context.stdout);
    assert.equal(parsed.valid, true, JSON.stringify(parsed.errors));
    assert.equal(parsed.schemaChecked, true, 'the context schema was not reachable from the bundle');
    assert.equal(parsed.context.testFramework.e2e, 'playwright');

    // And the report renderer, which is the one output a person reads.
    const artifact = path.join(dir, 'explore-result.json');
    fs.copyFileSync(
      path.join(repoRoot, 'packages', 'engine', 'test', 'corpus', 'explore-result.sample.json'),
      artifact,
    );
    const html = path.join(dir, 'report.html');
    const rendered = spawnSync(
      process.execPath,
      [launcher, 'analysis', 'report-html', artifact, '--out', html],
      { encoding: 'utf8' },
    );
    assert.equal(rendered.status, 0, `bundled renderer failed: ${rendered.stderr}`);
    const page = fs.readFileSync(html, 'utf8');
    assert.match(page, /Current behaviour/);
    assert.match(page, /qa-pack-attribution/, 'the footer must render from the bundled metadata');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
