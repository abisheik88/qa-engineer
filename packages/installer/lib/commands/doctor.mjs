// `qa doctor` — environment and pack diagnostics with repair hints.

import fs from 'node:fs';
import path from 'node:path';
import { EXIT, SHARED_SKILLS_DIR } from '../constants.mjs';
import { resolveSourceRoot } from '../core/paths.mjs';
import { resolveOperatingScope } from '../core/scope.mjs';
import { VERSION, SPEC_REVISION } from '../version.mjs';
import { AGENTS, resolveInstallTargets, listAgentIds } from '../agents/registry.mjs';
import { packHasBundles, verifyEngine } from '../core/bundle.mjs';
import { BUNDLE_DEST, BUNDLE_MANIFEST } from '../core/manifest.mjs';
import { readLock } from '../core/lockfile.mjs';
import { createLogger } from '../core/logger.mjs';
import { parseCommonFlags } from '../cli/flags.mjs';
import { validateInstall } from '../core/validate-install.mjs';
import { scanProject } from '../detect/scan.mjs';
import { spawnSync } from 'node:child_process';

function hasGit(root) {
  if (fs.existsSync(path.join(root, '.git'))) return true;
  const probe = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: root,
    encoding: 'utf8',
  });
  return probe.status === 0;
}

export async function runDoctor(argv, { log } = {}) {
  const opts = parseCommonFlags(argv);
  const logger = log ?? createLogger();
  if (opts.help) {
    logger.result(`Usage: qa doctor [--project <dir>] [--json]

Diagnose environment and QA Engineer Pack installation.
Each failure includes an exact repair command.`);
    return EXIT.OK;
  }

  const scope = resolveOperatingScope(opts);
  const root = scope.root;
  let source = null;
  try {
    source = resolveSourceRoot();
  } catch (error) {
    if (!opts.json) logger.warn(error.message);
  }

  const detected = AGENTS.filter((a) => a.detect(root)).map((a) => a.id);
  const targets = resolveInstallTargets(root, opts.agents).map((a) => a.id);
  const lock = readLock(root, scope.lockfile);
  const gitOk = hasGit(root);
  const scan = scanProject(root, opts.agents);
  const validation = lock ? validateInstall(root, { scope }) : null;

  /** @type {Array<{ section: string, id: string, ok: boolean, message: string, hint?: string }>} */
  const checklist = [];

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  checklist.push({
    section: 'Environment',
    id: 'node',
    ok: nodeMajor >= 18,
    message: `Node ${process.version}`,
    hint: nodeMajor >= 18 ? undefined : 'upgrade to Node.js 18.18+',
  });
  checklist.push({
    section: 'Environment',
    id: 'git',
    ok: gitOk,
    message: gitOk ? 'git repository detected' : 'not a git repository',
    hint: gitOk ? undefined : 'optional — git init if you want version control',
  });
  checklist.push({
    section: 'Environment',
    id: 'assistant',
    ok: detected.length > 0,
    message:
      detected.length > 0
        ? `AI assistants: ${detected.join(', ')}`
        : 'no assistant markers (will use .agents/skills)',
    hint: detected.length > 0 ? undefined : 'optional — open the project in Cursor/Claude/OpenCode',
  });

  if (validation) {
    for (const c of validation.checks) {
      checklist.push({
        section: 'QA Engineer Pack',
        id: c.id,
        ok: c.ok,
        message: c.message,
        hint: c.hint,
      });
    }
  } else {
    checklist.push({
      section: 'QA Engineer Pack',
      id: 'lockfile',
      ok: false,
      message: 'no qa-lock.json',
      hint: 'run: qa install',
    });
    checklist.push({
      section: 'QA Engineer Pack',
      id: 'skills',
      ok: false,
      message: 'skills not installed',
      hint: 'run: qa install',
    });
  }

  // Deep check: the bundled engine must RUN, not merely be present. It runs under
  // this same Node, so there is no interpreter to look for and no reason to skip.
  if (lock && packHasBundles()) {
    const bundledSkill = Object.keys(BUNDLE_MANIFEST)[0];
    const libDir = path.join(root, SHARED_SKILLS_DIR, bundledSkill, BUNDLE_DEST);
    const claudeLib = path.join(root, '.claude', 'skills', bundledSkill, BUNDLE_DEST);
    const resolvedLib = fs.existsSync(libDir) ? libDir : fs.existsSync(claudeLib) ? claudeLib : null;
    if (resolvedLib) {
      const result = verifyEngine({ libDir: resolvedLib });
      checklist.push({
        section: 'QA Engineer Pack',
        id: 'engine-runs',
        ok: result.ok,
        message: result.ok ? 'bundled engine runs cleanly' : `engine check failed: ${result.stderr}`,
        hint: result.ok ? undefined : 'run: qa repair',
      });
    }
  }

  const blocking = checklist.filter(
    (c) =>
      !c.ok &&
      ['node', 'lockfile', 'skills', 'integrity', 'engine'].includes(c.id),
  );

  const report = {
    packVersion: VERSION,
    specRevision: SPEC_REVISION,
    projectRoot: root,
    sourceRoot: source,
    knownAgents: listAgentIds(),
    detectedAgents: detected,
    installTargets: targets,
    lockfilePresent: Boolean(lock),
    lockfilePack: lock?.pack ?? null,
    bundles: packHasBundles(),
    node: process.version,
    git: gitOk,
    frameworks: scan.frameworks,
    languages: scan.languages,
    checklist,
    ok: blocking.length === 0,
  };

  if (!opts.json) {
    logger.step(`QA Engineer Pack doctor — ${VERSION}`);
    logger.step(`project ${root}`);
    let section = '';
    for (const item of checklist) {
      if (item.section !== section) {
        section = item.section;
        logger.info(`\n${section}`);
      }
      // A failed check that is not blocking is a warning, not an error. Rendering
      // "no git repository" and "no assistant markers" in red — directly above a
      // hint calling them optional — is the first thing a new user sees, and it
      // reads as a broken install when nothing is broken.
      const isBlocking = blocking.some((b) => b.id === item.id);
      if (item.ok) logger.ok(item.message);
      else if (isBlocking) logger.error(item.message);
      else logger.warn(item.message);
      if (!item.ok && item.hint) logger.info(`  → ${item.hint}`);
    }
    logger.info('');
    if (blocking.length === 0) logger.ok('doctor: no blocking issues');
    else logger.error('doctor: blocking issues found — see hints above');
  }

  // Doctor always exits 0 when it successfully produced a report; `ok` in the
  // payload (and self-test / verify) are the gates for automation.
  logger.result(report);
  return EXIT.OK;
}
