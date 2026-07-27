// Conflict detection. The installer must never silently overwrite a file it
// does not own. A conflict is an on-disk file that (a) we are about to write,
// (b) differs from what we would write, and (c) was not recorded as pack-owned
// by a previous install. Files owned by the prior lockfile are ours to update;
// byte-identical files are a no-op, not a conflict.

import fs from 'node:fs';
import path from 'node:path';
import { hashFile } from './hash.mjs';

/**
 * @param {object}   args
 * @param {string}   args.projectRoot
 * @param {Array<{path:string, sha256:string}>} args.planned  files we intend to write
 * @param {object|null} args.priorLock  the previous lockfile, if any
 * @returns {Array<{path:string, reason:string}>}  conflicts (empty = safe)
 */
export function detectConflicts({ projectRoot, planned, priorLock }) {
  const owned = new Set((priorLock?.files ?? []).map((f) => f.path));
  const conflicts = [];
  for (const entry of planned) {
    const abs = path.join(projectRoot, entry.path);
    if (!fs.existsSync(abs)) continue; // brand-new file, no conflict
    if (owned.has(entry.path)) continue; // pack-owned, safe to update
    if (hashFile(abs) === entry.sha256) continue; // identical content, no-op
    conflicts.push({ path: entry.path, reason: 'exists and is not owned by a previous install' });
  }
  return conflicts;
}
