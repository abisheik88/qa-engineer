// Safe filesystem mutation. Every install, update, or uninstall runs through a
// Transaction that backs up whatever it is about to overwrite or delete, writes
// atomically, and — on any failure — restores the project to exactly its prior
// state. A dry run plans without touching disk.

import fs from 'node:fs';
import path from 'node:path';
import { environmentError, conflictError } from './errors.mjs';

// Directories whose contents are never the installer's to touch, however a path
// reaches it. Deleting a repository's own metadata (or its hooks) is not a
// recoverable mistake, and no pack file legitimately lives there.
const FORBIDDEN_SEGMENTS = new Set(['.git', '.hg', '.svn']);

/** Contained inside `root` (or equal to it), compared as resolved paths. */
function isInside(root, target) {
  if (target === root) return true;
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  return target.startsWith(prefix);
}

/**
 * The deepest existing ancestor of `target`, with symlinks resolved, plus the
 * not-yet-existing suffix appended. Used so containment reflects where a write
 * would *land*, not merely how its path is spelled.
 */
function realTargetPath(target) {
  let probe = target;
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) return target; // reached the filesystem root
    probe = parent;
  }
  const suffix = path.relative(probe, target);
  const realProbe = fs.realpathSync(probe);
  return suffix ? path.join(realProbe, suffix) : realProbe;
}

/**
 * Resolve a project-relative path, refusing anything that escapes the project.
 *
 * Every mutation the installer performs is expressed as a path relative to the
 * project root, and some of those paths come from `qa-lock.json` — a file that is
 * committed to the consumer's repository and therefore travels with a clone.
 * Both the lockfile *and* the tree it describes are attacker-influenced, so two
 * escapes must be closed, and closing only the first is a false sense of safety:
 *
 *   lexical   `../../etc/passwd` — spelled outside the project.
 *   symbolic  `link/file` where `link` is a symlink pointing outside. The path is
 *             lexically inside; `fs` follows the link and writes or deletes
 *             outside anyway. Git stores symlinks, so this arrives by clone.
 *
 * Containment therefore compares *real* paths, and lives at the single point
 * every write and delete passes through rather than at each call site.
 */
function resolveInside(root, relPath) {
  if (typeof relPath !== 'string' || relPath.length === 0) {
    throw conflictError('refusing to operate on an empty path');
  }
  if (relPath.includes('\0')) {
    throw conflictError('refusing to operate on a path containing a null byte');
  }
  if (path.isAbsolute(relPath)) {
    throw conflictError(`refusing to operate on an absolute path: ${relPath}`);
  }
  for (const segment of relPath.split(/[\\/]+/)) {
    if (FORBIDDEN_SEGMENTS.has(segment)) {
      throw conflictError(
        `refusing to operate inside ${segment}/: ${relPath}`,
        'no pack file belongs in a version-control directory',
      );
    }
  }

  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, relPath);
  if (!isInside(resolvedRoot, target)) {
    throw conflictError(
      `refusing to operate outside the project: ${relPath}`,
      'a lockfile or config entry points outside the project root; re-run: qa install --force',
    );
  }

  // Symlink containment: where would this actually land?
  const realRoot = fs.existsSync(resolvedRoot) ? fs.realpathSync(resolvedRoot) : resolvedRoot;
  if (!isInside(realRoot, realTargetPath(target))) {
    throw conflictError(
      `refusing to follow a link out of the project: ${relPath}`,
      'a path inside the project resolves outside it through a symbolic link',
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

/**
 * The target of a symlink at `abs`, or null when there is no link there.
 *
 * `lstat` rather than `exists`, because a link pointing at something that has been
 * deleted still exists as a link and still has to be replaced rather than written over.
 */
export function readLinkTarget(abs) {
  try {
    const stat = fs.lstatSync(abs);
    if (!stat.isSymbolicLink()) return null;
    return fs.readlinkSync(abs);
  } catch {
    return null;
  }
}

/**
 * Create a directory link, choosing the kind the platform will allow.
 *
 * On Windows a symbolic link needs either administrator rights or Developer Mode, while
 * a *junction* needs neither and behaves the same for reading a directory. Preferring a
 * junction there is the difference between a global install that works for every Windows
 * developer and one that works only for those running an elevated shell.
 */
export function createLink(abs, target) {
  const type = process.platform === 'win32' ? 'junction' : 'dir';
  fs.symlinkSync(target, abs, type);
}

/**
 * Can this filesystem hold a directory link at all?
 *
 * Asked once, before planning, rather than discovered halfway through a transaction.
 * The answer is no more often than it looks: a FAT- or exFAT-formatted volume supports
 * neither symlinks nor junctions, some container and network mounts refuse them, and a
 * Windows host without Developer Mode refuses symlinks (which is why `createLink` asks
 * for a junction there instead).
 *
 * When the answer is no the installer copies instead. A global install that fails
 * outright on a USB stick would be a worse tool than one that uses more disk.
 */
export function canLink(root) {
  const probe = path.join(root, `.qa-linkprobe-${process.pid}`);
  const target = path.join(root, `.qa-linktarget-${process.pid}`);
  try {
    fs.mkdirSync(target, { recursive: true });
    createLink(probe, target);
    const ok = readLinkTarget(probe) !== null;
    fs.unlinkSync(probe);
    fs.rmdirSync(target);
    return ok;
  } catch {
    // Clean up whatever got as far as existing, then report no.
    try {
      if (readLinkTarget(probe) !== null) fs.unlinkSync(probe);
    } catch { /* nothing to undo */ }
    try {
      if (fs.existsSync(target)) fs.rmdirSync(target);
    } catch { /* nothing to undo */ }
    return false;
  }
}

/** True when the file already holds exactly these bytes. */
function sameContent(file, content) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size !== content.length) return false;
    return fs.readFileSync(file).equals(content);
  } catch {
    return false;
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

  /**
   * Stage a symbolic link at `relPath` pointing at `targetAbs`.
   *
   * Links are how a global install serves an agent without copying the skills again.
   * They go through the transaction rather than around it so a half-linked install
   * rolls back like a half-written one — and because replacing a link silently would
   * lose where the old one pointed.
   *
   * Only a link may be replaced by a link. A real directory at the target path belongs
   * to someone else, and the conflict detector is what decides whether the user wants it
   * overwritten; reaching here with one is a bug, so it throws rather than deleting a
   * directory nobody agreed to lose.
   */
  link(relPath, targetAbs) {
    resolveInside(this.root, relPath);
    this.ops.push({ kind: 'link', rel: relPath, target: targetAbs });
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
    let unchanged = 0; // already byte-identical: neither written nor backed up
    const replacedLinks = []; // { abs, target } symlinks removed (recreate on rollback)
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
          if (fs.existsSync(abs)) {
            // Reinstalling identical content is the common case for update and repair.
            // Backing it up copies the whole install into a dated directory on every
            // run — three copies of the engine after two commands — and restoring a
            // byte-identical file on rollback achieves nothing.
            if (sameContent(abs, op.content)) {
              unchanged += 1;
              continue;
            }
            backup(abs, op.rel);
          } else {
            created.push(abs);
          }
          ensureDir(path.dirname(abs), createdDirs);
          atomicWrite(abs, op.content);
        } else if (op.kind === 'delete') {
          // A link is deleted by unlinking it, and "backed up" by remembering where it
          // pointed. Copying it would follow the link and try to copy a directory as a
          // file, which is how uninstall crashed on a global install.
          const linkTarget = readLinkTarget(abs);
          if (linkTarget !== null) {
            replacedLinks.push({ abs, target: linkTarget });
            fs.unlinkSync(abs);
          } else if (fs.existsSync(abs)) {
            backup(abs, op.rel);
            fs.rmSync(abs);
          }
        } else if (op.kind === 'link') {
          const existing = readLinkTarget(abs);
          if (existing !== null) {
            replacedLinks.push({ abs, target: existing });
            fs.unlinkSync(abs);
          } else if (fs.existsSync(abs)) {
            throw environmentError(
              `refusing to replace ${abs} with a link: it is a real file or directory, not a link ` +
                'this installer created',
            );
          } else {
            created.push(abs);
          }
          ensureDir(path.dirname(abs), createdDirs);
          createLink(abs, op.target);
        }
      }
    } catch (error) {
      // Roll back: remove created files and links, restore backups and replaced links,
      // drop created dirs.
      for (const abs of created) {
        if (readLinkTarget(abs) !== null) fs.unlinkSync(abs);
        else if (fs.existsSync(abs)) fs.rmSync(abs, { force: true });
      }
      for (const { abs, target } of replacedLinks) {
        if (!fs.existsSync(abs) && readLinkTarget(abs) === null) {
          try {
            createLink(abs, target);
          } catch {
            /* best effort: the original error is what matters */
          }
        }
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
      written: this.ops.filter((o) => o.kind === 'write').length - unchanged,
      unchanged,
      deleted: this.ops.filter((o) => o.kind === 'delete').length,
      linked: this.ops.filter((o) => o.kind === 'link').length,
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
