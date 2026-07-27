// M9.5 installer UX tests — detect, onboard --yes, self-test, repair, update.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectFrameworks } from '../lib/detect/frameworks.mjs';
import { detectProject } from '../lib/detect/project.mjs';
import { scanProject } from '../lib/detect/scan.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const installerRoot = path.resolve(here, '..');
const repoRoot = path.resolve(here, '..', '..', '..');
const cli = path.join(installerRoot, 'bin', 'qa.mjs');

function runQa(args, { cwd = repoRoot } = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      QA_PACK_SOURCE: repoRoot,
      QA_LOG_LEVEL: 'error',
      // Force non-interactive even if a local TTY is attached.
      CI: '1',
    },
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function mkProject(extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-m95-'));
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  if (extra.cursor) fs.mkdirSync(path.join(dir, '.cursor'), { recursive: true });
  if (extra.playwright) {
    fs.writeFileSync(path.join(dir, 'playwright.config.ts'), 'export default {};\n');
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: 'demo-app',
        devDependencies: { '@playwright/test': '1.40.0', typescript: '5.0.0' },
      }),
    );
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{}\n');
  }
  if (extra.graphql) {
    const pkgPath = path.join(dir, 'package.json');
    const pkg = fs.existsSync(pkgPath)
      ? JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      : { name: 'demo-app' };
    pkg.dependencies = { ...(pkg.dependencies ?? {}), graphql: '16.0.0' };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg));
  }
  return dir;
}

test('detectFrameworks finds Playwright and TypeScript markers', () => {
  const project = mkProject({ playwright: true });
  try {
    const result = detectFrameworks(project);
    assert.ok(result.frameworks.includes('playwright'));
    assert.ok(result.languages.includes('typescript'));
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('detectProject finds GraphQL dependency', () => {
  const project = mkProject({ graphql: true });
  try {
    const result = detectProject(project);
    assert.equal(result.graphql, true);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('scanProject recommends Playwright integration when detected', () => {
  const project = mkProject({ playwright: true, cursor: true });
  try {
    const scan = scanProject(project);
    assert.equal(scan.projectName, 'demo-app');
    assert.ok(scan.detectedAgents.some((a) => a.id === 'cursor' || a.id === 'claude-code'));
    const pw = scan.recommendations.find((r) => r.id === 'playwright');
    assert.ok(pw?.recommended);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('qa --yes installs and self-test passes', () => {
  const project = mkProject();
  try {
    const onboard = runQa(['--yes', '--project', project]);
    assert.equal(onboard.status, 0, onboard.stderr);
    assert.ok(fs.existsSync(path.join(project, 'qa-lock.json')));
    assert.ok(fs.existsSync(path.join(project, '.claude', 'skills', 'qa', 'SKILL.md')));

    const selfTest = runQa(['self-test', '--project', project, '--json']);
    assert.equal(selfTest.status, 0, selfTest.stderr);
    const report = JSON.parse(selfTest.stdout);
    assert.equal(report.ok, true);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('repair restores a drifted skill file', () => {
  const project = mkProject();
  try {
    assert.equal(runQa(['install', '--agent', 'claude-code', '--project', project]).status, 0);
    const skillFile = path.join(project, '.claude', 'skills', 'qa', 'SKILL.md');
    fs.appendFileSync(skillFile, '\n<!-- broken -->\n');
    assert.notEqual(runQa(['verify', '--project', project]).status, 0);

    const repair = runQa(['repair', '--project', project, '--json']);
    assert.equal(repair.status, 0, repair.stderr);
    assert.equal(runQa(['verify', '--project', project]).status, 0);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('update refreshes an existing install', () => {
  const project = mkProject();
  try {
    assert.equal(runQa(['install', '--agent', 'claude-code', '--project', project]).status, 0);
    const update = runQa(['update', '--project', project, '--json']);
    assert.equal(update.status, 0, update.stderr);
    const report = JSON.parse(update.stdout);
    assert.equal(report.ok, true);
    assert.ok(report.version);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctor --json includes checklist and frameworks', () => {
  const project = mkProject({ playwright: true });
  try {
    const { status, stdout } = runQa(['doctor', '--project', project, '--json']);
    assert.equal(status, 0);
    const report = JSON.parse(stdout);
    assert.ok(Array.isArray(report.checklist));
    assert.ok(report.frameworks.includes('playwright'));
    assert.equal(report.lockfilePresent, false);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('bare qa without TTY prints help and exits usage', () => {
  const result = spawnSync(process.execPath, [cli], {
    encoding: 'utf8',
    env: { ...process.env, QA_PACK_SOURCE: repoRoot, QA_LOG_LEVEL: 'error' },
    stdio: ['pipe', 'pipe', 'pipe'], // no TTY
  });
  assert.equal(result.status, 2);
  assert.match(result.stdout, /Usage:/);
});
