// Security tests for filesystem mutation.
//
// `qa-lock.json` is committed to the consumer's repository, so it travels with a
// clone: its contents are attacker-influenced input, not installer-trusted data.
// Since `uninstall` deletes exactly what the lockfile lists, a `..` segment in a
// recorded path would delete outside the project. This was reproducible before
// containment was enforced in fs-safe.mjs, and these tests keep it closed.
//
// Defence is layered, and both layers are tested here:
//   1. the lockfile schema rejects absolute paths and `..` segments on read;
//   2. the Transaction refuses to write or delete outside the project root, so
//      any future caller that bypasses the schema is still contained.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Transaction } from '../lib/core/fs-safe.mjs';
import { validate } from '../lib/core/schema-validate.mjs';
import { LOCK_SCHEMA } from '../lib/core/lockfile.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const installerRoot = path.resolve(here, '..');
const repoRoot = path.resolve(here, '..', '..', '..');
const cli = path.join(installerRoot, 'bin', 'qa.mjs');

function runQa(args, cwd = repoRoot) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, QA_PACK_SOURCE: repoRoot, QA_LOG_LEVEL: 'error' },
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

test('the Transaction refuses to write outside the project root', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-sec-'));
  try {
    const tx = new Transaction(dir, path.join(dir, '.qa', 'backups', 'x'));
    for (const escape of ['../escaped.txt', '../../escaped.txt', 'a/../../escaped.txt', '..']) {
      assert.throws(() => tx.write(escape, 'x'), /outside the project/, `allowed: ${escape}`);
    }
    assert.throws(() => tx.write('/etc/passwd', 'x'), /absolute path/);
    assert.throws(() => tx.write('', 'x'), /empty path/);
    // A legitimate nested path still works.
    tx.write('.agents/skills/qa/SKILL.md', 'ok');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the Transaction refuses to delete outside the project root', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-sec-'));
  const project = path.join(parent, 'project');
  fs.mkdirSync(project);
  const bystander = path.join(parent, 'bystander.txt');
  fs.writeFileSync(bystander, 'must survive\n');
  try {
    const tx = new Transaction(project, path.join(project, '.qa', 'backups', 'x'));
    assert.throws(() => tx.delete('../bystander.txt'), /outside the project/);
    assert.equal(fs.readFileSync(bystander, 'utf8'), 'must survive\n');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('the lockfile schema rejects escaping and absolute paths', () => {
  const pathSchema = LOCK_SCHEMA.properties.files.items.properties.path;
  for (const bad of ['../outside.txt', '/etc/passwd', 'a/../../b', '..', 'ok/../fine']) {
    assert.ok(validate(bad, pathSchema).length > 0, `schema accepted ${bad}`);
  }
  for (const good of ['.agents/skills/qa/SKILL.md', 'a/..b/c', 'qa-lock.json']) {
    assert.deepEqual(validate(good, pathSchema), [], `schema rejected ${good}`);
  }
});

test('uninstall cannot be redirected outside the project by a hostile lockfile', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-sec-'));
  const project = path.join(parent, 'project');
  fs.mkdirSync(project);
  const bystander = path.join(parent, 'bystander.txt');
  fs.writeFileSync(bystander, 'must survive\n');
  fs.writeFileSync(path.join(project, 'package.json'), '{"name":"victim"}\n');

  try {
    assert.equal(runQa(['install', '--yes', '--project', project]).status, 0);

    // Simulate a lockfile that arrived with a cloned repository.
    const lockPath = path.join(project, 'qa-lock.json');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lock.files.push({
      path: '../bystander.txt',
      sha256: crypto.createHash('sha256').update(fs.readFileSync(bystander)).digest('hex'),
      bytes: fs.statSync(bystander).size,
      owner: 'skill',
    });
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2));

    const result = runQa(['uninstall', '--project', project]);
    assert.notEqual(result.status, 0, 'a hostile lockfile must not produce a successful uninstall');
    assert.ok(
      fs.existsSync(bystander),
      'FILE OUTSIDE THE PROJECT WAS DELETED — path traversal is open',
    );
    assert.equal(fs.readFileSync(bystander, 'utf8'), 'must survive\n');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('verify reports a hostile lockfile rather than acting on it', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-sec-'));
  const project = path.join(parent, 'project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'package.json'), '{"name":"victim"}\n');
  try {
    assert.equal(runQa(['install', '--yes', '--project', project]).status, 0);
    const lockPath = path.join(project, 'qa-lock.json');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lock.files.push({ path: '/etc/passwd', sha256: 'a'.repeat(64), bytes: 1, owner: 'skill' });
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2));

    const result = runQa(['verify', '--project', project]);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /schema|path/i);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('a symlink cannot carry a mutation out of the project', () => {
  // Lexical containment is not enough: `path.resolve` does not follow symlinks
  // but `fs` does, and git stores symlinks — so a hostile repository can ship
  // `escape-hatch -> /` plus a lockfile entry through it. Reproduced before the
  // real-path check existed.
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-sec-'));
  const project = path.join(parent, 'project');
  fs.mkdirSync(project);
  const secret = path.join(parent, 'outside-secret.txt');
  fs.writeFileSync(secret, 'must survive\n');
  fs.symlinkSync(parent, path.join(project, 'escape-hatch'), 'dir');

  try {
    const tx = new Transaction(project, path.join(project, '.qa', 'backups', 'x'));
    assert.throws(
      () => tx.delete('escape-hatch/outside-secret.txt'),
      /link out of the project/,
      'a delete through a symlink was allowed',
    );
    assert.throws(
      () => tx.write('escape-hatch/planted.txt', 'x'),
      /link out of the project/,
      'a write through a symlink was allowed',
    );
    assert.equal(fs.readFileSync(secret, 'utf8'), 'must survive\n');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('uninstall refuses a lockfile that points through a symlink', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-sec-'));
  const project = path.join(parent, 'project');
  fs.mkdirSync(project);
  const secret = path.join(parent, 'outside-secret.txt');
  fs.writeFileSync(secret, 'must survive\n');
  fs.writeFileSync(path.join(project, 'package.json'), '{"name":"victim"}\n');

  try {
    assert.equal(runQa(['install', '--yes', '--project', project]).status, 0);
    fs.symlinkSync(parent, path.join(project, 'escape-hatch'), 'dir');

    const lockPath = path.join(project, 'qa-lock.json');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lock.files.push({
      path: 'escape-hatch/outside-secret.txt', // lexically inside the project
      sha256: crypto.createHash('sha256').update(fs.readFileSync(secret)).digest('hex'),
      bytes: fs.statSync(secret).size,
      owner: 'skill',
    });
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2));

    const result = runQa(['uninstall', '--project', project]);
    assert.notEqual(result.status, 0);
    assert.ok(fs.existsSync(secret), 'SYMLINK ESCAPE — a file outside the project was deleted');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('version-control directories are never touched', () => {
  // A lockfile listing .git/hooks/pre-commit must not be able to delete it:
  // repository metadata is not the installer's to modify, and the loss is not
  // recoverable from the pack's own backups in any useful sense.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-sec-'));
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"victim"}\n');
    fs.mkdirSync(path.join(dir, '.git', 'hooks'), { recursive: true });
    const hook = path.join(dir, '.git', 'hooks', 'pre-commit');
    fs.writeFileSync(hook, '#!/bin/sh\necho original\n');

    assert.equal(runQa(['install', '--yes', '--project', dir]).status, 0);
    const lockPath = path.join(dir, 'qa-lock.json');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lock.files.push({
      path: '.git/hooks/pre-commit',
      sha256: crypto.createHash('sha256').update(fs.readFileSync(hook)).digest('hex'),
      bytes: fs.statSync(hook).size,
      owner: 'skill',
    });
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2));

    const result = runQa(['uninstall', '--project', dir]);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /\.git/);
    assert.equal(fs.readFileSync(hook, 'utf8'), '#!/bin/sh\necho original\n');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the Transaction rejects null bytes and VCS paths at staging time', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-sec-'));
  try {
    const tx = new Transaction(dir, path.join(dir, '.qa', 'backups', 'x'));
    assert.throws(() => tx.write('a\0b.txt', 'x'), /null byte/);
    for (const vcs of ['.git/config', 'nested/.git/config', '.hg/store', '.svn/entries']) {
      assert.throws(() => tx.delete(vcs), /version-control|inside \./, `allowed: ${vcs}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a hostile project directory name cannot inject a shell command', () => {
  // Every child process is spawned with an argv array and no shell, so
  // metacharacters in a path are inert. Verified rather than assumed.
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-sec-'));
  const canary = path.join(parent, 'INJECTED');
  const hostileNames = [
    `p; touch ${canary}`,
    `p$(touch ${canary})`,
    `p&&touch ${canary}`,
    "p'quote",
    'p with spaces',
  ];
  try {
    for (const name of hostileNames) {
      const dir = path.join(parent, name);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"x"}\n');
      const result = runQa(['install', '--yes', '--project', dir]);
      assert.equal(result.status, 0, `install failed for ${name}: ${result.stderr}`);
      assert.ok(fs.existsSync(path.join(dir, '.agents', 'skills', 'qa-run', 'SKILL.md')));
    }
    assert.ok(!fs.existsSync(canary), 'a shell command from a directory name executed');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('install does not execute code from the project it installs into', () => {
  // SECURITY.md guarantees no code execution at install time. A malicious
  // package.json script must not run.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-sec-'));
  const canary = path.join(dir, 'canary.txt');
  try {
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'hostile',
        scripts: {
          preinstall: `node -e "require('fs').writeFileSync('${canary.replace(/\\/g, '\\\\')}','executed')"`,
          prepare: `node -e "require('fs').writeFileSync('${canary.replace(/\\/g, '\\\\')}','executed')"`,
        },
      }),
    );
    assert.equal(runQa(['install', '--yes', '--project', dir]).status, 0);
    assert.ok(!fs.existsSync(canary), 'the installer executed a script from the target project');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
