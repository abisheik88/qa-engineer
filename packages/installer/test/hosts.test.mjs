// Per-host compatibility tests.
//
// A skill installed to a path its host does not read is a silent failure: every
// file is present, `qa doctor` is green, and the agent never sees a single skill.
// The user concludes the product is broken, and nothing in the install output
// disagrees with them.
//
// So the registry now records, per host, every project path that host documents
// as a skill source (`discovery`) and the documentation it was read from
// (`docs`). These tests hold the installer to that record: the directory it
// writes to must be one the host actually reads, for each of the five hosts
// people asked about — Claude Code, Cursor, Codex, Antigravity, OpenCode — and
// for every other host in the registry.
//
// What these tests cannot do is verify the documentation is current. They pin
// the installer to a claim; COMPATIBILITY.md carries the date that claim was
// read, and re-reading it is a release step, not something a test can automate.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENTS, getAgent, resolveInstallTargets } from '../lib/agents/registry.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, '..', 'bin', 'qa.mjs');

// The five hosts this pack is expected to work in, each with the marker a real
// project of that kind has. The marker is never a path the installer creates —
// detection keyed on the installer's own output is how a previous release
// "detected" a host that was never there.
const HOSTS = [
  { id: 'claude-code', marker: '.claude', kind: 'dir' },
  { id: 'cursor', marker: '.cursor', kind: 'dir' },
  { id: 'codex', marker: 'AGENTS.md', kind: 'file' },
  { id: 'opencode', marker: '.opencode', kind: 'dir' },
  { id: 'antigravity', marker: '.antigravity', kind: 'dir' },
];

function project(marker, kind) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-host-'));
  const target = path.join(dir, marker);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (kind === 'dir') fs.mkdirSync(target, { recursive: true });
  else fs.writeFileSync(target, '# project\n');
  return dir;
}

test('every registry entry declares where its host reads skills, and cites the source', () => {
  for (const agent of AGENTS) {
    assert.ok(
      Array.isArray(agent.discovery) && agent.discovery.length > 0,
      `${agent.id}: no discovery paths declared — an install to it would be a guess`,
    );
    assert.match(agent.docs ?? '', /^https:\/\//, `${agent.id}: docs must cite a URL`);
    assert.ok(agent.invoke, `${agent.id}: no invocation hint, so the user is left to guess`);
  }
});

test('the directory the installer writes to is one the host documents reading', () => {
  for (const agent of AGENTS) {
    assert.ok(
      agent.discovery.includes(agent.skillsDir),
      `${agent.id}: installs to ${agent.skillsDir}, which is not in its documented ` +
        `discovery paths (${agent.discovery.join(', ')}) — see ${agent.docs}`,
    );
  }
});

test('a wrapper directory is only ever declared alongside a format that renders one', () => {
  for (const agent of AGENTS) {
    assert.equal(
      Boolean(agent.wrapperDir),
      Boolean(agent.wrapperFormat),
      `${agent.id}: wrapperDir and wrapperFormat must be declared together`,
    );
  }
});

for (const host of HOSTS) {
  test(`${host.id}: skills land where that host looks for them`, () => {
    const root = project(host.marker, host.kind);
    execFileSync(process.execPath, [cli, 'install', '--yes', '--project', root], {
      encoding: 'utf8',
    });

    const agent = getAgent(host.id);
    const readable = agent.discovery.some((dir) =>
      fs.existsSync(path.join(root, dir, 'qa-explore', 'SKILL.md')),
    );
    assert.ok(
      readable,
      `${host.id} reads ${agent.discovery.join(' or ')}, and qa-explore/SKILL.md is in none of them`,
    );
    fs.rmSync(root, { recursive: true, force: true });
  });
}

test('a project with no agent marker still gets the standard Agent Skills path', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-host-bare-'));
  execFileSync(process.execPath, [cli, 'install', '--yes', '--project', root], {
    encoding: 'utf8',
  });
  // Cursor, Codex, OpenCode, Antigravity, Gemini and Copilot all read this path,
  // so an undetected project is still usable in every one of them.
  assert.ok(fs.existsSync(path.join(root, '.agents', 'skills', 'qa-explore', 'SKILL.md')));
  fs.rmSync(root, { recursive: true, force: true });
});

test('a Claude Code project also gets the shared path, so a second tool works too', () => {
  // Someone running Claude Code today may open the same repository in Cursor
  // tomorrow. Installing only .claude/skills would leave that second tool blind.
  const root = project('.claude', 'dir');
  const targets = resolveInstallTargets(root, []).map((a) => a.skillsDir);
  assert.ok(targets.includes('.claude/skills'));
  assert.ok(targets.includes('.agents/skills'));
  fs.rmSync(root, { recursive: true, force: true });
});

test('OpenCode command wrappers are written to the documented plural directory', () => {
  // `.opencode/command/` (singular) is a plausible typo that would silently
  // produce no slash commands at all.
  const agent = getAgent('opencode');
  assert.equal(agent.wrapperDir, '.opencode/commands');

  const root = project('.opencode', 'dir');
  execFileSync(process.execPath, [cli, 'install', '--yes', '--project', root], {
    encoding: 'utf8',
  });
  assert.ok(fs.existsSync(path.join(root, '.opencode', 'commands', 'qa-explore.md')));
  fs.rmSync(root, { recursive: true, force: true });
});

test('the install tells the user how to invoke a skill in the host it detected', () => {
  const root = project('.cursor', 'dir');
  // Human guidance is on stderr by design — stdout carries only the result JSON,
  // so the CLI stays pipeable. Read the stream the user actually sees.
  const run = spawnSync(process.execPath, [cli, 'install', '--yes', '--project', root], {
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /in Cursor: type \/ in Agent chat and pick qa-explore/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('an undetected project is told the path works in every supported host', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-host-hint-'));
  const run = spawnSync(process.execPath, [cli, 'install', '--yes', '--project', root], {
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  // Naming a product here would claim a detection that never happened; naming the
  // hosts that read the path is true and is what the user needs to know.
  assert.match(run.stderr, /no specific agent detected/);
  assert.match(run.stderr, /Cursor, Codex, OpenCode, Antigravity/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a plain file-copy install produces a working skill, with no installer involved', () => {
  // This is what `npx skills add <owner>/<repo>` does: copy the skill directory out
  // of git and stop. Nothing is generated, nothing is bundled, our installer never
  // runs. Under the Python engine this produced 19 Markdown files and no tooling at
  // all — every documented command failed and all nine skills silently fell back to
  // guesswork. It is the reason the launcher is a committed file.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-copy-'));
  try {
    const source = path.resolve(here, '..', '..', '..');
    const skillDir = path.join(root, '.agents', 'skills', 'qa-debug');
    fs.mkdirSync(skillDir, { recursive: true });
    // Copy exactly what git tracks for this skill — no more.
    const tracked = execFileSync('git', ['ls-files', 'skills/qa-debug'], {
      cwd: source,
      encoding: 'utf8',
    }).trim().split('\n');
    for (const rel of tracked) {
      const target = path.join(skillDir, rel.replace('skills/qa-debug/', ''));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(source, rel), target);
    }

    // The launcher must be there, because it is committed rather than generated.
    const launcher = path.join(skillDir, 'scripts', 'qa-tool.mjs');
    assert.ok(fs.existsSync(launcher), 'a file-copy install has no entry point');

    // And it must resolve an engine. Here there is no bundle and no node_modules, so
    // the honest answer is npx — reported rather than guessed at.
    const where = spawnSync(process.execPath, [launcher, '--where'], { encoding: 'utf8' });
    assert.equal(where.status, 0, where.stderr);
    assert.equal(JSON.parse(where.stdout).resolved, 'npx');

    // With the pack present in node_modules, it resolves offline instead. Simulated
    // by linking this checkout in, which is what `npm install qa-engineer` produces.
    const modules = path.join(root, 'node_modules');
    fs.mkdirSync(modules, { recursive: true });
    fs.symlinkSync(source, path.join(modules, 'qa-engineer'), 'dir');
    const resolved = spawnSync(process.execPath, [launcher, '--where'], {
      encoding: 'utf8',
      cwd: root,
    });
    assert.equal(JSON.parse(resolved.stdout).resolved, 'node_modules');

    // Then the documented command has to actually work, which is the whole claim.
    const execution = path.join(root, 'execution-result.json');
    fs.writeFileSync(execution, JSON.stringify({
      tests: { total: 1, passed: 0, failed: 1, skipped: 0 },
      executed: [{ title: 'checkout', status: 'failed', message: 'no such element: #cart', file: 'a.spec.ts', retries: 0 }],
    }));
    const run = spawnSync(
      process.execPath,
      [launcher, 'diagnostics', 'report', '--execution-result', execution],
      { encoding: 'utf8', cwd: root },
    );
    assert.equal(run.status, 0, `file-copy install could not run the engine: ${run.stderr}`);
    assert.equal(JSON.parse(run.stdout).diagnosis.entries[0].rootCause.classification, 'locator-failure');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
