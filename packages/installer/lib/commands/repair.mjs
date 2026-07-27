// `qa repair` — fix common install problems by reinstalling pack-owned files.

import { EXIT, LOCKFILE } from '../constants.mjs';
import { resolveProjectRoot } from '../core/paths.mjs';
import { readLock } from '../core/lockfile.mjs';
import { parseCommonFlags } from '../cli/flags.mjs';
import { executeInstall } from './install.mjs';
import { validateInstall } from '../core/validate-install.mjs';
import { createLogger } from '../core/logger.mjs';

export async function runRepair(argv, { log } = {}) {
  const opts = parseCommonFlags(argv);
  const logger = log ?? createLogger();
  if (opts.help) {
    logger.result(`Usage: qa repair [--project <dir>] [--json] [--dry-run]

Repair a broken or drifted installation:
  - missing lockfile → fresh install
  - drifted / missing pack files → reinstall with --force
  - then re-validate`);
    return EXIT.OK;
  }

  const root = resolveProjectRoot(opts.project ?? process.cwd());
  const prior = readLock(root);
  const before = validateInstall(root);

  if (!opts.json) {
    logger.step(`repairing ${root}`);
    if (!prior) logger.warn(`no ${LOCKFILE} — performing fresh install`);
    else {
      const bad = before.checks.filter((c) => !c.ok);
      if (bad.length === 0) logger.ok('installation already healthy — refreshing anyway');
      else for (const c of bad) logger.warn(`${c.id}: ${c.message}`);
    }
  }

  const agentIds = opts.agents.length
    ? opts.agents
    : (prior?.agents ?? []).map((a) => a.id).filter(Boolean);

  const result = await executeInstall({
    projectRoot: root,
    agentIds,
    force: true,
    dryRun: opts.dryRun,
    json: opts.json,
    log: logger,
  });

  const after = opts.dryRun ? before : validateInstall(root);

  if (!opts.json) {
    if (after.ok) logger.ok('repair complete — installation validated');
    else logger.error('repair finished but validation still failing — run: qa doctor');
  }

  logger.result({
    ok: after.ok,
    repaired: true,
    dryRun: opts.dryRun,
    before: before.checks.filter((c) => !c.ok).map((c) => c.id),
    after: after.checks,
    install: result,
  });

  return after.ok || opts.dryRun ? EXIT.OK : EXIT.VERIFY;
}
