// Bundling tests.
//
// Two bundlers materialize the same deterministic tooling: the installer
// (packages/installer/lib/core/bundle.mjs, used by consumers) and
// scripts/bundle_python.py (used in repository development). manifest.mjs claims
// the two "must agree, and a test asserts it" — this is that test.
//
// It also proves the installed bundle *runs*, not merely that files were copied:
// the diagnostics engine validates every diagnosis against internal schemas, so
// an install that omits them produces a bundle that raises on first use.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUNDLE_MANIFEST,
  BUNDLE_SOURCES,
  BUNDLE_MODULE_SOURCES,
  BUNDLE_PACKAGE_DATA,
  BUNDLE_DEST,
} from '../lib/core/manifest.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const installerRoot = path.resolve(here, '..');
const repoRoot = path.resolve(here, '..', '..', '..');
const cli = path.join(installerRoot, 'bin', 'qa.mjs');
const bundlerPy = path.join(repoRoot, 'scripts', 'bundle_python.py');

function pythonBin() {
  for (const candidate of ['python3', 'python']) {
    if (spawnSync(candidate, ['--version'], { encoding: 'utf8' }).status === 0) return candidate;
  }
  return null;
}

test('the JavaScript and Python bundle manifests agree', () => {
  const source = fs.readFileSync(bundlerPy, 'utf8');
  const block = source.match(/^MANIFEST = \{([\s\S]*?)^\}/m);
  assert.ok(block, 'could not find MANIFEST in scripts/bundle_python.py');

  const pythonManifest = {};
  const rowPattern = /"([a-z0-9-]+)":\s*\{"packages":\s*\[([^\]]*)\],\s*"modules":\s*\[([^\]]*)\]\}/g;
  for (const match of block[1].matchAll(rowPattern)) {
    const names = (list) => [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    pythonManifest[match[1]] = { packages: names(match[2]), modules: names(match[3]) };
  }

  assert.ok(Object.keys(pythonManifest).length > 0, 'parsed no rows from the Python manifest');
  assert.deepEqual(
    Object.keys(BUNDLE_MANIFEST).sort(),
    Object.keys(pythonManifest).sort(),
    'the two bundlers disagree about which skills bundle tooling',
  );
  for (const [skill, entry] of Object.entries(BUNDLE_MANIFEST)) {
    assert.deepEqual(
      { packages: [...entry.packages].sort(), modules: [...entry.modules].sort() },
      {
        packages: pythonManifest[skill].packages.sort(),
        modules: pythonManifest[skill].modules.sort(),
      },
      `bundle payload for ${skill} differs between the two bundlers`,
    );
  }
});

test('every declared bundle source exists', () => {
  for (const rel of Object.values(BUNDLE_SOURCES)) {
    assert.ok(fs.existsSync(path.join(repoRoot, rel)), `missing package source: ${rel}`);
  }
  for (const rel of Object.values(BUNDLE_MODULE_SOURCES)) {
    assert.ok(fs.existsSync(path.join(repoRoot, rel)), `missing module source: ${rel}`);
  }
  for (const dataList of Object.values(BUNDLE_PACKAGE_DATA)) {
    for (const data of dataList) {
      assert.ok(fs.existsSync(path.join(repoRoot, data.from)), `missing package data: ${data.from}`);
    }
  }
});

test('installed bundles carry package data and the framework adapter', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-bundle-'));
  try {
    const result = spawnSync(process.execPath, [cli, 'install', '--yes', '--project', dir], {
      encoding: 'utf8',
      env: { ...process.env, QA_PACK_SOURCE: repoRoot, QA_LOG_LEVEL: 'error' },
    });
    assert.equal(result.status, 0, result.stderr);

    const lib = path.join(dir, '.agents', 'skills', 'qa-debug', BUNDLE_DEST);
    assert.ok(
      fs.existsSync(path.join(lib, 'qa_diagnostics', 'schemas', 'internal', 'diagnosis.schema.json')),
      'internal schemas must be bundled or the engine cannot validate a diagnosis',
    );
    assert.ok(
      fs.existsSync(path.join(lib, 'playwright_analysis.py')),
      'the Playwright adapter must be bundled where trace/report analysis is claimed',
    );
    assert.ok(fs.existsSync(path.join(lib, 'qa_analysis', 'cli.py')));
    assert.ok(fs.existsSync(path.join(lib, 'qa_diagnostics', 'cli.py')));

    // qa-run bundles the analysis core so it never normalizes a report by hand.
    const runLib = path.join(dir, '.agents', 'skills', 'qa-run', BUNDLE_DEST);
    assert.ok(fs.existsSync(path.join(runLib, 'qa_analysis', 'junit.py')));
    assert.ok(fs.existsSync(path.join(runLib, 'playwright_analysis.py')));

    // qa-init bundles the context contract so it can validate what it writes.
    const initLib = path.join(dir, '.agents', 'skills', 'qa-init', BUNDLE_DEST);
    assert.ok(
      fs.existsSync(path.join(initLib, 'qa_analysis', 'schemas', 'context.schema.json')),
      'the context contract must be bundled or `context` cannot validate',
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the installed diagnostics CLI runs from the bundle alone', (t) => {
  const python = pythonBin();
  if (!python) {
    t.skip('no Python interpreter available');
    return;
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-bundle-run-'));
  try {
    const install = spawnSync(process.execPath, [cli, 'install', '--yes', '--project', dir], {
      encoding: 'utf8',
      env: { ...process.env, QA_PACK_SOURCE: repoRoot, QA_LOG_LEVEL: 'error' },
    });
    assert.equal(install.status, 0, install.stderr);

    const lib = path.join(dir, '.agents', 'skills', 'qa-debug', BUNDLE_DEST);
    const execution = path.join(dir, 'execution-result.json');
    fs.writeFileSync(
      execution,
      JSON.stringify({
        tests: { total: 1, passed: 0, failed: 1, skipped: 0 },
        executed: [
          {
            title: 'checkout',
            status: 'failed',
            message: 'locator not found: #cart-button',
            file: 'tests/checkout.spec.ts',
            retries: 0,
          },
        ],
      }),
    );

    const run = spawnSync(
      python,
      ['-m', 'qa_diagnostics.cli', 'report', '--execution-result', execution],
      { encoding: 'utf8', env: { PYTHONPATH: lib, PATH: process.env.PATH ?? '' } },
    );
    assert.equal(run.status, 0, `bundled diagnostics CLI failed: ${run.stderr}`);

    const output = JSON.parse(run.stdout);
    assert.ok(output.diagnosis.entries.length > 0, 'no diagnosis entries');
    assert.equal(output.diagnosis.entries[0].rootCause.classification, 'locator-failure');
    assert.ok(output.plans.length > 0, 'no repair plans');
    assert.equal(output.summary.releaseReadiness, 'ready-with-risks');

    // The context validator must also work from the installed bundle, against
    // the schema that travelled with it.
    const initLib = path.join(dir, '.agents', 'skills', 'qa-init', BUNDLE_DEST);
    fs.mkdirSync(path.join(dir, '.qa'), { recursive: true });
    fs.copyFileSync(
      path.join(repoRoot, 'shared', 'analysis', 'lib', 'tests', 'fixtures', 'valid-context.md'),
      path.join(dir, '.qa', 'context.md'),
    );
    const context = spawnSync(python, ['-m', 'qa_analysis.cli', 'context', '--root', dir], {
      encoding: 'utf8',
      env: { PYTHONPATH: initLib, PATH: process.env.PATH ?? '' },
    });
    assert.equal(context.status, 0, `bundled context validator failed: ${context.stderr}`);
    const parsed = JSON.parse(context.stdout);
    assert.equal(parsed.valid, true, JSON.stringify(parsed.errors));
    assert.equal(parsed.schemaChecked, true, 'the context schema was not reachable from the bundle');
    assert.equal(parsed.context.testFramework.e2e, 'playwright');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
