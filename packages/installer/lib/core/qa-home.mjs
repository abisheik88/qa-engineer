// The directory QA Engineer owns on a machine, and the rules for what lives in it.
//
// ## Why a single owned directory
//
// Before this existed, installing "globally" meant pointing `--project` at `$HOME`,
// which scattered `qa-lock.json`, `.agents/`, and `.claude/` across the user's home
// directory and depended on behaviour nothing documented or tested. A tool that writes
// into `$HOME` directly is a tool that cannot be cleanly uninstalled, because nobody
// can tell which of those files it put there.
//
// So: one directory, everything inside it, and `uninstall` can remove it wholesale.
// The same shape Docker, the AWS CLI, and Cargo use, for the same reason.
//
//   ~/.qa-engineer/
//     engine/          one copy of the deterministic engine, shared by every skill
//     skills/          one canonical copy of the skills
//     config/          machine-level configuration
//     sessions/        stored authentication, per application
//     cache/           regenerable — safe to delete at any time
//     logs/            diagnostics
//     qa-lock.json     what is installed, with a hash per file
//
// ## Why not XDG
//
// On Linux the tidier answer is `$XDG_DATA_HOME/qa-engineer` plus `$XDG_STATE_HOME`
// and `$XDG_CACHE_HOME` — three directories, three variables, three fallbacks, and a
// different layout on macOS and Windows. The cost is that a user who wants to see what
// the tool owns has to look in three places on one OS and one place on another, and
// that `uninstall` has three roots to get right.
//
// One dot-directory in `$HOME` is what Docker, AWS, Cargo, and Git do, works
// identically on all three platforms, and is overridable in full by
// `QA_ENGINEER_HOME` for anyone who wants it elsewhere. Cache lives inside it and is
// documented as safe to delete, which is the only thing XDG would really have bought.
//
// ## Directories are created on demand
//
// Only `engine/`, `skills/`, and the lockfile are written at install time. `sessions/`,
// `cache/`, and `logs/` are created by whoever first writes to them. An empty directory
// promising a feature that does not exist yet is a lie the filesystem tells forever.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { QA_HOME_DIR_NAME, QA_HOME_ENV, LOCKFILE } from '../constants.mjs';
import { environmentError } from './errors.mjs';

/**
 * Subdirectories of the home, and whether an install creates them.
 *
 * `installed: true` means the installer writes content there and `verify` expects it.
 * Everything else appears the first time something needs it.
 */
export const HOME_LAYOUT = Object.freeze({
  engine: { dir: 'engine', installed: true, purpose: 'the deterministic engine, shared by every skill' },
  skills: { dir: 'skills', installed: true, purpose: 'the canonical copy of the skills' },
  adapters: { dir: 'adapters', installed: false, purpose: 'per-agent integration state' },
  config: { dir: 'config', installed: false, purpose: 'machine-level configuration' },
  sessions: { dir: 'sessions', installed: false, purpose: 'stored authentication, one file per application' },
  cache: { dir: 'cache', installed: false, purpose: 'regenerable — safe to delete at any time' },
  logs: { dir: 'logs', installed: false, purpose: 'diagnostics' },
});

/**
 * The absolute path of the QA Engineer home.
 *
 * `QA_ENGINEER_HOME` wins when set, which is what makes the whole thing testable: the
 * test suite points it at a temporary directory rather than touching a real `$HOME`.
 * It is also the escape hatch for anyone whose home is on a network share or who wants
 * the install on another volume.
 */
export function qaHome({ env = process.env, homedir = os.homedir } = {}) {
  const override = env[QA_HOME_ENV];
  if (override && override.trim()) {
    const resolved = path.resolve(override.trim());
    if (resolved === path.parse(resolved).root) {
      // A home at `/` would make `uninstall` a catastrophe.
      throw environmentError(`${QA_HOME_ENV} must not be a filesystem root: ${resolved}`);
    }
    return resolved;
  }

  // The test suite redirects the user's home wholesale; the owned directory follows it,
  // so a global install can be proven end to end without touching a real home.
  const home = env.QA_ENGINEER_USER_HOME?.trim() || homedir();
  if (!home || home === path.parse(home || '/').root) {
    throw environmentError(
      `could not determine a home directory for the global install; set ${QA_HOME_ENV} to choose one`,
    );
  }
  return path.join(home, QA_HOME_DIR_NAME);
}

/** Absolute path of one layout directory. */
export function homePath(kind, options) {
  const entry = HOME_LAYOUT[kind];
  if (!entry) throw new Error(`unknown qa-home directory: ${kind}`);
  return path.join(qaHome(options), entry.dir);
}

/** Absolute path of the global lockfile. Inside the home, never loose in `$HOME`. */
export function homeLockPath(options) {
  return path.join(qaHome(options), LOCKFILE);
}

/** Create a layout directory on demand and return it. */
export function ensureHomeDir(kind, options) {
  const target = homePath(kind, options);
  fs.mkdirSync(target, { recursive: true });
  return target;
}

/** True when a global install is present — the engine is the load-bearing part. */
export function isGlobalInstalled(options) {
  return fs.existsSync(path.join(homePath('engine', options), 'bin', 'qa-engine.mjs'));
}

/**
 * A description of the home for `doctor`: what exists, what does not, and what each
 * directory is for. Reporting an absent optional directory as "not yet created" rather
 * than as missing is the difference between a diagnostic and a false alarm.
 */
export function describeHome(options) {
  const root = qaHome(options);
  const present = fs.existsSync(root);
  return {
    root,
    present,
    lockfile: homeLockPath(options),
    engineInstalled: isGlobalInstalled(options),
    directories: Object.entries(HOME_LAYOUT).map(([kind, entry]) => {
      const absolute = path.join(root, entry.dir);
      const exists = fs.existsSync(absolute);
      return {
        kind,
        path: absolute,
        purpose: entry.purpose,
        exists,
        expected: entry.installed,
        state: exists ? 'present' : entry.installed ? 'missing' : 'not yet created',
      };
    }),
  };
}
