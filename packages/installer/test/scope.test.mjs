// Installation scopes: global, workspace, project.
//
// Every test here redirects `QA_ENGINEER_USER_HOME` at a temporary directory, so a
// global install can be proven end to end without touching a real home. That
// indirection is the reason the mode is testable at all — the previous "global install"
// was `--project ~`, which no suite could exercise without writing into the developer's
// own home directory, and so nothing did.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveScope, findWorkspaceRoot, resolveOperatingScope, scopeOfLock } from '../lib/core/scope.mjs';
import { qaHome, describeHome, HOME_LAYOUT } from '../lib/core/qa-home.mjs';
import { executeInstall } from '../lib/commands/install.mjs';
import { runUninstall } from '../lib/commands/uninstall.mjs';
import { readLock } from '../lib/core/lockfile.mjs';
import { entryDigest } from '../lib/core/integrity.mjs';
import { readLinkTarget, canLink } from '../lib/core/fs-safe.mjs';
import { userSkillsDir, globalCapableAgents, projectOnlyAgents } from '../lib/agents/user-level.mjs';
import { createLogger } from '../lib/core/logger.mjs';

const quiet = createLogger({ level: 'error' });

function sandbox() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'qa-scope-'));
}

/** A scope whose home and agent directories both live inside a temporary tree. */
function globalScopeIn(home) {
  return resolveScope({ global: true, env: { QA_ENGINEER_USER_HOME: home } });
}

/* ── Home layout ──────────────────────────────────────────────────────────── */

test('the machine home is a single owned directory, never the home directory itself', () => {
  const home = sandbox();
  const root = qaHome({ env: { QA_ENGINEER_USER_HOME: home } });
  assert.equal(root, path.join(home, '.qa-engineer'));
  fs.rmSync(home, { recursive: true, force: true });
});

test('QA_ENGINEER_HOME relocates the owned directory wholesale', () => {
  const elsewhere = sandbox();
  const root = qaHome({ env: { QA_ENGINEER_HOME: elsewhere } });
  assert.equal(root, path.resolve(elsewhere));
  fs.rmSync(elsewhere, { recursive: true, force: true });
});

test('a filesystem root is refused as a home', () => {
  assert.throws(() => qaHome({ env: { QA_ENGINEER_HOME: path.parse(process.cwd()).root } }), /must not be a filesystem root/);
});

test('optional directories are reported as not-yet-created rather than missing', () => {
  const home = sandbox();
  const described = describeHome({ env: { QA_ENGINEER_USER_HOME: home } });
  const sessions = described.directories.find((entry) => entry.kind === 'sessions');
  assert.equal(sessions.expected, false);
  assert.equal(sessions.state, 'not yet created');
  // Only what an install actually writes is expected to exist.
  const expected = described.directories.filter((entry) => entry.expected).map((entry) => entry.kind);
  assert.deepEqual(expected.sort(), ['engine', 'skills']);
  assert.equal(Object.keys(HOME_LAYOUT).length > expected.length, true);
  fs.rmSync(home, { recursive: true, force: true });
});

/* ── Scope resolution ─────────────────────────────────────────────────────── */

test('two scopes at once is a usage error, not a silent preference', () => {
  assert.throws(() => resolveScope({ global: true, workspace: true }), /choose one installation scope/);
  assert.throws(() => resolveScope({ global: true, project: '/tmp' }), /choose one installation scope/);
});

test('a global scope keeps its lockfile inside the directory it owns', () => {
  const home = sandbox();
  const scope = globalScopeIn(home);
  assert.equal(scope.kind, 'global');
  assert.equal(scope.qaRoot, path.join(home, '.qa-engineer'));
  assert.equal(scope.lockfile, '.qa-engineer/qa-lock.json');
  // The transaction root contains both the owned directory and the agent directories.
  assert.equal(scope.root, home);
  assert.equal(scope.shareEngine, true);
  fs.rmSync(home, { recursive: true, force: true });
});

test('a project scope is unchanged: lockfile at the root, engine bundled', () => {
  const dir = sandbox();
  const scope = resolveScope({ project: dir });
  assert.equal(scope.kind, 'project');
  assert.equal(scope.root, path.resolve(dir));
  assert.equal(scope.lockfile, 'qa-lock.json');
  assert.equal(scope.shareEngine, false);
  assert.equal(scope.qaRoot, null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the workspace root is the highest marker, not the nearest', () => {
  const root = sandbox();
  fs.mkdirSync(path.join(root, 'packages', 'web', 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'mono', workspaces: ['packages/*'] }));
  // The inner package has its own manifest, and must not win.
  fs.writeFileSync(path.join(root, 'packages', 'web', 'package.json'), JSON.stringify({ name: 'web' }));

  const found = findWorkspaceRoot(path.join(root, 'packages', 'web', 'src'));
  assert.equal(found.root, fs.realpathSync(root));
  assert.equal(found.kind, 'npm');
  fs.rmSync(root, { recursive: true, force: true });
});

test('every documented monorepo marker is detected', () => {
  for (const [file, contents] of [
    ['pnpm-workspace.yaml', 'packages:\n  - "packages/*"\n'],
    ['nx.json', '{}'],
    ['turbo.json', '{}'],
    ['lerna.json', '{}'],
    ['rush.json', '{}'],
    ['go.work', 'go 1.22\n'],
    ['Cargo.toml', '[workspace]\nmembers = ["a"]\n'],
  ]) {
    const root = sandbox();
    fs.writeFileSync(path.join(root, file), contents);
    const found = findWorkspaceRoot(root);
    assert.ok(found, `${file} was not detected as a workspace marker`);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a Cargo.toml without a [workspace] section is not a monorepo root', () => {
  const root = sandbox();
  fs.writeFileSync(path.join(root, 'Cargo.toml'), '[package]\nname = "solo"\n');
  assert.equal(findWorkspaceRoot(root), null);
  fs.rmSync(root, { recursive: true, force: true });
});

test('--workspace outside a monorepo fails with a message naming what it looked for', () => {
  const dir = sandbox();
  assert.throws(
    () => resolveScope({ workspace: true, cwd: dir }),
    /no monorepo root found.*pnpm-workspace\.yaml/s,
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

/* ── The global install ───────────────────────────────────────────────────── */

test('a global install shares one engine and links the skills into each agent', async () => {
  const home = sandbox();
  const scope = globalScopeIn(home);
  const result = await executeInstall({ scope, json: true, log: quiet });

  // One engine. The whole point: the previous arrangement produced eighteen.
  const engines = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.name === 'qa-engine.mjs') engines.push(absolute);
    }
  };
  walk(home);
  assert.equal(engines.length, 1, `expected one engine, found ${engines.length}`);
  assert.equal(engines[0], path.join(home, '.qa-engineer', 'engine', 'bin', 'qa-engine.mjs'));

  // Skills reach the agent by link, into the agent's own user-level directory.
  const claudeSkills = path.join(home, userSkillsDir('claude-code'));
  assert.ok(fs.existsSync(claudeSkills), 'claude-code user-level directory was not created');
  const target = readLinkTarget(path.join(claudeSkills, 'qa-explore'));
  assert.ok(target, 'qa-explore is not a link');
  assert.equal(path.resolve(target), path.join(home, '.qa-engineer', 'skills', 'qa-explore'));

  assert.equal(result.links > 0, true);
  fs.rmSync(home, { recursive: true, force: true });
});

test('a global install leaves nothing loose in the home directory', async () => {
  const home = sandbox();
  await executeInstall({ scope: globalScopeIn(home), json: true, log: quiet });

  const entries = fs.readdirSync(home);
  // Everything is either ours, in one directory, or an agent's own dot-directory.
  for (const entry of entries) {
    assert.ok(entry.startsWith('.'), `${entry} is loose in the home directory`);
  }
  assert.ok(entries.includes('.qa-engineer'));
  assert.ok(!entries.includes('qa-lock.json'), 'the lockfile must not sit in the home directory');
  fs.rmSync(home, { recursive: true, force: true });
});

test('the lockfile records the scope, and links record where they point', async () => {
  const home = sandbox();
  const scope = globalScopeIn(home);
  await executeInstall({ scope, json: true, log: quiet });

  const lock = readLock(home, scope.lockfile);
  assert.equal(lock.scope.kind, 'global');
  assert.equal(lock.scope.sharedEngine, true);
  assert.equal(scopeOfLock(lock), 'global');

  const link = lock.files.find((entry) => entry.owner === 'link');
  assert.ok(link, 'no link recorded');
  assert.ok(link.linkTarget, 'a link entry has no target');
  assert.equal(entryDigest(home, link), link.sha256, 'the recorded link digest does not match disk');

  const engine = lock.files.find((entry) => entry.owner === 'engine');
  assert.ok(engine, 'the shared engine is not recorded in the lockfile');
  fs.rmSync(home, { recursive: true, force: true });
});

test('verify catches a link that has been repointed', async () => {
  const home = sandbox();
  const scope = globalScopeIn(home);
  await executeInstall({ scope, json: true, log: quiet });

  const lock = readLock(home, scope.lockfile);
  const link = lock.files.find((entry) => entry.owner === 'link');
  const absolute = path.join(home, link.path);

  const decoy = path.join(home, 'decoy');
  fs.mkdirSync(decoy, { recursive: true });
  fs.unlinkSync(absolute);
  fs.symlinkSync(decoy, absolute, 'dir');

  assert.notEqual(entryDigest(home, link), link.sha256, 'a repointed link was reported as intact');
  fs.rmSync(home, { recursive: true, force: true });
});

test('reinstalling identical content rewrites nothing and backs nothing up', async () => {
  const home = sandbox();
  const scope = globalScopeIn(home);
  await executeInstall({ scope, json: true, log: quiet });
  const firstCount = countFiles(home);

  await executeInstall({ scope, force: true, json: true, log: quiet });
  const secondCount = countFiles(home);

  // Only the lockfile changes between runs — its generatedAt moves — so exactly one
  // backup may appear. Anything more means the whole install was copied again.
  assert.ok(
    secondCount - firstCount <= 2,
    `reinstall added ${secondCount - firstCount} files; identical content should not be backed up`,
  );
  fs.rmSync(home, { recursive: true, force: true });
});

test('backups for an owned scope stay inside the owned directory', async () => {
  const home = sandbox();
  const scope = globalScopeIn(home);
  await executeInstall({ scope, json: true, log: quiet });
  await executeInstall({ scope, force: true, json: true, log: quiet });

  assert.ok(!fs.existsSync(path.join(home, '.qa')), 'backups leaked into ~/.qa');
  fs.rmSync(home, { recursive: true, force: true });
});

/* ── The workspace install ────────────────────────────────────────────────── */

test('a workspace install puts one engine at the monorepo root', async () => {
  const root = sandbox();
  fs.mkdirSync(path.join(root, 'packages', 'api'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'mono', workspaces: ['packages/*'] }));
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });

  const scope = resolveScope({ workspace: true, cwd: path.join(root, 'packages', 'api') });
  assert.equal(scope.root, fs.realpathSync(root));

  await executeInstall({ scope, json: true, log: quiet });
  assert.ok(fs.existsSync(path.join(scope.root, '.qa-engineer', 'engine', 'bin', 'qa-engine.mjs')));
  assert.ok(fs.existsSync(path.join(scope.root, 'qa-lock.json')));
  fs.rmSync(root, { recursive: true, force: true });
});

/* ── Backward compatibility ───────────────────────────────────────────────── */

test('a lockfile with no scope field is read as a project install', () => {
  // Every lockfile written before 0.11 looks like this. Treating the absence as
  // corruption would break every install already on disk.
  assert.equal(scopeOfLock({ lockfileVersion: 1, files: [] }), 'project');
  assert.equal(scopeOfLock(null), 'project');
});

test('a project install still bundles the engine into each skill', async () => {
  const project = sandbox();
  fs.mkdirSync(path.join(project, '.claude'), { recursive: true });
  const scope = resolveScope({ project });
  await executeInstall({ scope, json: true, log: quiet });

  // The engine travels inside the skill, so the repository works on a machine where
  // nothing else is installed. This is the property that must not regress.
  assert.ok(
    fs.existsSync(path.join(project, '.claude', 'skills', 'qa-explore', 'scripts', 'lib', 'bin', 'qa-engine.mjs')),
  );
  assert.ok(fs.existsSync(path.join(project, 'qa-lock.json')));
  const lock = readLock(project);
  assert.equal(lock.scope, undefined, 'a project lockfile should carry no scope block');
  fs.rmSync(project, { recursive: true, force: true });
});

test('the operating scope prefers a project install over the machine one', () => {
  const home = sandbox();
  const project = sandbox();
  fs.writeFileSync(path.join(project, 'qa-lock.json'), '{}');
  const scope = resolveOperatingScope({ cwd: project, env: { QA_ENGINEER_USER_HOME: home } });
  assert.equal(scope.kind, 'project');
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(project, { recursive: true, force: true });
});

test('with no project install, commands fall through to the machine one', async () => {
  const home = sandbox();
  const elsewhere = sandbox();
  await executeInstall({ scope: globalScopeIn(home), json: true, log: quiet });

  const scope = resolveOperatingScope({ cwd: elsewhere, env: { QA_ENGINEER_USER_HOME: home } });
  assert.equal(scope.kind, 'global');
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(elsewhere, { recursive: true, force: true });
});

/* ── Uninstall ────────────────────────────────────────────────────────────── */

test('uninstalling a global install removes the engine, the skills, and every link', async () => {
  const home = sandbox();
  const scope = globalScopeIn(home);
  await executeInstall({ scope, json: true, log: quiet });

  const lock = readLock(home, scope.lockfile);
  assert.ok(lock.files.some((entry) => entry.owner === 'link'), 'nothing was linked to begin with');

  await runUninstall(['--yes', '--global'], { log: quiet, env: { QA_ENGINEER_USER_HOME: home } });

  assert.ok(!fs.existsSync(path.join(home, '.qa-engineer', 'engine')), 'the engine survived');
  assert.ok(!fs.existsSync(path.join(home, '.qa-engineer', 'skills')), 'the skill tree survived');
  assert.ok(!fs.existsSync(path.join(home, scope.lockfile)), 'the lockfile survived');
  assert.equal(countLinks(home), 0, 'links survived');
  fs.rmSync(home, { recursive: true, force: true });
});

test('deleting a link never tries to copy it as a file', async () => {
  // Uninstall crashed with EISDIR here: backing up a link followed it and copied the
  // directory behind it. A link is backed up by remembering its target, not its bytes.
  const home = sandbox();
  const scope = globalScopeIn(home);
  await executeInstall({ scope, json: true, log: quiet });

  await assert.doesNotReject(() =>
    runUninstall(['--yes', '--global'], { log: quiet, env: { QA_ENGINEER_USER_HOME: home } }),
  );
  fs.rmSync(home, { recursive: true, force: true });
});

/* ── Agent adapters ───────────────────────────────────────────────────────── */

test('only agents with a documented user-level directory are served globally', () => {
  const capable = globalCapableAgents();
  assert.ok(capable.includes('claude-code'));
  // Every other agent must carry a reason rather than a guessed path — writing skills
  // where a host does not read them is a silent no-op that reads as a broken tool.
  for (const entry of projectOnlyAgents()) {
    assert.ok(entry.reason && entry.reason.length > 10, `${entry.id} has no reason recorded`);
    assert.equal(userSkillsDir(entry.id), null);
  }
  assert.equal(capable.length + projectOnlyAgents().length > 5, true);
});

test('a global install reports the hosts it could not serve', async () => {
  const home = sandbox();
  const result = await executeInstall({ scope: globalScopeIn(home), json: true, log: quiet });
  assert.ok(result.unservedAgents.length > 0, 'nothing reported as unserved');
  for (const entry of result.unservedAgents) assert.ok(entry.reason);
  fs.rmSync(home, { recursive: true, force: true });
});

/* ── Linking capability ───────────────────────────────────────────────────── */

test('link capability is probed rather than assumed', () => {
  const dir = sandbox();
  // On every filesystem the suite realistically runs on this is true; the value of the
  // probe is that a false answer produces copies instead of a failed install.
  assert.equal(typeof canLink(dir), 'boolean');
  // The probe cleans up after itself.
  assert.deepEqual(fs.readdirSync(dir), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

function countLinks(dir) {
  let count = 0;
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) { count += 1; continue; }
      if (entry.isDirectory()) walk(path.join(current, entry.name));
    }
  };
  walk(dir);
  return count;
}

function countFiles(dir) {
  let count = 0;
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else count += 1;
    }
  };
  walk(dir);
  return count;
}
