// `qa doctor` — environment and pack diagnostics with repair hints.

import fs from 'node:fs';
import path from 'node:path';
import { EXIT, SHARED_SKILLS_DIR } from '../constants.mjs';
import { resolveSourceRoot, resolveProjectRoot } from '../core/paths.mjs';
import { VERSION, SPEC_REVISION } from '../version.mjs';
import { AGENTS, resolveInstallTargets, listAgentIds } from '../agents/registry.mjs';
import { packHasBundles, findPython, verifyImports } from '../core/bundle.mjs';
import { BUNDLE_DEST, BUNDLE_MANIFEST, bundlePackagesForSkill } from '../core/manifest.mjs';
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

Diagnose environment and QA Automation Pack installation.
Each failure includes an exact repair command.`);
    return EXIT.OK;
  }

  const root = resolveProjectRoot(opts.project ?? process.cwd());
  let source = null;
  try {
    source = resolveSourceRoot();
  } catch (error) {
    if (!opts.json) logger.warn(error.message);
  }

  const detected = AGENTS.filter((a) => a.detect(root)).map((a) => a.id);
  const targets = resolveInstallTargets(root, opts.agents).map((a) => a.id);
  const lock = readLock(root);
  const python = findPython();
  const gitOk = hasGit(root);
  const scan = scanProject(root, opts.agents);
  const validation = lock ? validateInstall(root) : null;

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
    id: 'python',
    ok: Boolean(python),
    message: python ? `${python.bin} (${python.version})` : 'Python not found',
    hint: python ? undefined : 'install Python 3.8+ for analysis/diagnostics engines',
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
        section: 'QA Automation Pack',
        id: c.id,
        ok: c.ok,
        message: c.message,
        hint: c.hint,
      });
    }
  } else {
    checklist.push({
      section: 'QA Automation Pack',
      id: 'lockfile',
      ok: false,
      message: 'no qa-lock.json',
      hint: 'run: qa install',
    });
    checklist.push({
      section: 'QA Automation Pack',
      id: 'skills',
      ok: false,
      message: 'skills not installed',
      hint: 'run: qa install',
    });
  }

  // Deep Python import check when bundles are on disk
  if (lock && packHasBundles() && python) {
    const bundledSkill = Object.keys(BUNDLE_MANIFEST)[0];
    const libDir = path.join(root, SHARED_SKILLS_DIR, bundledSkill, BUNDLE_DEST);
    const claudeLib = path.join(root, '.claude', 'skills', bundledSkill, BUNDLE_DEST);
    const resolvedLib = fs.existsSync(libDir) ? libDir : fs.existsSync(claudeLib) ? claudeLib : null;
    if (resolvedLib) {
      const packages = bundlePackagesForSkill(bundledSkill);
      const result = verifyImports({ pythonBin: python.bin, libDir: resolvedLib, packages });
      checklist.push({
        section: 'QA Automation Pack',
        id: 'engine-imports',
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
    python,
    bundles: packHasBundles(),
    node: process.version,
    git: gitOk,
    frameworks: scan.frameworks,
    languages: scan.languages,
    checklist,
    ok: blocking.length === 0,
  };

  if (!opts.json) {
    logger.step(`QA Automation Pack doctor — ${VERSION}`);
    logger.step(`project ${root}`);
    let section = '';
    for (const item of checklist) {
      if (item.section !== section) {
        section = item.section;
        logger.info(`\n${section}`);
      }
      if (item.ok) logger.ok(item.message);
      else logger.error(item.message);
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
