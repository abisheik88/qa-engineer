// Where each agent looks for skills that belong to the *user* rather than to a project.
//
// This table is what makes a global install real. A machine-wide install is only useful
// if the agent actually reads the place we put things, and there is no shared convention
// — every host invented its own, and several have none at all.
//
// ## The rule this table follows
//
// A path appears here only when the host's own documentation says it reads it. Writing
// skills to a guessed path is the worst failure this installer can produce: the files
// are there, the install reports success, the agent never sees them, and the user
// concludes the tool is broken. That is strictly worse than saying "this host has no
// user-level path — install into the project", which is at least actionable.
//
// So `null` here is a real answer, carrying the reason. Adding a host later is one entry
// in this table and nothing else.

import path from 'node:path';

// Paths are relative to the user's home directory, POSIX-style, and joined with the
// platform separator at use. `os.homedir()` already resolves to %USERPROFILE% on Windows.
export const USER_LEVEL = Object.freeze({
  'claude-code': {
    dir: '.claude/skills',
    docs: 'https://code.claude.com/docs/en/skills',
    note: 'Personal skills, read in every project.',
  },
  antigravity: {
    dir: '.gemini/config/skills',
    docs: 'https://antigravity.google/docs/skills',
    note: 'Global skills directory, read alongside the workspace one.',
  },

  // No verified user-level skills directory. Each of these reads project-relative paths
  // only, as far as their documentation states. A project install serves them today; if
  // a host adds a user-level path, it becomes one entry above.
  cursor: { dir: null, reason: 'reads .agents/skills and .cursor/skills per project; no documented user-level path' },
  codex: { dir: null, reason: 'documents .agents/skills at cwd, parent, and repo root — all project-relative' },
  opencode: { dir: null, reason: 'documents per-project skills; ~/.config/opencode holds commands, not skills' },
  'gemini-cli': { dir: null, reason: 'no documented user-level skills path' },
  'github-copilot': { dir: null, reason: 'prompt files are repository-scoped' },
  kimi: { dir: null, reason: 'no documented user-level skills path' },
  'agent-skills': {
    dir: null,
    reason: 'the shared Agent Skills path is project-relative by specification; there is no user-level equivalent',
  },
});

/** The user-level skills directory for an agent, relative to home, or null. */
export function userSkillsDir(agentId) {
  return USER_LEVEL[agentId]?.dir ?? null;
}

/** Why an agent has no user-level directory, for an honest install report. */
export function userLevelReason(agentId) {
  return USER_LEVEL[agentId]?.reason ?? 'not a known agent';
}

/** Agent ids that can be served by a global install. */
export function globalCapableAgents() {
  return Object.keys(USER_LEVEL).filter((id) => USER_LEVEL[id].dir);
}

/** Agent ids that a global install cannot serve, with the reason for each. */
export function projectOnlyAgents() {
  return Object.keys(USER_LEVEL)
    .filter((id) => !USER_LEVEL[id].dir)
    .map((id) => ({ id, reason: USER_LEVEL[id].reason }));
}

/**
 * The home-relative path of one skill for one agent.
 *
 * Returned POSIX-style because it becomes a lockfile entry, and a lockfile written on
 * Windows has to be readable by the same installer on Linux.
 */
export function userSkillPath(agentId, skill) {
  const dir = userSkillsDir(agentId);
  return dir ? path.posix.join(dir, skill) : null;
}
