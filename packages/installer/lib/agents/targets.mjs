// Which agent directories an install writes to, for a given scope.
//
// Project installs keep the behaviour they always had: detect the hosts present in the
// repository and write to each unique discovery directory. Global installs cannot work
// that way — detection reads project markers, and there is no project — so they resolve
// against the table of user-level directories instead, and say plainly which hosts they
// could not serve.
//
// Keeping this out of `registry.mjs` matters: that file is the catalogue of *what hosts
// exist*, checked against their documentation. This file is the policy for *where to
// write*, which differs per scope. Mixing them is how the project-only assumption got
// baked into the catalogue in the first place.

import path from 'node:path';

import { resolveInstallTargets, getAgent, AGENTS, UNKNOWN_AGENT_ID } from './registry.mjs';
import { userSkillsDir, globalCapableAgents, projectOnlyAgents } from './user-level.mjs';

/**
 * Agent targets for a scope.
 *
 * A target is `{ id, name, tier, skillsDir, wrapperDir, wrapperFormat, detected, linkable }`
 * where `skillsDir` is relative to the scope root. For a global scope that root is the
 * user's home, so `.claude/skills` means `~/.claude/skills`.
 */
export function resolveScopeTargets(scope, { explicitIds = [], allAgents = false } = {}) {
  if (scope.kind !== 'global') {
    // Project and workspace both install into a directory tree the user controls, and
    // detection works there. Workspace simply detects at the monorepo root.
    return resolveInstallTargets(scope.root, explicitIds).map((agent) => ({
      ...agent,
      // A workspace shares its engine, so its skills can be linked; a project bundles.
      linkable: scope.shareEngine,
    }));
  }

  const wanted = allAgents
    ? globalCapableAgents()
    : explicitIds.length > 0
      ? explicitIds
      : globalCapableAgents();

  const targets = [];
  const seen = new Set();
  for (const id of wanted) {
    const agent = getAgent(id);
    if (!agent) throw new Error(`unknown agent id: ${id}`);
    const dir = userSkillsDir(id);
    // Requested explicitly but unserviceable: skipped here and reported by the caller,
    // rather than written to a path the host does not read.
    if (!dir || seen.has(dir)) continue;
    seen.add(dir);
    targets.push({
      ...agent,
      skillsDir: dir,
      // Wrappers are project-scoped by construction — a slash-command file lives beside
      // the repository it serves — so a global install writes none.
      wrapperFormat: null,
      wrapperDir: null,
      detected: false,
      requested: explicitIds.includes(id),
      linkable: true,
    });
  }

  return targets;
}

/**
 * Hosts a global install cannot serve, and why.
 *
 * Printed after a global install so the user learns it from the tool rather than from a
 * slash command that never appears. Silence here is the failure mode this exists to
 * prevent.
 */
export function describeUnservedAgents(scope, targets) {
  if (scope.kind !== 'global') return [];
  const served = new Set(targets.map((t) => t.id));
  return projectOnlyAgents().filter((entry) => !served.has(entry.id));
}

/** Every agent id the installer knows, for `--help` and validation. */
export function knownAgentIds() {
  return AGENTS.map((a) => a.id).filter((id) => id !== UNKNOWN_AGENT_ID);
}

/** Absolute path of an agent's skills directory within a scope. */
export function targetPath(scope, target) {
  return path.join(scope.root, target.skillsDir);
}
