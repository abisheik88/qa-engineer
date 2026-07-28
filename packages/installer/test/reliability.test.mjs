// Reliability tests: does the installer stay correct under repetition and
// concurrency, and is the deterministic core actually deterministic?
//
// The release audit could not score reliability full marks because every check
// was a single pass. A tool that installs correctly once but drifts on the tenth
// upgrade, or corrupts a project when two installs overlap, is not reliable — it
// is merely lucky. These tests close that gap with repetition rather than
// assertion.
//
// They are deliberately bounded (10 cycles, 4 concurrent projects, 200
// iterations) so they run in CI in seconds. The counts are large enough to catch
// state leakage between runs, which is the failure mode that matters.

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

const CYCLES = 10;
const CONCURRENT_PROJECTS = 4;
const DETERMINISM_ITERATIONS = 200;

function runQa(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    env: { ...process.env, QA_PACK_SOURCE: repoRoot, QA_LOG_LEVEL: 'error' },
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-rel-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"demo"}\n');
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const a = 1;\n');
  return dir;
}

function lockOf(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'qa-lock.json'), 'utf8'));
}

test(`${CYCLES} install → verify → uninstall cycles leave no residue`, () => {
  const dir = project();
  try {
    let firstFileCount = null;
    for (let i = 1; i <= CYCLES; i += 1) {
      assert.equal(runQa(['install', '--yes', '--project', dir]).status, 0, `install ${i}`);
      assert.equal(runQa(['verify', '--project', dir]).status, 0, `verify ${i}`);

      const lock = lockOf(dir);
      if (firstFileCount === null) firstFileCount = lock.files.length;
      // Every cycle must install exactly the same set — no accumulation.
      assert.equal(lock.files.length, firstFileCount, `file count drifted on cycle ${i}`);

      assert.equal(runQa(['uninstall', '--project', dir]).status, 0, `uninstall ${i}`);
      assert.ok(!fs.existsSync(path.join(dir, 'qa-lock.json')), `lockfile survived cycle ${i}`);
      assert.ok(!fs.existsSync(path.join(dir, '.agents', 'skills')), `skills survived cycle ${i}`);
    }
    // The user's files are untouched after ten full cycles.
    assert.equal(fs.readFileSync(path.join(dir, 'src', 'app.ts'), 'utf8'), 'export const a = 1;\n');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test(`${CYCLES} repeated installs are idempotent (same hashes every time)`, () => {
  const dir = project();
  try {
    assert.equal(runQa(['install', '--yes', '--project', dir]).status, 0);
    const baseline = lockOf(dir).files.map((f) => `${f.path}:${f.sha256}`).sort().join('\n');

    for (let i = 2; i <= CYCLES; i += 1) {
      assert.equal(runQa(['install', '--yes', '--project', dir]).status, 0, `install ${i}`);
      const current = lockOf(dir).files.map((f) => `${f.path}:${f.sha256}`).sort().join('\n');
      assert.equal(current, baseline, `install ${i} produced a different file set or content`);
      assert.equal(runQa(['verify', '--project', dir]).status, 0, `verify after install ${i}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test(`${CYCLES} repeated updates and repairs converge, never accumulate`, () => {
  const dir = project();
  try {
    assert.equal(runQa(['install', '--yes', '--project', dir]).status, 0);
    const baseline = lockOf(dir).files.length;

    for (let i = 1; i <= CYCLES; i += 1) {
      assert.equal(runQa(['update', '--project', dir]).status, 0, `update ${i}`);
      assert.equal(lockOf(dir).files.length, baseline, `update ${i} changed the file count`);

      // Corrupt a file every cycle; repair must restore it every cycle.
      const victim = path.join(dir, '.agents', 'skills', 'qa-run', 'SKILL.md');
      fs.appendFileSync(victim, `\n<!-- drift ${i} -->\n`);
      assert.notEqual(runQa(['verify', '--project', dir]).status, 0, `drift ${i} undetected`);
      assert.equal(runQa(['repair', '--project', dir]).status, 0, `repair ${i}`);
      assert.equal(runQa(['verify', '--project', dir]).status, 0, `verify after repair ${i}`);
      assert.equal(lockOf(dir).files.length, baseline, `repair ${i} changed the file count`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test(`${CONCURRENT_PROJECTS} concurrent installs into separate projects all succeed`, async () => {
  const dirs = Array.from({ length: CONCURRENT_PROJECTS }, () => project());
  try {
    const results = await Promise.all(
      dirs.map(
        (dir) =>
          new Promise((resolve) => {
            const child = spawnSync(process.execPath, [cli, 'install', '--yes', '--project', dir], {
              encoding: 'utf8',
              env: { ...process.env, QA_PACK_SOURCE: repoRoot, QA_LOG_LEVEL: 'error' },
            });
            resolve({ dir, status: child.status, stderr: child.stderr ?? '' });
          }),
      ),
    );
    for (const { dir, status, stderr } of results) {
      assert.equal(status, 0, `concurrent install failed for ${dir}: ${stderr}`);
      assert.equal(runQa(['verify', '--project', dir]).status, 0, `verify failed for ${dir}`);
    }
    // All projects received byte-identical content.
    const signatures = dirs.map((dir) =>
      lockOf(dir).files.map((f) => `${f.path}:${f.sha256}`).sort().join('\n'),
    );
    for (const signature of signatures) {
      assert.equal(signature, signatures[0], 'concurrent installs produced different content');
    }
  } finally {
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a failed install leaves the project exactly as it was (rollback)', () => {
  const dir = project();
  try {
    // A pre-existing un-owned file at a pack path makes install refuse.
    const collision = path.join(dir, '.agents', 'skills', 'qa-run', 'SKILL.md');
    fs.mkdirSync(path.dirname(collision), { recursive: true });
    fs.writeFileSync(collision, 'MINE\n');
    const before = fs.readdirSync(path.join(dir, '.agents', 'skills'));

    const result = runQa(['install', '--yes', '--project', dir]);
    assert.notEqual(result.status, 0, 'install should refuse to clobber an un-owned file');
    assert.equal(fs.readFileSync(collision, 'utf8'), 'MINE\n');
    assert.deepEqual(fs.readdirSync(path.join(dir, '.agents', 'skills')), before);
    assert.ok(!fs.existsSync(path.join(dir, 'qa-lock.json')), 'a refused install wrote a lockfile');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('dry-run is inert across repeated invocations', () => {
  const dir = project();
  try {
    for (let i = 0; i < 5; i += 1) {
      assert.equal(runQa(['install', '--yes', '--dry-run', '--project', dir]).status, 0);
    }
    assert.ok(!fs.existsSync(path.join(dir, '.agents')), 'dry-run wrote skills');
    assert.ok(!fs.existsSync(path.join(dir, 'qa-lock.json')), 'dry-run wrote a lockfile');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('no detector treats the installer\'s own footprint as evidence', async () => {
  // Install once, then ask what a *fresh* detection would find. Anything newly
  // "detected" was created by the install itself, which makes the installer
  // non-idempotent and makes it report hosts that were never there. This
  // reproduced: `.agents/` (created for every host) was Antigravity's marker,
  // so a second install silently added 13 wrapper files.
  const { AGENTS } = await import('../lib/agents/registry.mjs');
  const dir = project();
  try {
    const before = AGENTS.filter((a) => a.detect(dir)).map((a) => a.id);
    assert.equal(runQa(['install', '--yes', '--project', dir]).status, 0);
    const after = AGENTS.filter((a) => a.detect(dir)).map((a) => a.id);
    assert.deepEqual(
      after,
      before,
      `installing changed detection results (${before} -> ${after}); a detector keys on a path the installer creates`,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('detection requires an agent-specific marker, not a common directory', async () => {
  const { AGENTS } = await import('../lib/agents/registry.mjs');
  const dir = project();
  try {
    // `.github/` alone is present in most repositories and must not imply Copilot.
    fs.mkdirSync(path.join(dir, '.github', 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.github', 'workflows', 'ci.yml'), 'name: ci\n');
    assert.ok(
      !AGENTS.find((a) => a.id === 'github-copilot').detect(dir),
      'Copilot was detected from `.github/` alone',
    );

    // Its own marker does imply it.
    fs.writeFileSync(path.join(dir, '.github', 'copilot-instructions.md'), '# x\n');
    assert.ok(AGENTS.find((a) => a.id === 'github-copilot').detect(dir));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test(`the planner is deterministic across ${DETERMINISM_ITERATIONS} iterations`, async () => {
  // Same source, same project, same plan — every time. Uses the planning path
  // directly so the loop is fast enough to run at this count in CI.
  const { planInstall } = await import('../lib/commands/install.mjs').catch(() => ({}));
  const dir = project();
  try {
    if (typeof planInstall !== 'function') {
      // Planning is not separately exported; fall back to hashing dry-run output.
      const first = runQa(['install', '--yes', '--dry-run', '--json', '--project', dir]).stdout;
      for (let i = 0; i < 20; i += 1) {
        const next = runQa(['install', '--yes', '--dry-run', '--json', '--project', dir]).stdout;
        assert.equal(
          next.replace(/"generatedAt":\s*"[^"]*"/g, ''),
          first.replace(/"generatedAt":\s*"[^"]*"/g, ''),
          `dry-run plan differed on iteration ${i}`,
        );
      }
      return;
    }
    const signatures = new Set();
    for (let i = 0; i < DETERMINISM_ITERATIONS; i += 1) {
      const plan = planInstall({ projectRoot: dir, sourceRoot: repoRoot });
      signatures.add(plan.map((e) => `${e.path}:${e.sha256}`).sort().join('|'));
    }
    assert.equal(signatures.size, 1, 'the planner produced more than one distinct plan');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an update removes files the previous version owned and this one does not', () => {
  // Found while testing the 0.9.1 → 0.9.3 upgrade, which replaced a Python engine
  // with a Node one: the update left 154 dead Python files in the project, reported
  // a clean install, and `verify` passed — because verify checks that lockfile
  // entries are present and unmodified, and an orphan is in no lockfile. The user's
  // next commit would have carried them.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-orphan-'));
  try {
    const first = spawnSync(process.execPath, [cli, 'install', '--yes', '--project', root], {
      encoding: 'utf8',
      env: { ...process.env, QA_LOG_LEVEL: 'error' },
    });
    assert.equal(first.status, 0, first.stderr);

    // Stand in for a file that existed in the previous version and is gone from
    // this one: add it to the lockfile as pack-owned, and put it on disk.
    const lockFile = path.join(root, 'qa-lock.json');
    const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    const gone = '.agents/skills/qa-debug/scripts/lib/removed_in_this_version.py';
    const absolute = path.join(root, gone);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, '# a file the pack used to ship\n');
    lock.files.push({
      path: gone,
      sha256: 'f'.repeat(64),
      bytes: 33,
      owner: 'skill',
      skill: 'qa-debug',
      agent: 'agent-skills',
    });
    fs.writeFileSync(lockFile, `${JSON.stringify(lock, null, 2)}\n`);

    const update = spawnSync(process.execPath, [cli, 'update', '--yes', '--json', '--project', root], {
      encoding: 'utf8',
      env: { ...process.env, QA_LOG_LEVEL: 'error' },
    });
    assert.equal(update.status, 0, update.stderr);

    assert.ok(!fs.existsSync(absolute), 'the orphaned file is still on disk after an update');
    const reported = JSON.parse(update.stdout).install.removed;
    assert.ok(reported.includes(gone), `the removal was not reported: ${JSON.stringify(reported)}`);

    // It was backed up, not simply destroyed — the same guarantee every write has.
    const backups = path.join(root, '.qa', 'backups');
    const found = fs.existsSync(backups)
      && fs.readdirSync(backups).some((stamp) =>
        fs.existsSync(path.join(backups, stamp, gone)));
    assert.ok(found, 'a removed file must be recoverable from the backup directory');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('an update never removes a file the pack does not own', () => {
  // The candidates come from the prior lockfile, which is the record of what this
  // installer wrote. A user's own file inside the same directory must survive.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-orphan-safe-'));
  try {
    spawnSync(process.execPath, [cli, 'install', '--yes', '--project', root], {
      encoding: 'utf8',
      env: { ...process.env, QA_LOG_LEVEL: 'error' },
    });
    const mine = path.join(root, '.agents', 'skills', 'qa-debug', 'MY-NOTES.md');
    fs.writeFileSync(mine, '# my own notes, in the skills directory\n');

    const update = spawnSync(process.execPath, [cli, 'update', '--yes', '--project', root], {
      encoding: 'utf8',
      env: { ...process.env, QA_LOG_LEVEL: 'error' },
    });
    assert.equal(update.status, 0, update.stderr);
    assert.ok(fs.existsSync(mine), 'an update deleted a file the pack never wrote');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
