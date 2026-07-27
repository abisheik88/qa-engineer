#!/usr/bin/env node
// Release validation — reproducible checks without publishing.
// Verifies version consistency, package identity, changelog presence, and packability.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  BUNDLE_SOURCES,
  BUNDLE_MODULE_SOURCES,
  BUNDLE_PACKAGE_DATA,
} from '../../packages/installer/lib/core/manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const problems = [];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

const rootPkg = readJson('package.json');
const installerPkg = readJson('packages/installer/package.json');

if (rootPkg.name !== 'qa-automation-pack') {
  problems.push(`root package name must be qa-automation-pack, got ${rootPkg.name}`);
}
if (!rootPkg.bin?.qa || !rootPkg.bin?.['qa-pack']) {
  problems.push('root package.json must expose bin.qa and bin.qa-pack');
}
if (rootPkg.version !== installerPkg.version) {
  problems.push(
    `version mismatch: root ${rootPkg.version} vs installer ${installerPkg.version}`,
  );
}
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(rootPkg.version)) {
  problems.push(`root version is not semver: ${rootPkg.version}`);
}

const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
if (!changelog.includes('## [Unreleased]')) {
  problems.push('CHANGELOG.md must contain ## [Unreleased]');
}

// Tag consistency when running on a version tag (optional)
const tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : null;
if (tag && tag.startsWith('v')) {
  const expected = `v${rootPkg.version}`;
  if (tag !== expected) {
    problems.push(`git tag ${tag} does not match package version ${expected}`);
  }
}

// files allowlist must include skills and installer
for (const must of ['skills', 'packages/installer/bin', 'packages/installer/lib']) {
  if (!(rootPkg.files || []).some((f) => f === must || f.startsWith(`${must}/`) || must.startsWith(f))) {
    // allow prefix match: "skills" in files
    if (!(rootPkg.files || []).includes(must.split('/')[0]) && !(rootPkg.files || []).includes(must)) {
      problems.push(`package.json files[] should include ${must}`);
    }
  }
}

if (!fs.existsSync(path.join(root, 'shared/frameworks/registry.json'))) {
  problems.push('canonical framework registry missing');
}

// --- Tarball contents -------------------------------------------------------
// The installer bundles code from shared/ into consumer projects, so anything it
// can bundle must actually ship. A path the installer references but the tarball
// omits is an install-time failure for every user, invisible from this checkout.
const pack = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: root, encoding: 'utf8' });
if (pack.status !== 0) {
  problems.push(`npm pack --dry-run failed: ${(pack.stderr || '').trim().split('\n').pop()}`);
} else {
  let shipped = [];
  try {
    shipped = JSON.parse(pack.stdout)[0].files.map((f) => f.path);
  } catch (error) {
    problems.push(`could not parse npm pack output: ${error.message}`);
  }
  const shippedSet = new Set(shipped);
  const ships = (rel) => shippedSet.has(rel) || shipped.some((f) => f.startsWith(`${rel}/`));

  for (const rel of Object.values(BUNDLE_SOURCES)) {
    if (!ships(rel)) problems.push(`tarball omits bundled package source: ${rel}`);
  }
  for (const rel of Object.values(BUNDLE_MODULE_SOURCES)) {
    if (!ships(rel)) problems.push(`tarball omits bundled module source: ${rel}`);
  }
  for (const dataList of Object.values(BUNDLE_PACKAGE_DATA)) {
    for (const data of dataList) {
      if (!ships(data.from)) problems.push(`tarball omits bundled package data: ${data.from}`);
    }
  }
  if (!ships('shared/frameworks/registry.json')) {
    problems.push('tarball omits the canonical framework registry');
  }
  // version.mjs resolves the version from a shipped manifest. Omit it and the
  // published CLI reports 0.0.0 and writes 0.0.0 into every lockfile.
  if (!shippedSet.has('packages/installer/package.json')) {
    problems.push(
      'tarball omits packages/installer/package.json — the published CLI cannot resolve its version',
    );
  }

  // Build artifacts and test fixtures do not belong in a published package.
  const junk = shipped.filter((f) => f.includes('__pycache__') || f.endsWith('.pyc'));
  if (junk.length > 0) {
    problems.push(`tarball ships ${junk.length} Python build artifact(s), e.g. ${junk[0]}`);
  }
  const tests = shipped.filter((f) => f.includes('/tests/'));
  if (tests.length > 0) {
    problems.push(`tarball ships ${tests.length} test file(s), e.g. ${tests[0]}`);
  }
}

if (problems.length) {
  console.error('release validation failed:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`release validation OK (qa-automation-pack@${rootPkg.version})`);
