// `qa self-test` — verify an installation is operational.

import { EXIT } from '../constants.mjs';
import { resolveProjectRoot } from '../core/paths.mjs';
import { parseCommonFlags } from '../cli/flags.mjs';
import { validateInstall } from '../core/validate-install.mjs';
import { createLogger } from '../core/logger.mjs';

export async function runSelfTest(argv, { log } = {}) {
  const opts = parseCommonFlags(argv);
  const logger = log ?? createLogger();
  if (opts.help) {
    logger.result(`Usage: qa self-test [--project <dir>] [--json]

Verify skills, lockfile integrity, bundled engine, contracts, and environment.
Prints PASS/FAIL per check. Does not invoke live AI agents.`);
    return EXIT.OK;
  }

  const root = resolveProjectRoot(opts.project ?? process.cwd());
  const { ok, checks } = validateInstall(root);

  if (!opts.json) {
    logger.step(`self-test — ${root}`);
    for (const check of checks) {
      const tag = check.ok ? 'PASS' : check.hard ? 'FAIL' : 'WARN';
      const line = `[${tag}] ${check.id}: ${check.message}`;
      if (check.ok) logger.ok(line);
      else if (check.hard) logger.error(line);
      else logger.warn(line);
      if (!check.ok && check.hint) logger.info(`       → ${check.hint}`);
    }
    if (ok) logger.ok('self-test PASSED');
    else logger.error('self-test FAILED');
  }

  logger.result({
    ok,
    projectRoot: root,
    checks,
    note: 'Live skill activation is verified in your AI assistant (see guided first-run).',
  });

  return ok ? EXIT.OK : EXIT.VERIFY;
}
