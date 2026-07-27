// Locating the pack source (what we install FROM) and the target project (what
// we install INTO), plus small filesystem helpers used across the installer.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACK_NAME } from '../constants.mjs';
import { environmentError } from './errors.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

function isPackRoot(dir) {
  const manifest = path.join(dir, 'package.json');
  if (!fs.existsSync(manifest) || !fs.existsSync(path.join(dir, 'skills'))) return false;
  try {
    return JSON.parse(fs.readFileSync(manifest, 'utf8')).name === PACK_NAME;
  } catch {
    return false;
  }
}

/**
 * The directory that contains the skills to install. Resolved from, in order:
 *   1. QA_PACK_SOURCE (an explicit override, used by tests and power users),
 *   2. the nearest ancestor of this file that looks like the pack root.
 * Whether run from a git checkout or an npm/npx install, both resolve here.
 */
export function resolveSourceRoot() {
  const override = process.env.QA_PACK_SOURCE;
  if (override) {
    const resolved = path.resolve(override);
    if (!isPackRoot(resolved)) {
      throw environmentError(`QA_PACK_SOURCE is not a pack root: ${resolved}`);
    }
    return resolved;
  }
  let dir = here;
  while (true) {
    if (isPackRoot(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw environmentError(
    'could not locate the pack source (no ancestor package.json named ' +
      `"${PACK_NAME}" with a skills/ directory); set QA_PACK_SOURCE to override`,
  );
}

/** The project we install into. Defaults to the current working directory. */
export function resolveProjectRoot(cwd = process.cwd()) {
  return path.resolve(cwd);
}

/** All files under dir, returned as paths relative to dir, sorted, POSIX-style. */
export function listFilesRelative(dir) {
  const out = [];
  const walk = (current, prefix) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === '__pycache__' || entry.name.endsWith('.pyc')) continue;
      const abs = path.join(current, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, rel);
      else if (entry.isFile()) out.push(rel);
    }
  };
  if (fs.existsSync(dir)) walk(dir, '');
  return out.sort();
}

/** POSIX-normalized relative path, so lockfiles are identical across platforms. */
export function toPosix(relPath) {
  return relPath.split(path.sep).join('/');
}
