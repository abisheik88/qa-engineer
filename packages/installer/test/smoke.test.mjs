// Installer smoke test — proves the `qa` CLI actually installs, verifies, and
// reports, so the "installer shipped" claim is backed by an executable check
// rather than documentation. Behavioral: it drives the real bin/qa.mjs through
// child processes against a throwaway project directory.
//
// Run with: npm test   (from the repo root) or: node --test packages/installer/test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const installerRoot = path.resolve(here, '..'); // packages/installer
const repoRoot = path.resolve(here, '..', '..', '..'); // pack root
const cli = path.join(installerRoot, 'bin', 'qa.mjs');

const packVersion = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
).version;

/** Run the CLI with QA_PACK_SOURCE pinned to this checkout. */
function runQa(args, { cwd = repoRoot } = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, QA_PACK_SOURCE: repoRoot, QA_LOG_LEVEL: 'error' },
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function mkProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-smoke-'));
  // Mark it as a Claude Code project so detection has something to find.
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  return dir;
}

test('version matches the root package.json', () => {
  const { status, stdout } = runQa(['version']);
  assert.equal(status, 0);
  assert.equal(stdout.trim(), packVersion);
});

test('doctor reports a machine-readable environment summary', () => {
  const project = mkProject();
  try {
    const { status, stdout } = runQa(['doctor', '--project', project, '--json']);
    assert.equal(status, 0);
    const report = JSON.parse(stdout);
    assert.equal(report.packVersion, packVersion);
    assert.ok(Array.isArray(report.knownAgents) && report.knownAgents.includes('claude-code'));
    assert.equal(report.lockfilePresent, false);
    assert.ok(Array.isArray(report.checklist));
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('install copies skills and writes a lockfile, then verify passes', () => {
  const project = mkProject();
  try {
    const install = runQa(['install', '--agent', 'claude-code', '--project', project]);
    assert.equal(install.status, 0, install.stderr);

    // A known skill landed in the Claude Code discovery path.
    const skillFile = path.join(project, '.claude', 'skills', 'qa', 'SKILL.md');
    assert.ok(fs.existsSync(skillFile), 'expected qa/SKILL.md to be installed');

    // The lockfile exists and records the pack version and at least one file.
    const lock = JSON.parse(fs.readFileSync(path.join(project, 'qa-lock.json'), 'utf8'));
    assert.equal(lock.pack.version, packVersion);
    assert.ok(lock.files.length > 0);

    // verify sees a clean install.
    const verify = runQa(['verify', '--project', project]);
    assert.equal(verify.status, 0, verify.stderr);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('verify detects drift after an installed file is modified', () => {
  const project = mkProject();
  try {
    assert.equal(runQa(['install', '--agent', 'claude-code', '--project', project]).status, 0);
    const skillFile = path.join(project, '.claude', 'skills', 'qa', 'SKILL.md');
    fs.appendFileSync(skillFile, '\n<!-- tampered -->\n');

    const verify = runQa(['verify', '--project', project]);
    assert.notEqual(verify.status, 0, 'verify should fail when an installed file drifts');
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('an unknown command exits with the usage code', () => {
  const { status } = runQa(['definitely-not-a-command']);
  assert.equal(status, 2);
});

test('dry-run install writes nothing to the project', () => {
  const project = mkProject();
  try {
    const { status } = runQa(['install', '--agent', 'claude-code', '--project', project, '--dry-run']);
    assert.equal(status, 0);
    assert.ok(!fs.existsSync(path.join(project, 'qa-lock.json')), 'dry-run must not write a lockfile');
    assert.ok(!fs.existsSync(path.join(project, '.claude', 'skills', 'qa')), 'dry-run must not copy skills');
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});
