#!/usr/bin/env node
// Release validation — reproducible checks without publishing.
// Verifies version consistency, package identity, changelog presence, and packability.

import fs from 'node:fs';
import os from 'node:os';
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

if (rootPkg.name !== 'qa-engineer') {
  problems.push(`root package name must be qa-engineer, got ${rootPkg.name}`);
}
// `npx <package>` runs the bin whose name matches the package; without it npm
// cannot pick a default binary and the documented install command fails.
if (!rootPkg.bin?.[rootPkg.name]) {
  problems.push(
    `root package.json must expose a bin named "${rootPkg.name}" so \`npx ${rootPkg.name}\` resolves`,
  );
}
if (!rootPkg.bin?.qa) {
  problems.push('root package.json must keep the short bin.qa');
}
if (rootPkg.version !== installerPkg.version) {
  problems.push(
    `version mismatch: root ${rootPkg.version} vs installer ${installerPkg.version}`,
  );
}
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(rootPkg.version)) {
  problems.push(`root version is not semver: ${rootPkg.version}`);
}

// The lockfile must agree with package.json, or `npm ci` refuses to run — which
// takes down every CI job that installs dependencies, in seconds, with an error
// that does not name the cause. Renaming the package to qa-engineer without
// regenerating the lockfile did exactly that, and nothing here caught it.
const lock = readJson('package-lock.json');
if (lock.name !== rootPkg.name) {
  problems.push(
    `package-lock.json name "${lock.name}" does not match package.json "${rootPkg.name}" — ` +
      'npm ci will fail; run: npm install --package-lock-only',
  );
}
if (lock.version !== rootPkg.version) {
  problems.push(
    `package-lock.json version ${lock.version} does not match package.json ${rootPkg.version} — ` +
      'run: npm install --package-lock-only',
  );
}
if (lock.packages?.['']?.name && lock.packages[''].name !== rootPkg.name) {
  problems.push(
    `package-lock.json packages[""].name "${lock.packages[''].name}" is stale — ` +
      'run: npm install --package-lock-only',
  );
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

// --- The packed tarball must actually RUN -------------------------------------
// Everything above inspects a file *listing* against paths this script knows to
// look for. That can only catch omissions somebody predicted, and it missed the
// one that mattered: moving the schema validator into packages/engine/ without
// adding that directory to `files` shipped a 0.9.2 in which `lockfile.mjs`
// imported a file that was not in the package. Every command died on
// ERR_MODULE_NOT_FOUND — `--version` included — and this gate reported OK,
// because it had no idea that import existed.
//
// So the tarball is unpacked and the CLI is executed out of it. Third-party
// dependencies are linked in from this checkout, which is exactly the isolation
// wanted: node_modules resolves, and everything the package owns can only come
// from the tarball. Any unshipped import now fails here instead of on a user's
// machine.
{
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-release-'));
  try {
    const packed = spawnSync('npm', ['pack', '--pack-destination', scratch, '--json'], {
      cwd: root,
      encoding: 'utf8',
    });
    if (packed.status !== 0) {
      problems.push(`npm pack failed: ${(packed.stderr || '').trim().split('\n').pop()}`);
    } else {
      const filename = JSON.parse(packed.stdout)[0].filename;
      const extract = spawnSync('tar', ['-xzf', path.join(scratch, filename), '-C', scratch], {
        encoding: 'utf8',
      });
      if (extract.status !== 0) {
        // Reported, never skipped: a check that quietly does nothing is worse
        // than no check, because it reports safety it never verified.
        problems.push(`could not unpack the tarball (tar exited ${extract.status}): ${extract.stderr}`);
      } else {
        const unpacked = path.join(scratch, 'package');
        // Link, do not copy: dependencies resolve, our own files cannot leak in.
        fs.symlinkSync(path.join(root, 'node_modules'), path.join(unpacked, 'node_modules'), 'dir');
        const cli = path.join(unpacked, 'packages', 'installer', 'bin', 'qa.mjs');

        const runs = (args) =>
          spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', cwd: scratch });

        const version = runs(['--version']);
        if (version.status !== 0) {
          problems.push(
            'the packed CLI cannot run `--version`: ' +
              (version.stderr || version.stdout || '').trim().split('\n').slice(0, 3).join(' | '),
          );
        } else if (!version.stdout.includes(rootPkg.version)) {
          problems.push(
            `the packed CLI reports "${version.stdout.trim()}" instead of ${rootPkg.version} — ` +
              'it cannot resolve its own version from the tarball',
          );
        }

        // `doctor` reaches further into the import graph than `--version` does:
        // config, lockfile, the registry, the validator, and the framework
        // registry. If any of those is unshipped, it surfaces here.
        const doctor = runs(['doctor', '--json', '--project', scratch]);
        if (doctor.status !== 0 && doctor.status !== 1) {
          // 1 is a legitimate "checks failed" verdict in a bare directory; a crash
          // is not.
          problems.push(
            'the packed CLI cannot run `doctor`: ' +
              (doctor.stderr || doctor.stdout || '').trim().split('\n').slice(0, 3).join(' | '),
          );
        } else {
          try {
            JSON.parse(doctor.stdout);
          } catch {
            problems.push('the packed CLI\'s `doctor --json` did not emit JSON');
          }
        }
      }
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

if (problems.length) {
  console.error('release validation failed:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`release validation OK (${rootPkg.name}@${rootPkg.version})`);
