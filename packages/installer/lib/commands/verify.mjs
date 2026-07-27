// `qa verify` — compare on-disk files to qa-lock.json hashes.

import fs from 'node:fs';
import path from 'node:path';
import { EXIT, LOCKFILE } from '../constants.mjs';
import { resolveProjectRoot } from '../core/paths.mjs';
import { readLock } from '../core/lockfile.mjs';
import { hashFile } from '../core/hash.mjs';
import { verifyError } from '../core/errors.mjs';
import { createLogger } from '../core/logger.mjs';
import { parseCommonFlags } from '../cli/flags.mjs';

export async function runVerify(argv, { log } = {}) {
  const opts = parseCommonFlags(argv);
  const logger = log ?? createLogger();
  if (opts.help) {
    logger.result(`Usage: qa verify [--project <dir>] [--json]

Verify installed files match qa-lock.json.
On failure: run qa repair`);
    return EXIT.OK;
  }

  const root = resolveProjectRoot(opts.project ?? process.cwd());
  const lock = readLock(root);
  if (!lock) {
    if (!opts.json) {
      logger.error(`FAIL  no ${LOCKFILE}`);
      logger.info('  → run: qa install');
    }
    throw verifyError(`no ${LOCKFILE} in ${root}`, 'run: qa install');
  }

  const problems = [];
  for (const entry of lock.files) {
    const abs = path.join(root, entry.path);
    if (!fs.existsSync(abs)) {
      problems.push({ path: entry.path, reason: 'missing' });
      continue;
    }
    const actual = hashFile(abs);
    if (actual !== entry.sha256) {
      problems.push({ path: entry.path, reason: 'hash mismatch' });
    }
  }

  if (problems.length > 0) {
    if (!opts.json) {
      logger.error(`FAIL  ${problems.length} drift(s) detected`);
      for (const p of problems.slice(0, 20)) logger.info(`  ${p.path}: ${p.reason}`);
      if (problems.length > 20) logger.info(`  … and ${problems.length - 20} more`);
      logger.info('  → run: qa repair');
    }
    throw verifyError('installed files drifted from qa-lock.json', 'run: qa repair');
  }

  if (!opts.json) {
    logger.ok(`PASS  verified ${lock.files.length} file(s)`);
  }
  logger.result({ ok: true, files: lock.files.length, pack: lock.pack });
  return EXIT.OK;
}
