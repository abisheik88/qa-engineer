// `qa install` — copy skills into agent discovery paths, optional wrappers,
// lockfile with per-file hashes. Never executes skill code at install time.

import fs from 'node:fs';
import path from 'node:path';
import { BACKUP_DIR, LOCKFILE, EXIT } from '../constants.mjs';
import { resolveSourceRoot } from '../core/paths.mjs';
import { detectConflicts } from '../core/conflict.mjs';
import { Transaction, readLinkTarget, canLink } from '../core/fs-safe.mjs';
import { buildLock, readLock, serializeLock, scopeLockPath } from '../core/lockfile.mjs';
import { resolveScope } from '../core/scope.mjs';
import { buildPlan, dedupePlan } from '../core/plan.mjs';
import { resolveScopeTargets, describeUnservedAgents } from '../agents/targets.mjs';
import { loadConfig } from '../core/config.mjs';
import { conflictError, verifyError } from '../core/errors.mjs';
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
 * Name the hosts a global install could not serve, and what to do about them.
 *
 * Staying quiet here would leave a Cursor user waiting for slash commands that are never
 * going to appear, with an install that reported success.
 */
function reportUnserved(unserved, logger) {
  if (!unserved || unserved.length === 0) return;
  logger.info(`  → not installed for ${unserved.map((entry) => entry.id).join(', ')}:`);
  for (const entry of unserved) logger.info(`      ${entry.id} — ${entry.reason}`);
  logger.info('  → run `qa install --project .` inside a repository to serve those hosts');
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
  scope: providedScope = null,
  agentIds = [],
  allAgents = false,
  force = false,
  dryRun = false,
  skipValidate = false,
  json = false,
  onProgress,
  log,
} = {}) {
  const logger = log ?? createLogger();
  const sourceRoot = resolveSourceRoot();
  // A caller that names a scope gets it; everything else is a project install at the
  // path it asked for, which is what every pre-0.11 caller means.
  const scope = providedScope ?? resolveScope({ project: projectRoot ?? process.cwd() });
  const root = scope.root;
  const { config } = loadConfig(root);
  const explicit = agentIds.length > 0 ? agentIds : config.agents ?? [];
  const agents = resolveScopeTargets(scope, { explicitIds: explicit, allAgents });
  const unserved = describeUnservedAgents(scope, agents);

  if (agents.length === 0) {
    throw conflictError(
      `no agent can be served by a ${scope.kind} install here`,
      scope.kind === 'global'
        ? 'no supported host has a user-level skills directory on this machine; ' +
          'install per project with: qa install --project .'
        : 'pass --agent <id> to name one explicitly',
    );
  }

  // Probe once, before planning. A filesystem that cannot hold a directory link — FAT,
  // some network and container mounts, Windows without junction support — gets copies
  // instead of a failed install.
  const linksSupported = scope.shareEngine ? canLink(scope.root) : false;
  const { skills, files, links } = buildPlan({
    sourceRoot,
    scope,
    targets: agents,
    preferLinks: linksSupported,
  });

  if (!json) {
    logger.step(`source: ${sourceRoot}`);
    logger.step(`scope: ${scope.label}`);
    logger.step(`agents: ${agents.map((a) => a.id).join(', ')}`);
    logger.step(`skills: ${skills.length}`);
    if (scope.shareEngine) {
      logger.step(`shared engine: ${path.join(scope.qaRoot, 'engine')}`);
      if (!linksSupported) {
        logger.warn('this filesystem does not support directory links — copying skills instead');
        logger.info('  → the install works the same; it uses more disk and each agent gets its own copy');
      }
    }
  }

  const { unique: uniqueFiles, conflicts: contentConflicts } = dedupePlan(files);
  if (contentConflicts.length > 0) {
    throw conflictError(`conflicting content for ${contentConflicts[0]}`);
  }
  const { unique: uniqueLinks } = dedupePlan(links);
  const unique = [...uniqueFiles, ...uniqueLinks];

  const priorLock = readLock(root, scope.lockfile);
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
  // A scope that owns a directory keeps its backups inside it. Otherwise a global
  // install writes them to `~/.qa/backups`, which is loose in the user's home — the
  // exact thing owning a directory was meant to stop.
  const backupRoot = scope.qaRootRelative ? path.join(scope.qaRootRelative, 'backups') : BACKUP_DIR;
  const backupDir = path.join(root, backupRoot, stamp);
  const tx = new Transaction(root, backupDir, { dryRun });
  for (const entry of unique) {
    if (entry.owner === 'link') tx.link(entry.path, entry.linkTarget);
    else tx.write(entry.path, entry.content);
  }

  // Files the previous install owned that this one does not: remove them.
  //
  // Without this, anything that leaves the pack between versions stays on disk
  // forever, and `verify` cannot see it — verify checks that lockfile entries are
  // present and unmodified, and an orphan is in no lockfile. Upgrading 0.9.1 to
  // 0.9.3, which replaced the Python engine with a Node one, left 154 dead Python
  // files in the user's repository, reported as a clean install and ready to be
  // committed.
  //
  // Only files the pack itself wrote are touched: the candidates come from the
  // prior lockfile, which is the record of what this installer created. Each goes
  // through the same Transaction as a write, so it is backed up first and restored
  // if any later step fails.
  const orphans = [];
  if (priorLock && !dryRun) {
    const stillOwned = new Set(unique.map((entry) => entry.path));
    for (const previous of priorLock.files ?? []) {
      if (previous.path === scope.lockfile || stillOwned.has(previous.path)) continue;
      const absolute = path.join(root, previous.path);
      // A stale link still counts as present even when its target is gone, so lstat
      // rather than exists — otherwise a broken link survives every upgrade.
      if (!fs.existsSync(absolute) && readLinkTarget(absolute) === null) continue;
      orphans.push(previous.path);
      tx.delete(previous.path);
    }
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
    // Shared entries — the engine, and the canonical skill tree — belong to no single
    // agent, so the optional keys are omitted rather than set to undefined. The schema
    // types them as strings, and a present-but-undefined key fails that as loudly as a
    // wrong one.
    files: unique.map(({ path: p, sha256, bytes, owner, skill, agent, linkTarget }) => ({
      path: p,
      sha256,
      bytes,
      owner,
      ...(skill ? { skill } : {}),
      ...(agent ? { agent } : {}),
      ...(linkTarget ? { linkTarget } : {}),
    })),
    now: new Date().toISOString(),
    scope,
  });
  if (!dryRun) {
    tx.write(scope.lockfile, Buffer.from(serializeLock(lock), 'utf8'));
  }

  const summary = tx.commit();

  reportProgress(INSTALL_STEPS[3].label, 4);
  reportProgress(INSTALL_STEPS[4].label, 5);

  let validation = null;
  if (!dryRun && !skipValidate) {
    validation = validateInstall(root, { scope });
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
    const linked = unique.filter((entry) => entry.owner === 'link').length;
    logger.ok(
      `installed ${unique.length - linked} file(s)` +
        (linked > 0 ? ` and ${linked} link(s)` : '') +
        `; lockfile ${scopeLockPath(scope)}`,
    );
    if (orphans.length > 0) {
      logger.ok(`removed ${orphans.length} file(s) the previous version owned and this one does not`);
    }
    for (const step of INSTALL_STEPS) logger.ok(step.label);
    reportInvocation(agents, logger);
    // A global install has no project to inspect, and reporting "no framework detected"
    // about the user's home directory would be noise pretending to be a diagnosis.
    if (scope.kind !== 'global') reportFrameworkFit(root, logger);
    reportUnserved(unserved, logger);
  }

  return {
    ok: true,
    dryRun,
    scope: scope.kind,
    root,
    // Kept under its original name so every existing caller and test keeps working.
    projectRoot: root,
    qaRoot: scope.qaRoot,
    agents: agents.map((a) => a.id),
    unservedAgents: unserved,
    skills: skills.length,
    files: unique.filter((entry) => entry.owner !== 'link').length,
    links: unique.filter((entry) => entry.owner === 'link').length,
    lockfile: dryRun ? null : scope.lockfile,
    removed: orphans,
    validation,
  };
}

export async function runInstall(argv, { log } = {}) {
  const opts = parseCommonFlags(argv);
  const logger = log ?? createLogger();
  if (opts.help) {
    logger.result(`Usage: qa install [scope] [--agent <id>]... [--all-agents]
                  [--force] [--dry-run] [--yes] [--json]

Scope — choose one; --project is the default:

  --global, -g          Install once for this machine, in ~/.qa-engineer.
                        One engine, one copy of the skills, linked into the
                        user-level skills directory of every host that has one.
                        Every project then works with no per-project install.
                        Override the location with QA_ENGINEER_HOME.

  --workspace, -w       Install once at the root of the monorepo containing the
                        current directory, shared by every package in it.
                        Detects pnpm, npm/yarn workspaces, Nx, Turborepo, Lerna,
                        Rush, Go, and Cargo.

  --project [dir], -C   Install into one project (default: this directory).
                        Self-contained: the engine travels inside each skill, so
                        the repository works on a machine with nothing installed.

Other:
  --all-agents          Install for every host that has a user-level directory,
                        not just the ones detected here.
  --agent <id>          Target a specific host; repeatable.
  --force               Overwrite files a previous install does not own.
  --dry-run             Report what would change and write nothing.`);
    return EXIT.OK;
  }

  const scope = resolveScope({
    global: opts.global,
    workspace: opts.workspace,
    project: opts.project,
  });

  const result = await executeInstall({
    scope,
    agentIds: opts.agents,
    allAgents: opts.allAgents,
    force: opts.force,
    dryRun: opts.dryRun,
    json: opts.json,
    log: logger,
  });

  logger.result(result);
  return EXIT.OK;
}
