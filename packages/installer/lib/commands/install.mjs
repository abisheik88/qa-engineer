// `qa install` — copy skills into agent discovery paths, optional wrappers,
// lockfile with per-file hashes. Never executes skill code at install time.

import fs from 'node:fs';
import path from 'node:path';
import { BACKUP_DIR, LOCKFILE, EXIT } from '../constants.mjs';
import { resolveSourceRoot, resolveProjectRoot, toPosix } from '../core/paths.mjs';
import { listSkills, skillFiles } from '../core/manifest.mjs';
import { bundleFilesForSkill } from '../core/bundle.mjs';
import { hashBytes } from '../core/hash.mjs';
import { detectConflicts } from '../core/conflict.mjs';
import { Transaction } from '../core/fs-safe.mjs';
import { buildLock, readLock, serializeLock, lockPath } from '../core/lockfile.mjs';
import { loadConfig } from '../core/config.mjs';
import { readSkillMeta } from '../core/skill-meta.mjs';
import { renderWrapper } from '../core/wrappers.mjs';
import { conflictError, verifyError } from '../core/errors.mjs';
import { resolveInstallTargets } from '../agents/registry.mjs';
import { createLogger } from '../core/logger.mjs';
import { parseCommonFlags } from '../cli/flags.mjs';
import { validateInstall } from '../core/validate-install.mjs';
import { INSTALL_STEPS, progressBar } from '../ui/progress.mjs';
import { detectFrameworks } from '../detect/frameworks.mjs';
import { getFramework } from '../../../../shared/frameworks/registry.mjs';

/**
 * Say how to reach a skill in the host that was actually detected.
 *
 * The invocation surface differs per host — Codex takes `$qa-explore`, Cursor
 * matches on `/`, OpenCode's agent loads skills itself — and a user who types the
 * wrong one concludes the install failed. The registry records each host's own
 * convention beside the paths it reads, so this prints what will work here rather
 * than a generic "/qa-explore" that is wrong in two of the five hosts.
 */
function reportInvocation(agents, logger) {
  const named = agents.filter((a) => a.invoke && a.id !== 'agent-skills');
  if (named.length === 0) {
    const fallback = agents.find((a) => a.invoke);
    if (fallback) {
      logger.info(`  → no specific agent detected; ${fallback.invoke}`);
      logger.info('  → the skills are on the standard Agent Skills path, which every');
      logger.info('    supported host reads: Cursor, Codex, OpenCode, Antigravity, Gemini, Copilot');
    }
    return;
  }
  for (const agent of named) {
    logger.info(`  → in ${agent.name}: ${agent.invoke}`);
  }
}

/**
 * Say plainly which commands this project can actually use.
 *
 * A project with no supported end-to-end framework still gets all thirteen
 * skills, and `/qa-run` will then stop and recommend `/qa-init` — which the user
 * has already run. That loop reads as a broken install. Unit-test-only projects
 * (Jest, Vitest, pytest) are common, so the honest thing is to say up front which
 * commands work here and which do not, rather than let the user discover it by
 * hitting a dead end.
 */
function reportFrameworkFit(root, logger) {
  let detected = [];
  try {
    // detectFrameworks returns ids; the registry is the source of truth for
    // whether an id can actually execute live.
    detected = (detectFrameworks(root).frameworks ?? []).map(
      (id) => getFramework(id) ?? { id, name: id, liveExecution: false },
    );
  } catch {
    return; // detection is best-effort; never fail an install over it
  }

  if (detected.length > 0) {
    const live = detected.filter((f) => f.liveExecution).map((f) => f.name ?? f.id);
    const gated = detected.filter((f) => !f.liveExecution).map((f) => f.name ?? f.id);
    if (live.length > 0) {
      logger.step(`detected ${live.join(', ')} — /qa-run and /qa-generate work here`);
    }
    if (gated.length > 0) {
      logger.step(
        `detected ${gated.join(', ')} — results are understood, but running and ` +
          'generating tests live is Playwright-only today',
      );
    }
    return;
  }

  logger.warn('no end-to-end framework detected (Playwright, Selenium, Cypress, WebdriverIO)');
  logger.info('  → start with /qa-generate — it bootstraps a framework when none exists');
  logger.info('  → /qa-run needs one first; it will say so rather than guess');
  logger.info('  → these work today: /qa-review, /qa-api, /qa-audit, /qa-explore, /qa-report');
  logger.info('  → unit tests only (Jest, Vitest, Jasmine, pytest)? That is expected');
}

/**
 * Core install implementation shared by install / onboard / repair / update.
 *
 * @param {{
 *   projectRoot: string,
 *   agentIds?: string[],
 *   force?: boolean,
 *   dryRun?: boolean,
 *   skipValidate?: boolean,
 *   json?: boolean,
 *   onProgress?: (label: string, index: number, total: number) => void,
 *   log?: ReturnType<typeof createLogger>,
 * }} options
 */
export async function executeInstall({
  projectRoot,
  agentIds = [],
  force = false,
  dryRun = false,
  skipValidate = false,
  json = false,
  onProgress,
  log,
} = {}) {
  const logger = log ?? createLogger();
  const sourceRoot = resolveSourceRoot();
  const root = resolveProjectRoot(projectRoot);
  const { config } = loadConfig(root);
  const explicit = agentIds.length > 0 ? agentIds : config.agents ?? [];
  const agents = resolveInstallTargets(root, explicit);
  const skills = listSkills(sourceRoot);

  if (!json) {
    logger.step(`source: ${sourceRoot}`);
    logger.step(`project: ${root}`);
    logger.step(`agents: ${agents.map((a) => a.id).join(', ')}`);
    logger.step(`skills: ${skills.length}`);
  }

  /** @type {Array<{path:string, sha256:string, bytes:number, owner:string, skill?:string, agent?:string, content:Buffer}>} */
  const planned = [];

  for (const agent of agents) {
    for (const skill of skills) {
      const files = skillFiles(sourceRoot, skill);
      for (const rel of files) {
        if (rel.startsWith('tests/') || rel.includes('/tests/')) continue;
        const abs = path.join(sourceRoot, 'skills', skill, rel);
        const content = fs.readFileSync(abs);
        const dest = toPosix(path.join(agent.skillsDir, skill, rel));
        planned.push({
          path: dest,
          sha256: hashBytes(content),
          bytes: content.length,
          owner: 'skill',
          skill,
          agent: agent.id,
          content,
        });
      }
      for (const bundled of bundleFilesForSkill(sourceRoot, skill)) {
        const dest = toPosix(path.join(agent.skillsDir, skill, bundled.rel));
        planned.push({
          path: dest,
          sha256: hashBytes(bundled.content),
          bytes: bundled.content.length,
          owner: 'skill',
          skill,
          agent: agent.id,
          content: bundled.content,
        });
      }
    }

    if (agent.wrapperFormat && agent.wrapperDir) {
      for (const skill of skills) {
        const meta = readSkillMeta(path.join(sourceRoot, 'skills', skill, 'SKILL.md'));
        if (!meta.name) continue;
        const { filename, content } = renderWrapper(agent.wrapperFormat, meta);
        const buf = Buffer.from(content, 'utf8');
        const dest = toPosix(path.join(agent.wrapperDir, filename));
        planned.push({
          path: dest,
          sha256: hashBytes(buf),
          bytes: buf.length,
          owner: 'wrapper',
          skill,
          agent: agent.id,
          content: buf,
        });
      }
    }
  }

  const byPath = new Map();
  for (const entry of planned) {
    const prev = byPath.get(entry.path);
    if (prev && prev.sha256 !== entry.sha256) {
      throw conflictError(`conflicting content for ${entry.path}`);
    }
    if (!prev) byPath.set(entry.path, entry);
  }
  const unique = [...byPath.values()];

  const priorLock = readLock(root);
  const conflicts = detectConflicts({
    projectRoot: root,
    planned: unique,
    priorLock,
  });
  if (conflicts.length > 0 && !force) {
    throw conflictError(
      `refusing to overwrite ${conflicts.length} file(s) not owned by a previous install:\n` +
        conflicts.map((c) => `  - ${c.path}`).join('\n'),
      're-run with --force to overwrite, or remove the conflicting files',
    );
  }

  const reportProgress = (label, index) => {
    if (onProgress) onProgress(label, index, INSTALL_STEPS.length);
    else if (!json) {
      logger.step(`${progressBar(index, INSTALL_STEPS.length)}  ${label}`);
    }
  };

  reportProgress(INSTALL_STEPS[0].label, 1);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(root, BACKUP_DIR, stamp);
  const tx = new Transaction(root, backupDir, { dryRun });
  for (const entry of unique) {
    tx.write(entry.path, entry.content);
  }

  reportProgress(INSTALL_STEPS[1].label, 2);
  reportProgress(INSTALL_STEPS[2].label, 3);

  const lock = buildLock({
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      tier: a.tier,
      skillsDir: a.skillsDir,
      detected: a.detected,
    })),
    files: unique.map(({ path: p, sha256, bytes, owner, skill, agent }) => ({
      path: p,
      sha256,
      bytes,
      owner,
      skill,
      agent,
    })),
    now: new Date().toISOString(),
  });
  if (!dryRun) {
    tx.write(LOCKFILE, Buffer.from(serializeLock(lock), 'utf8'));
  }

  const summary = tx.commit();

  reportProgress(INSTALL_STEPS[3].label, 4);
  reportProgress(INSTALL_STEPS[4].label, 5);

  let validation = null;
  if (!dryRun && !skipValidate) {
    validation = validateInstall(root);
    if (!validation.ok) {
      const failed = validation.checks.filter((c) => c.hard && !c.ok);
      throw verifyError(
        `installation completed but validation failed:\n` +
          failed.map((c) => `  - ${c.message}`).join('\n'),
        failed.find((c) => c.hint)?.hint ?? 'run: qa doctor',
      );
    }
  }

  reportProgress(INSTALL_STEPS[5].label, 6);

  if (dryRun) {
    if (!json) logger.ok(`dry run: would write ${summary.written} file(s)`);
  } else if (!json) {
    logger.ok(`installed ${unique.length} file(s); lockfile ${lockPath(root)}`);
    for (const step of INSTALL_STEPS) logger.ok(step.label);
    reportInvocation(agents, logger);
    reportFrameworkFit(root, logger);
  }

  return {
    ok: true,
    dryRun,
    projectRoot: root,
    agents: agents.map((a) => a.id),
    skills: skills.length,
    files: unique.length,
    lockfile: dryRun ? null : LOCKFILE,
    validation,
  };
}

export async function runInstall(argv, { log } = {}) {
  const opts = parseCommonFlags(argv);
  const logger = log ?? createLogger();
  if (opts.help) {
    logger.result(`Usage: qa install [--agent <id>]... [--force] [--dry-run] [--yes] [--json] [--project <dir>]

Copy QA Engineer Pack skills into Agent Skills discovery paths
(.agents/skills/ and .claude/skills/ when applicable), write qa-lock.json,
and generate thin slash wrappers for agents that need them.`);
    return EXIT.OK;
  }

  const result = await executeInstall({
    projectRoot: opts.project ?? process.cwd(),
    agentIds: opts.agents,
    force: opts.force,
    dryRun: opts.dryRun,
    json: opts.json,
    log: logger,
  });

  logger.result(result);
  return EXIT.OK;
}
