// `qa uninstall` — remove exactly what was installed, and nothing else.
//
// The lockfile is the manifest: every path it lists was written by the installer
// with a recorded hash, so uninstall knows precisely what it owns. Anything not
// in the lockfile is the user's and is never touched.
//
// Removal runs through the same Transaction as install, update, and repair, so
// it inherits the same guarantees: every deleted file is backed up first, and a
// failure part-way through restores the project to its prior state rather than
// leaving a half-removed install.
//
// A file that drifted from its recorded hash may carry local edits. Deleting it
// silently would destroy work, so drift stops the uninstall and names the files;
// `--force` proceeds (still with backups).

import fs from 'node:fs';
import path from 'node:path';
import { EXIT, LOCKFILE, BACKUP_DIR } from '../constants.mjs';
import { resolveProjectRoot } from '../core/paths.mjs';
import { readLock, lockPath } from '../core/lockfile.mjs';
import { hashFile } from '../core/hash.mjs';
import { Transaction, pruneEmptyDirs } from '../core/fs-safe.mjs';
import { conflictError, verifyError } from '../core/errors.mjs';
import { createLogger } from '../core/logger.mjs';
import { parseCommonFlags } from '../cli/flags.mjs';

/** Every __pycache__ directory at or beneath `dir` (empty list if dir is gone). */
function findPycache(dir) {
  const found = [];
  if (!fs.existsSync(dir)) return found;
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = path.join(current, entry.name);
      if (entry.name === '__pycache__') found.push(full);
      else walk(full);
    }
  };
  walk(dir);
  return found;
}

export async function runUninstall(argv, { log } = {}) {
  const opts = parseCommonFlags(argv);
  const logger = log ?? createLogger();
  if (opts.help) {
    logger.result(`Usage: qa uninstall [--project <dir>] [--json] [--dry-run] [--force]

Remove every file listed in ${LOCKFILE}, then the lockfile itself.
Only pack-owned files are removed; anything else is left alone.

  --dry-run   list what would be removed, write nothing
  --force     remove files that drifted from their recorded hash`);
    return EXIT.OK;
  }

  const root = resolveProjectRoot(opts.project ?? process.cwd());
  const lock = readLock(root);
  if (!lock) {
    if (!opts.json) {
      logger.error(`FAIL  no ${LOCKFILE} in ${root}`);
      logger.info('  → nothing to uninstall');
    }
    throw verifyError(`no ${LOCKFILE} in ${root}`, 'nothing to uninstall');
  }

  const present = [];
  const missing = [];
  const drifted = [];
  for (const entry of lock.files) {
    const abs = path.join(root, entry.path);
    if (!fs.existsSync(abs)) {
      missing.push(entry.path);
      continue;
    }
    if (hashFile(abs) !== entry.sha256) drifted.push(entry.path);
    present.push(entry.path);
  }

  if (drifted.length > 0 && !opts.force) {
    if (!opts.json) {
      logger.error(`FAIL  ${drifted.length} installed file(s) have local changes`);
      for (const p of drifted.slice(0, 20)) logger.info(`  ${p}`);
      if (drifted.length > 20) logger.info(`  … and ${drifted.length - 20} more`);
      logger.info('  → keep them: back them up, then re-run');
      logger.info('  → discard them: qa uninstall --force');
    }
    throw conflictError(
      `${drifted.length} installed file(s) drifted from ${LOCKFILE}`,
      'run: qa uninstall --force to remove them anyway',
    );
  }

  if (!opts.json) {
    logger.step(`project: ${root}`);
    logger.step(`removing: ${present.length} file(s)${missing.length ? `, ${missing.length} already gone` : ''}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const tx = new Transaction(root, path.join(root, BACKUP_DIR, stamp), { dryRun: opts.dryRun });
  for (const rel of present) tx.delete(rel);
  if (fs.existsSync(lockPath(root))) tx.delete(LOCKFILE);
  const summary = tx.commit();

  // Byproducts of the pack's own bundled code: Python writes __pycache__ next to
  // the modules it imports, so those directories exist because of us and are not
  // in the lockfile. They are regenerable bytecode, so they are removed without
  // a backup — but only under directories that held pack-owned bundle files,
  // never anywhere else in the project.
  let removedByproducts = 0;
  if (!opts.dryRun) {
    const bundleDirs = new Set();
    for (const rel of lock.files) {
      const marker = rel.path.indexOf('scripts/lib/');
      if (marker !== -1) {
        bundleDirs.add(path.join(root, rel.path.slice(0, marker + 'scripts/lib'.length)));
      }
    }
    for (const bundleDir of bundleDirs) {
      for (const cache of findPycache(bundleDir)) {
        fs.rmSync(cache, { recursive: true, force: true });
        removedByproducts += 1;
      }
    }
  }

  // Leave no empty skeleton behind: prune directories the pack created, deepest
  // first, stopping at anything that still holds a file the user owns.
  let prunedDirs = 0;
  if (!opts.dryRun) {
    const dirs = new Set();
    for (const rel of [...present, ...missing]) {
      let dir = path.dirname(path.join(root, rel));
      // Walk up to (but never past) the project root.
      while (dir.startsWith(root) && dir !== root) {
        dirs.add(dir);
        dir = path.dirname(dir);
      }
    }
    const before = [...dirs].filter((d) => fs.existsSync(d)).length;
    pruneEmptyDirs([...dirs]);
    prunedDirs = before - [...dirs].filter((d) => fs.existsSync(d)).length;
  }

  if (!opts.json) {
    if (opts.dryRun) logger.ok(`dry run: would remove ${present.length + 1} file(s)`);
    else {
      logger.ok(`uninstalled ${summary.deleted} file(s); removed ${LOCKFILE}`);
      if (prunedDirs > 0) logger.step(`pruned ${prunedDirs} empty directory(ies)`);
      if (summary.backupDir) logger.step(`backup: ${path.relative(root, summary.backupDir)}`);
    }
  }

  logger.result({
    ok: true,
    uninstalled: true,
    dryRun: Boolean(opts.dryRun),
    removed: opts.dryRun ? present.length + 1 : summary.deleted,
    alreadyMissing: missing.length,
    driftedRemoved: opts.force ? drifted.length : 0,
    removedByproducts,
    prunedDirectories: prunedDirs,
    backupDir: summary.backupDir ?? null,
  });

  return EXIT.OK;
}
