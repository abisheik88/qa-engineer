// Uninstall tests — the lifecycle's missing half.
//
// fs-safe.mjs opens with "Every install, update, or uninstall runs through a
// Transaction", but no uninstall existed. These tests hold the new command to
// that promise: it removes exactly what the lockfile records, never the user's
// files, backs up what it deletes, and refuses to discard local changes unless
// explicitly told to.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const installerRoot = path.resolve(here, '..');
const repoRoot = path.resolve(here, '..', '..', '..');
const cli = path.join(installerRoot, 'bin', 'qa.mjs');

function runQa(args, { cwd = repoRoot } = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, QA_PACK_SOURCE: repoRoot, QA_LOG_LEVEL: 'error' },
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

/** A project with one user-owned file, plus an installed pack. */
function installedProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-uninstall-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"demo"}\n');
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const a = 1;\n');
  const install = runQa(['install', '--yes', '--project', dir]);
  assert.equal(install.status, 0, install.stderr);
  return dir;
}

function lockedPaths(dir) {
  const lock = JSON.parse(fs.readFileSync(path.join(dir, 'qa-lock.json'), 'utf8'));
  return lock.files.map((f) => f.path);
}

test('uninstall removes every lockfile-listed file and the lockfile itself', () => {
  const dir = installedProject();
  try {
    const paths = lockedPaths(dir);
    assert.ok(paths.length > 50, 'expected a substantial install');

    const result = runQa(['uninstall', '--project', dir, '--json']);
    assert.equal(result.status, 0, result.stderr);

    for (const rel of paths) {
      assert.ok(!fs.existsSync(path.join(dir, rel)), `still present: ${rel}`);
    }
    assert.ok(!fs.existsSync(path.join(dir, 'qa-lock.json')), 'lockfile survived');
    assert.ok(!fs.existsSync(path.join(dir, '.agents', 'skills')), 'skills dir survived');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('uninstall never touches files the pack does not own', () => {
  const dir = installedProject();
  try {
    // A user file inside a pack-owned directory is the hard case.
    const strayDir = path.join(dir, '.agents', 'skills', 'my-own-skill');
    fs.mkdirSync(strayDir, { recursive: true });
    fs.writeFileSync(path.join(strayDir, 'SKILL.md'), '# mine\n');

    const result = runQa(['uninstall', '--project', dir, '--json']);
    assert.equal(result.status, 0, result.stderr);

    assert.equal(fs.readFileSync(path.join(dir, 'src', 'app.ts'), 'utf8'), 'export const a = 1;\n');
    assert.equal(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'), '{"name":"demo"}\n');
    assert.ok(fs.existsSync(path.join(strayDir, 'SKILL.md')), 'a user-owned skill was deleted');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('uninstall --dry-run writes nothing', () => {
  const dir = installedProject();
  try {
    const before = lockedPaths(dir);
    const result = runQa(['uninstall', '--project', dir, '--dry-run', '--json']);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.dryRun, true);
    assert.ok(report.removed > 0, 'dry run should report what it would remove');

    for (const rel of before) {
      assert.ok(fs.existsSync(path.join(dir, rel)), `dry run removed ${rel}`);
    }
    assert.ok(fs.existsSync(path.join(dir, 'qa-lock.json')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('uninstall refuses to discard local changes without --force', () => {
  const dir = installedProject();
  try {
    const target = path.join(dir, '.agents', 'skills', 'qa-run', 'SKILL.md');
    fs.appendFileSync(target, '\n<!-- a local edit worth keeping -->\n');

    const blocked = runQa(['uninstall', '--project', dir]);
    assert.notEqual(blocked.status, 0, 'drift must stop an uninstall');
    assert.ok(fs.existsSync(target), 'the edited file was removed anyway');
    assert.ok(fs.existsSync(path.join(dir, 'qa-lock.json')), 'lockfile removed despite refusal');

    const forced = runQa(['uninstall', '--project', dir, '--force', '--json']);
    assert.equal(forced.status, 0, forced.stderr);
    assert.ok(!fs.existsSync(target), '--force should remove the drifted file');
    assert.equal(JSON.parse(forced.stdout).driftedRemoved, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('uninstall backs up what it deletes', () => {
  const dir = installedProject();
  try {
    const result = runQa(['uninstall', '--project', dir, '--json']);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.ok(report.backupDir, 'no backup directory reported');
    assert.ok(
      fs.existsSync(path.join(report.backupDir, '.agents', 'skills', 'qa-run', 'SKILL.md')),
      'a removed skill file is not recoverable from the backup',
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('uninstall without a lockfile fails with a clear message', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-uninstall-bare-'));
  try {
    const result = runQa(['uninstall', '--project', dir]);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /qa-lock\.json/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('install → verify → uninstall → install is a clean round trip', () => {
  const dir = installedProject();
  try {
    assert.equal(runQa(['verify', '--project', dir]).status, 0);
    assert.equal(runQa(['uninstall', '--project', dir, '--json']).status, 0);
    assert.notEqual(runQa(['verify', '--project', dir]).status, 0, 'verify passed after uninstall');

    const reinstall = runQa(['install', '--yes', '--project', dir]);
    assert.equal(reinstall.status, 0, reinstall.stderr);
    assert.equal(runQa(['verify', '--project', dir]).status, 0, 'reinstall did not verify');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('uninstall appears in help and is a known command', () => {
  const help = runQa(['help']);
  assert.match(help.stdout, /uninstall/);
  const unknown = runQa(['uninstal', '--project', repoRoot]);
  assert.notEqual(unknown.status, 0, 'a typo must not silently run something');
});
