// Safe filesystem mutation. Every install, update, or uninstall runs through a
// Transaction that backs up whatever it is about to overwrite or delete, writes
// atomically, and — on any failure — restores the project to exactly its prior
// state. A dry run plans without touching disk.

import fs from 'node:fs';
import path from 'node:path';
import { environmentError, conflictError } from './errors.mjs';

/**
 * Resolve a project-relative path, refusing anything that escapes the project.
 *
 * Every mutation the installer performs is expressed as a path relative to the
 * project root, and some of those paths come from `qa-lock.json` — a file that
 * is committed to the consumer's repository and therefore travels with a clone.
 * A lockfile containing `../../etc/something` must not be able to make
 * `uninstall` delete outside the project, so containment is enforced here, at
 * the single point every write and delete passes through, rather than at each
 * call site.
 */
function resolveInside(root, relPath) {
  if (typeof relPath !== 'string' || relPath.length === 0) {
    throw conflictError(`refusing to operate on an empty path`);
  }
  if (path.isAbsolute(relPath)) {
    throw conflictError(`refusing to operate on an absolute path: ${relPath}`);
  }
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, relPath);
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
  if (target !== resolvedRoot && !target.startsWith(prefix)) {
    throw conflictError(
      `refusing to operate outside the project: ${relPath}`,
      'a lockfile or config entry points outside the project root; re-run: qa install --force',
    );
  }
  return target;
}

/** Create dir and parents; returns the list of directories actually created. */
function ensureDir(dir, createdDirs) {
  const missing = [];
  let current = dir;
  while (!fs.existsSync(current)) {
    missing.unshift(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  for (const d of missing) {
    fs.mkdirSync(d);
    createdDirs.push(d);
  }
}

/** Write content to file via a temp file + rename, so readers never see a partial write. */
function atomicWrite(file, content) {
  const tmp = `${file}.qa-tmp-${process.pid}`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

export class Transaction {
  constructor(projectRoot, backupDir, { dryRun = false } = {}) {
    this.root = projectRoot;
    this.backupDir = backupDir; // absolute path for this run's backups
    this.dryRun = dryRun;
    this.ops = []; // { kind: 'write'|'delete', rel, content? }
  }

  write(relPath, content) {
    resolveInside(this.root, relPath); // reject escapes at staging time, not mid-commit
    this.ops.push({ kind: 'write', rel: relPath, content: Buffer.isBuffer(content) ? content : Buffer.from(content) });
  }

  delete(relPath) {
    resolveInside(this.root, relPath);
    this.ops.push({ kind: 'delete', rel: relPath });
  }

  /** Directories the transaction will need to write into, deduplicated. */
  targetDirs() {
    const dirs = new Set();
    for (const op of this.ops) {
      if (op.kind === 'write') dirs.add(path.dirname(path.join(this.root, op.rel)));
    }
    return [...dirs];
  }

  /** Fail early if a target directory exists but is not writable. */
  checkPermissions() {
    for (const dir of this.targetDirs()) {
      let probe = dir;
      while (!fs.existsSync(probe)) probe = path.dirname(probe); // nearest existing ancestor
      try {
        fs.accessSync(probe, fs.constants.W_OK);
      } catch {
        throw environmentError(`no write permission for ${probe}`);
      }
    }
  }

  /**
   * Execute the staged operations. On any error, everything already done is
   * rolled back and the original error is rethrown. Returns a summary.
   */
  commit() {
    if (this.dryRun) {
      return { written: this.ops.filter((o) => o.kind === 'write').length, deleted: this.ops.filter((o) => o.kind === 'delete').length, backedUp: 0, dryRun: true };
    }
    this.checkPermissions();

    const created = []; // files that did not exist before (remove on rollback)
    const createdDirs = []; // directories we made (remove on rollback if empty)
    const backups = []; // { abs, backup } for files that existed (restore on rollback)
    let backedUp = 0;

    const backup = (abs, rel) => {
      const dest = path.join(this.backupDir, rel);
      ensureDir(path.dirname(dest), createdDirs);
      fs.copyFileSync(abs, dest);
      backups.push({ abs, backup: dest });
      backedUp += 1;
    };

    try {
      for (const op of this.ops) {
        // Re-checked at commit time: staging and commit may be separated by
        // other code, and containment is cheap to reassert.
        const abs = resolveInside(this.root, op.rel);
        if (op.kind === 'write') {
          if (fs.existsSync(abs)) backup(abs, op.rel);
          else created.push(abs);
          ensureDir(path.dirname(abs), createdDirs);
          atomicWrite(abs, op.content);
        } else if (op.kind === 'delete') {
          if (fs.existsSync(abs)) {
            backup(abs, op.rel);
            fs.rmSync(abs);
          }
        }
      }
    } catch (error) {
      // Roll back: remove created files, restore backups, drop created dirs.
      for (const abs of created) {
        if (fs.existsSync(abs)) fs.rmSync(abs, { force: true });
      }
      for (const { abs, backup: from } of backups) {
        fs.copyFileSync(from, abs);
      }
      for (const dir of [...createdDirs].reverse()) {
        try {
          if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
        } catch {
          /* leave non-empty directories in place */
        }
      }
      throw error;
    }

    return {
      written: this.ops.filter((o) => o.kind === 'write').length,
      deleted: this.ops.filter((o) => o.kind === 'delete').length,
      backedUp,
      backupDir: backedUp > 0 ? this.backupDir : null,
      dryRun: false,
    };
  }
}

/** Remove now-empty directories from `dirs` (deepest first). Best-effort. */
export function pruneEmptyDirs(dirs) {
  for (const dir of [...dirs].sort((a, b) => b.length - a.length)) {
    try {
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
    } catch {
      /* ignore */
    }
  }
}
