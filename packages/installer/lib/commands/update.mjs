// `qa update` — refresh an install from the current pack source.

import { EXIT } from '../constants.mjs';
import { resolveSourceRoot } from '../core/paths.mjs';
import { resolveOperatingScope } from '../core/scope.mjs';
import { readLock } from '../core/lockfile.mjs';
import { parseCommonFlags } from '../cli/flags.mjs';
import { executeInstall } from './install.mjs';
import { VERSION } from '../version.mjs';
import { createLogger } from '../core/logger.mjs';

export async function runUpdate(argv, { log } = {}) {
  const opts = parseCommonFlags(argv);
  const logger = log ?? createLogger();
  if (opts.help) {
    logger.result(`Usage: qa update [--project <dir>] [--json] [--dry-run]

Update the installed pack from the current source tree (checkout or npm pack).
After registry publish, this will resolve the latest published version.
Always re-validates after updating.`);
    return EXIT.OK;
  }

  const scope = resolveOperatingScope(opts);
  const root = scope.root;
  const sourceRoot = resolveSourceRoot();
  const lock = readLock(root, scope.lockfile);
  const installedVersion = lock?.pack?.version ?? null;

  if (!opts.json) {
    logger.step(`pack source: ${sourceRoot}`);
    logger.step(`available version: ${VERSION}`);
    if (installedVersion) logger.step(`installed version: ${installedVersion}`);
    else logger.warn('no prior install found — will install fresh');
    if (installedVersion === VERSION) {
      logger.info('already on the source version — refreshing files for integrity');
    }
    logger.info(
      'Note: registry-based updates activate after the package is published to npm.',
    );
  }

  const agentIds = opts.agents.length
    ? opts.agents
    : (lock?.agents ?? []).map((a) => a.id).filter(Boolean);

  const result = await executeInstall({
    // The scope the command resolved, not just its root: without it the reinstall
    // reverts a global install to a project-shaped one — 1225 files and a lockfile in
    // the wrong place — while reporting success.
    scope,
    agentIds,
    force: true,
    dryRun: opts.dryRun,
    json: opts.json,
    log: logger,
  });

  if (!opts.json) {
    logger.ok(`updated to ${VERSION}`);
  }

  logger.result({
    ok: true,
    dryRun: opts.dryRun,
    previousVersion: installedVersion,
    version: VERSION,
    sourceRoot,
    registryNote: 'npm registry updates available after publish',
    install: result,
  });

  return EXIT.OK;
}
