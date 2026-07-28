// Reading and writing qa-lock.json — the record of exactly what was installed.
// The lockfile is the manifest uninstall and verify trust; it is validated
// against its schema on both read and write so a corrupt lockfile fails loudly.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCKFILE, PACK_NAME } from '../constants.mjs';
import { VERSION, SPEC_REVISION } from '../version.mjs';
import { QaError } from './errors.mjs';
import { validate } from '../../../engine/lib/analysis/contracts.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(here, '..', '..', 'schemas', 'qa-lock.schema.json');

export const LOCK_SCHEMA = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
export const LOCKFILE_VERSION = 1;

export function lockPath(projectRoot) {
  return path.join(projectRoot, LOCKFILE);
}

export function readLock(projectRoot) {
  const file = lockPath(projectRoot);
  if (!fs.existsSync(file)) return null;
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new QaError(`${LOCKFILE} is corrupt (invalid JSON): ${error.message}`);
  }
  const errors = validate(raw, LOCK_SCHEMA);
  if (errors.length > 0) {
    throw new QaError(`${LOCKFILE} does not match its schema:\n  - ${errors.join('\n  - ')}`);
  }
  return raw;
}

/**
 * Assemble a lockfile object. `now` is injected so tests are deterministic;
 * the CLI passes the real time.
 */
export function buildLock({ agents, files, now }) {
  const lock = {
    lockfileVersion: LOCKFILE_VERSION,
    pack: { name: PACK_NAME, version: VERSION, specRevision: SPEC_REVISION },
    installer: VERSION,
    generatedAt: now,
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      tier: a.tier ?? null,
      skillsDir: a.skillsDir,
      // Whether project markers actually identified this host, as opposed to it
      // being requested with --agent or standing in as the unknown-agent path.
      detected: Boolean(a.detected),
    })),
    files: [...files].sort((a, b) => a.path.localeCompare(b.path)),
    summary: {
      skills: new Set(files.filter((f) => f.owner === 'skill' && f.skill).map((f) => `${f.agent}:${f.skill}`)).size,
      files: files.length,
      wrappers: files.filter((f) => f.owner === 'wrapper').length,
      directories: new Set(files.map((f) => path.posix.dirname(f.path))).size,
    },
  };
  const errors = validate(lock, LOCK_SCHEMA);
  if (errors.length > 0) {
    throw new QaError(`internal error: generated lockfile is invalid:\n  - ${errors.join('\n  - ')}`);
  }
  return lock;
}

export function serializeLock(lock) {
  return `${JSON.stringify(lock, null, 2)}\n`;
}
