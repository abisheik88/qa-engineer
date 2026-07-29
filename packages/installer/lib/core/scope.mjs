// Installation scopes: where an install lives, and what it shares.
//
// Before this, there was one shape — "a project" — and every other arrangement was a
// user pointing `--project` somewhere unusual and hoping. Three arrangements are real,
// and each is now a named, tested mode rather than a trick:
//
//   global     one install per machine, in ~/.qa-engineer, reused by every project
//   workspace  one install per monorepo, at the repository root, reused by every package
//   project    one install in this project — the original behaviour, unchanged
//
// ## The one idea that makes sharing work
//
// A scope has a `qaRoot`: a directory holding exactly one copy of the engine and one
// canonical copy of the skills. Global puts it in the user's home; workspace puts it at
// the monorepo root; project has none, and keeps the engine bundled inside each skill
// the way it always has.
//
// The launcher (`shared/tooling/qa-tool.mjs`) walks up from wherever a skill happens to
// live looking for `.qa-engineer/engine`, then falls back to the machine home, then to
// node_modules, then to npx. So a skill does not need to know which scope installed it
// — which is precisely why one skill directory can serve all three.
//
// ## Why project mode is left alone
//
// Every existing install on disk is a project install. Changing what those look like
// would mean an upgrade that rewrites a user's repository, and `verify` reporting drift
// on installs that were fine. The safe direction here is obvious: new modes are added,
// the old one is not touched, and a 0.10 lockfile still verifies under 0.11.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { LOCKFILE, QA_HOME_DIR_NAME } from '../constants.mjs';
import { qaHome } from './qa-home.mjs';
import { usageError } from './errors.mjs';

export const SCOPES = Object.freeze(['global', 'workspace', 'project']);

// Files that mark the root of a monorepo. Ordered by how strongly each implies "this is
// the top": a lockfile is decisive, a workspace manifest nearly so, `.git` last because
// a submodule has one too.
const WORKSPACE_MARKERS = Object.freeze([
  { file: 'pnpm-workspace.yaml', kind: 'pnpm' },
  { file: 'lerna.json', kind: 'lerna' },
  { file: 'nx.json', kind: 'nx' },
  { file: 'turbo.json', kind: 'turborepo' },
  { file: 'rush.json', kind: 'rush' },
  { file: 'go.work', kind: 'go' },
  { file: 'Cargo.toml', kind: 'cargo', check: (text) => /^\s*\[workspace\]/m.test(text) },
]);

/** True when this package.json declares npm/yarn workspaces. */
function declaresNpmWorkspaces(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed.workspaces) || typeof parsed.workspaces === 'object';
  } catch {
    return false;
  }
}

/**
 * Walk up from `start` looking for the root of a monorepo.
 *
 * Returns the *highest* match rather than the nearest: in a repository where a package
 * has its own `package.json` and the root declares workspaces, the root is the answer.
 * Stopping at the first hit would install once per package, which is the duplication
 * this mode exists to remove.
 */
export function findWorkspaceRoot(start = process.cwd(), { limit = 24 } = {}) {
  let dir = path.resolve(start);
  let best = null;

  for (let depth = 0; depth < limit; depth += 1) {
    for (const marker of WORKSPACE_MARKERS) {
      const file = path.join(dir, marker.file);
      if (!fs.existsSync(file)) continue;
      if (marker.check) {
        let text = '';
        try {
          text = fs.readFileSync(file, 'utf8');
        } catch {
          continue;
        }
        if (!marker.check(text)) continue;
      }
      best = { root: dir, kind: marker.kind, marker: marker.file };
    }

    const manifest = path.join(dir, 'package.json');
    if (fs.existsSync(manifest) && declaresNpmWorkspaces(manifest)) {
      best = { root: dir, kind: 'npm', marker: 'package.json' };
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return best;
}

/**
 * The user's home, where agent user-level directories live.
 *
 * `QA_ENGINEER_USER_HOME` exists for the test suite, which must not write into a real
 * home to prove that a global install works. It is deliberately separate from
 * `QA_ENGINEER_HOME`: that one moves what *we* own, this one moves where *agents* look,
 * and a test needs to move both together while a user normally moves neither.
 */
export function resolveUserHome({ env = process.env } = {}) {
  const override = env.QA_ENGINEER_USER_HOME;
  if (override && override.trim()) return path.resolve(override.trim());
  return os.homedir();
}

/** The deepest directory containing both paths. */
function commonAncestor(a, b) {
  const left = path.resolve(a).split(path.sep);
  const right = path.resolve(b).split(path.sep);
  const shared = [];
  for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
    if (left[i] !== right[i]) break;
    shared.push(left[i]);
  }
  return shared.join(path.sep) || path.parse(path.resolve(a)).root;
}

/** POSIX-style path from `root` to `target`, for lockfile entries. */
function toRelative(root, target) {
  return path.relative(root, target).split(path.sep).join('/');
}

/**
 * Resolve the scope a command should operate on.
 *
 * Exactly one mode may be requested. Defaulting silently to `project` when `--global`
 * was misspelled would install into whatever directory the user happened to be in,
 * which is the kind of surprise that costs trust once and permanently.
 */
export function resolveScope({
  global: wantGlobal = false,
  workspace = false,
  project = null,
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  const requested = [wantGlobal && 'global', workspace && 'workspace', project && 'project'].filter(Boolean);
  if (requested.length > 1) {
    throw usageError(
      `choose one installation scope, not ${requested.length}: ${requested.map((r) => `--${r}`).join(' and ')}`,
    );
  }

  if (wantGlobal) {
    // Two directories are in play and they are not the same one. Everything the tool
    // owns goes in `qaRoot`; the links that make agents see it go in *their* user-level
    // directories, which live in the user's home. Conflating the two put `.claude/` and
    // `.gemini/` inside `~/.qa-engineer`, where no agent looks.
    const qaRoot = qaHome({ env });
    const userHome = resolveUserHome({ env });
    const root = commonAncestor(qaRoot, userHome);

    if (root === path.parse(root).root) {
      throw usageError(
        `${qaRoot} and ${userHome} share no directory but the filesystem root, so a single ` +
          'install cannot contain both',
        'point QA_ENGINEER_HOME somewhere inside your home directory',
      );
    }

    const qaRootRelative = toRelative(root, qaRoot);
    return Object.freeze({
      kind: 'global',
      // The transaction is confined here, and it contains both the owned directory and
      // the agent directories being linked into.
      root,
      qaRoot,
      qaRootRelative,
      userHome,
      lockfile: path.posix.join(qaRootRelative, LOCKFILE),
      shareEngine: true,
      userLevel: true,
      label: `global (${qaRoot})`,
      describe: () => `machine-wide install in ${qaRoot}`,
    });
  }

  if (workspace) {
    const found = findWorkspaceRoot(cwd);
    if (!found) {
      throw usageError(
        `no monorepo root found above ${path.resolve(cwd)} — looked for ` +
          `${WORKSPACE_MARKERS.map((m) => m.file).join(', ')}, and package.json with a "workspaces" field`,
        'run from inside the monorepo, or use --project <dir> to name the root explicitly',
      );
    }
    return Object.freeze({
      kind: 'workspace',
      root: found.root,
      qaRoot: path.join(found.root, QA_HOME_DIR_NAME),
      qaRootRelative: QA_HOME_DIR_NAME,
      lockfile: LOCKFILE,
      shareEngine: true,
      userLevel: false,
      workspaceKind: found.kind,
      label: `workspace (${found.root}, detected by ${found.marker})`,
      describe: () => `${found.kind} monorepo rooted at ${found.root}`,
    });
  }

  const root = path.resolve(project ?? cwd);
  return Object.freeze({
    kind: 'project',
    root,
    // No shared root: the engine travels inside each skill, as it always has.
    qaRoot: null,
    qaRootRelative: null,
    lockfile: LOCKFILE,
    shareEngine: false,
    userLevel: false,
    label: `project (${root})`,
    describe: () => `project install in ${root}`,
  });
}

/**
 * The scope an already-installed tree belongs to, for commands that operate on an
 * existing install rather than creating one.
 *
 * A lockfile records its own scope from 0.11 onward. One written by an earlier version
 * has no `scope` field and is a project install by definition, because that is the only
 * kind that existed — so the absence is read as `project` rather than as corruption.
 */
export function scopeOfLock(lock) {
  return lock?.scope?.kind ?? 'project';
}

/**
 * The scope a lifecycle command should act on when the user did not name one.
 *
 * `qa verify` with no flags should verify the install that is actually in play, and
 * which one that is depends on where you are standing. A project with its own lockfile
 * is the answer there; otherwise the machine-wide install is, because that is what is
 * serving this project. Making the user pass `--global` to check the only install they
 * have would be a tool asking a question it can answer itself.
 *
 * Project beats global deliberately, matching every layered tool a developer already
 * knows: a local `node_modules` beats a global one, `.git/config` beats `~/.gitconfig`.
 */
export function resolveOperatingScope({
  global: wantGlobal = false,
  workspace = false,
  project = null,
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  if (wantGlobal || workspace || project) {
    return resolveScope({ global: wantGlobal, workspace, project, cwd, env });
  }

  const here = path.resolve(cwd);
  if (fs.existsSync(path.join(here, LOCKFILE))) {
    return resolveScope({ project: here, cwd, env });
  }

  const globalScope = resolveScope({ global: true, cwd, env });
  if (fs.existsSync(path.join(globalScope.root, globalScope.lockfile))) return globalScope;

  // Nothing installed anywhere reachable. Return the project scope so the command
  // reports "no lockfile here", which is the honest and actionable message.
  return resolveScope({ project: here, cwd, env });
}
