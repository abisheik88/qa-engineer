// Known Agent Skills hosts the installer can target. Detection is best-effort
// from project markers; users can override with qa.config.json "agents" or
// `qa install --agent <id>`.

import fs from 'node:fs';
import path from 'node:path';
import { SHARED_SKILLS_DIR, CLAUDE_SKILLS_DIR } from '../constants.mjs';

/**
 * @typedef {object} AgentDef
 * @property {string} id
 * @property {string} name
 * @property {number} tier
 * @property {string} skillsDir  project-relative skills discovery path
 * @property {string|null} wrapperFormat  wrappers.mjs renderer key, or null
 * @property {string|null} wrapperDir  where wrappers are written, or null
 * @property {readonly string[]} discovery  every project path this host reads skills from
 * @property {string} docs  the primary documentation the discovery list was read from
 * @property {string} invoke  how a user reaches a skill in this host, in their words
 * @property {(root:string)=>boolean} detect
 */

// `discovery` is what makes an install correct rather than hopeful: writing skills
// to a path the host does not read produces a silent no-op — the files are there,
// the agent never sees them, and the user concludes the pack does not work. Each
// list below was read off that host's own documentation on 2026-07-28 (`docs`), and
// a test asserts `skillsDir` is a member of it. See COMPATIBILITY.md.

/** @type {AgentDef[]} */
export const AGENTS = Object.freeze([
  {
    id: 'claude-code',
    name: 'Claude Code',
    tier: 1,
    skillsDir: CLAUDE_SKILLS_DIR,
    wrapperFormat: null,
    wrapperDir: null,
    discovery: Object.freeze(['.claude/skills']),
    docs: 'https://code.claude.com/docs/en/skills',
    invoke: 'type /qa-explore, or just describe the task — skills auto-activate',
    detect: (root) =>
      fs.existsSync(path.join(root, '.claude')) ||
      fs.existsSync(path.join(root, 'CLAUDE.md')),
  },
  {
    id: 'cursor',
    name: 'Cursor',
    tier: 2,
    skillsDir: SHARED_SKILLS_DIR,
    // Cursor reads both, and additionally loads Claude and Codex directories.
    discovery: Object.freeze(['.agents/skills', '.cursor/skills']),
    docs: 'https://cursor.com/docs/skills',
    invoke: 'type / in Agent chat and pick qa-explore',
    wrapperFormat: null,
    wrapperDir: null,
    detect: (root) =>
      fs.existsSync(path.join(root, '.cursor')) ||
      fs.existsSync(path.join(root, '.cursorrules')),
  },
  {
    id: 'codex',
    name: 'OpenAI Codex CLI',
    tier: 1,
    skillsDir: SHARED_SKILLS_DIR,
    // Codex documents `.agents/skills` exclusively — at the cwd, the parent, and
    // the repository root. There is no `.codex/skills`, so `.codex/` is only ever
    // a detection marker here, never a target.
    discovery: Object.freeze(['.agents/skills']),
    docs: 'https://developers.openai.com/codex/skills',
    invoke: 'type $qa-explore, or /skills to browse them',
    wrapperFormat: null,
    wrapperDir: null,
    detect: (root) =>
      fs.existsSync(path.join(root, '.codex')) ||
      fs.existsSync(path.join(root, 'AGENTS.md')),
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    tier: 1,
    skillsDir: SHARED_SKILLS_DIR,
    discovery: Object.freeze(['.agents/skills', '.opencode/skills', '.claude/skills']),
    docs: 'https://opencode.ai/docs/skills/',
    invoke: 'type /qa-explore, or describe the task — the agent loads skills itself',
    wrapperFormat: 'command-md',
    // Plural, per https://opencode.ai/docs/commands/ — global is
    // ~/.config/opencode/commands/, per-project .opencode/commands/.
    wrapperDir: '.opencode/commands',
    detect: (root) => fs.existsSync(path.join(root, '.opencode')),
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    tier: 2,
    skillsDir: SHARED_SKILLS_DIR,
    discovery: Object.freeze(['.agents/skills', '.gemini/skills']),
    docs: 'https://google-gemini.github.io/gemini-cli/',
    invoke: 'type /qa-explore (generated command), or describe the task',
    wrapperFormat: 'command-toml',
    wrapperDir: '.gemini/commands',
    detect: (root) => fs.existsSync(path.join(root, '.gemini')),
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    tier: 2,
    skillsDir: SHARED_SKILLS_DIR,
    discovery: Object.freeze(['.agents/skills', '.github/skills']),
    docs: 'https://docs.github.com/en/copilot',
    invoke: 'type /qa-explore in Copilot Chat (generated prompt file)',
    wrapperFormat: 'prompt-md',
    wrapperDir: '.github/prompts',
    // Detected by a Copilot-specific marker, not by `.github/` — almost every
    // repository has `.github/` for Actions or issue templates, so keying on it
    // reported Copilot for projects that do not use it and wrote 13 wrapper
    // files nobody asked for. Request them with `--agent github-copilot`.
    detect: (root) =>
      fs.existsSync(path.join(root, '.github', 'copilot-instructions.md')) ||
      fs.existsSync(path.join(root, '.github', 'prompts')),
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    tier: 2,
    skillsDir: SHARED_SKILLS_DIR,
    // Antigravity defaults to `.agents/skills` at the workspace root, with
    // backward support for `.agent/skills`; global skills live under
    // ~/.gemini/config/skills. So the pack's default install path is already the
    // one it reads — detection below only governs the optional workflow wrappers.
    discovery: Object.freeze(['.agents/skills', '.agent/skills']),
    docs: 'https://antigravity.google/docs/skills',
    invoke: 'describe the task — skills auto-activate; workflows give slash commands',
    wrapperFormat: 'workflow-md',
    wrapperDir: '.agents/workflows',
    // Detected by its own configuration directory, NOT by `.agents/`.
    // `.agents/skills/` is the shared Agent Skills path that this installer
    // creates for every host, so keying on `.agents/` made the installer detect
    // Antigravity purely because it had run once before: a second `install`
    // silently added 13 wrapper files and reported a host that was never really
    // there. Detection must never treat the pack's own footprint as evidence.
    // Request the wrappers explicitly with `--agent antigravity`.
    detect: (root) => fs.existsSync(path.join(root, '.antigravity')),
  },
  {
    id: 'kimi',
    name: 'Kimi (Agent Skills copy)',
    tier: 2,
    skillsDir: SHARED_SKILLS_DIR,
    discovery: Object.freeze(['.agents/skills']),
    docs: 'https://agentskills.io/specification',
    invoke: 'describe the task, or use the product\'s own slash surface',
    wrapperFormat: null,
    wrapperDir: null,
    detect: () => false,
  },
  {
    // The honest fallback when no agent marker is present. Installing into the
    // shared Agent Skills path is right for any spec-compliant host, but naming
    // a specific product would report a detection that never happened — so this
    // entry says exactly what is known: nothing, beyond the standard path.
    id: 'agent-skills',
    name: 'Unknown agent (shared Agent Skills path)',
    tier: null,
    skillsDir: SHARED_SKILLS_DIR,
    discovery: Object.freeze(['.agents/skills']),
    docs: 'https://agentskills.io/specification',
    invoke: 'describe the task; most hosts also expose skills on /',
    wrapperFormat: null,
    wrapperDir: null,
    detected: false,
    detect: () => false,
  },
]);

/** The id used when nothing could be detected. */
export const UNKNOWN_AGENT_ID = 'agent-skills';

const BY_ID = new Map(AGENTS.map((a) => [a.id, a]));

export function getAgent(id) {
  return BY_ID.get(id) ?? null;
}

export function listAgentIds() {
  return AGENTS.map((a) => a.id);
}

/**
 * Resolve which agents to install for. Explicit ids win; otherwise detect; if
 * nothing is detected, install once into the shared `.agents/skills` path under
 * the honest "Unknown agent" entry rather than naming a product that was never
 * detected. The install location is identical either way — only the report
 * differs, and a lockfile that claims a detection that did not happen is a
 * small lie the pack cannot afford.
 */
export function resolveAgents(projectRoot, explicitIds = []) {
  if (explicitIds.length > 0) {
    const resolved = [];
    for (const id of explicitIds) {
      const agent = getAgent(id);
      if (!agent) throw new Error(`unknown agent id: ${id}`);
      resolved.push({ ...agent, detected: false, requested: true });
    }
    return dedupeBySkillsDir(resolved);
  }

  const detected = AGENTS.filter((a) => a.detect(projectRoot));
  if (detected.length > 0) {
    return dedupeBySkillsDir(detected.map((a) => ({ ...a, detected: true })));
  }

  // Nothing detected. The shared Agent Skills path still serves Cursor, Codex,
  // Copilot, OpenCode, Gemini, Antigravity, Kimi, and peers that read it.
  return [{ ...getAgent(UNKNOWN_AGENT_ID), detected: false }];
}

/** Prefer one install per unique skillsDir (avoid duplicating files). */
function dedupeBySkillsDir(agents) {
  const seen = new Set();
  const out = [];
  for (const agent of agents) {
    if (seen.has(agent.skillsDir)) continue;
    seen.add(agent.skillsDir);
    out.push(agent);
  }
  // Claude Code always needs its own directory in addition to .agents/skills
  // when both are requested — restore claude if it was collapsed away incorrectly.
  const wantsClaude = agents.some((a) => a.id === 'claude-code');
  if (wantsClaude && !out.some((a) => a.id === 'claude-code')) {
    out.push(getAgent('claude-code'));
  }
  return out;
}

/**
 * When installing for "all common hosts", copy into both canonical dirs.
 */
export function resolveInstallTargets(projectRoot, explicitIds = []) {
  const agents = resolveAgents(projectRoot, explicitIds);
  const hasClaude = agents.some((a) => a.id === 'claude-code');
  const hasShared = agents.some((a) => a.skillsDir === SHARED_SKILLS_DIR);

  // If only Claude was detected, still install the shared path so other tools
  // work — but attribute it to the unknown-agent entry, because no host that
  // reads .agents/skills/ was actually detected here.
  // If only shared was detected, also install Claude when .claude exists.
  const targets = [...agents];
  if (hasClaude && !hasShared) {
    targets.push({ ...getAgent(UNKNOWN_AGENT_ID), detected: false });
  }
  if (hasShared && fs.existsSync(path.join(projectRoot, '.claude')) && !hasClaude) {
    targets.push({ ...getAgent('claude-code'), detected: true });
  }
  return dedupeBySkillsDir(targets);
}
