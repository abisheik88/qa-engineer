// Turning a scope into a list of files and links to create.
//
// The planner was inline in `install.mjs` and knew exactly one arrangement: copy every
// skill, with the engine bundled inside it, into every agent directory. That produced
// eighteen copies of the engine for a single install — nine bundling skills times the
// two discovery directories the installer writes — and there was nowhere to put a
// different arrangement without an `if` in the middle of the transaction.
//
// So planning is separated from executing. A scope describes *what sharing is possible*;
// this module turns that into a concrete plan; `install.mjs` commits it. The three modes
// then differ in data rather than in control flow, which is what makes a fourth mode a
// table entry instead of a branch.
//
// ## The two plans
//
//   bundled  (project)   every skill carries its own engine — unchanged, and still the
//                        right answer for a repository that must work on a machine where
//                        nothing else is installed
//   shared   (global,    one engine and one canonical skill tree in the scope's qaRoot;
//             workspace) agents reach them by link, or by copy where a link cannot be made

import fs from 'node:fs';
import path from 'node:path';

import { SHARED_ENGINE_DIR, SHARED_SKILLS_STORE } from '../constants.mjs';
import { toPosix, listFilesRelative } from './paths.mjs';
import { listSkills, skillFiles, ENGINE_SOURCE } from './manifest.mjs';
import { bundleFilesForSkill } from './bundle.mjs';
import { hashBytes, hashString } from './hash.mjs';
import { readSkillMeta } from './skill-meta.mjs';
import { renderWrapper } from './wrappers.mjs';

/** A skill file that is never installed: tests are development-only. */
function isDevelopmentFile(rel) {
  return rel.startsWith('tests/') || rel.includes('/tests/');
}

/**
 * Files for the shared engine, at `<qaRoot>/engine/`.
 *
 * One copy. The launcher finds it by walking up for `.qa-engineer/engine`, so no skill
 * needs to be told where it went.
 */
function planSharedEngine(sourceRoot, qaRootRelative) {
  const engineRoot = path.join(sourceRoot, ENGINE_SOURCE);
  const entries = [];
  for (const rel of listFilesRelative(engineRoot)) {
    if (rel.startsWith('test/') || rel === 'package.json') continue;
    const content = fs.readFileSync(path.join(engineRoot, rel));
    entries.push({
      path: toPosix(path.join(qaRootRelative, SHARED_ENGINE_DIR, rel)),
      sha256: hashBytes(content),
      bytes: content.length,
      owner: 'engine',
      content,
    });
  }
  return entries;
}

/** The canonical skill tree at `<qaRoot>/skills/`, with no engine inside it. */
function planSkillStore(sourceRoot, skills, qaRootRelative) {
  const entries = [];
  for (const skill of skills) {
    for (const rel of skillFiles(sourceRoot, skill)) {
      if (isDevelopmentFile(rel)) continue;
      const content = fs.readFileSync(path.join(sourceRoot, 'skills', skill, rel));
      entries.push({
        path: toPosix(path.join(qaRootRelative, SHARED_SKILLS_STORE, skill, rel)),
        sha256: hashBytes(content),
        bytes: content.length,
        owner: 'skill',
        skill,
        content,
      });
    }
  }
  return entries;
}

/** Skill files copied into one agent directory, optionally with the engine bundled. */
function planSkillCopies(sourceRoot, skills, skillsDir, agentId, { bundleEngine }) {
  const entries = [];
  for (const skill of skills) {
    for (const rel of skillFiles(sourceRoot, skill)) {
      if (isDevelopmentFile(rel)) continue;
      const content = fs.readFileSync(path.join(sourceRoot, 'skills', skill, rel));
      entries.push({
        path: toPosix(path.join(skillsDir, skill, rel)),
        sha256: hashBytes(content),
        bytes: content.length,
        owner: 'skill',
        skill,
        agent: agentId,
        content,
      });
    }
    if (!bundleEngine) continue;
    for (const bundled of bundleFilesForSkill(sourceRoot, skill)) {
      entries.push({
        path: toPosix(path.join(skillsDir, skill, bundled.rel)),
        sha256: hashBytes(bundled.content),
        bytes: bundled.content.length,
        owner: 'skill',
        skill,
        agent: agentId,
        content: bundled.content,
      });
    }
  }
  return entries;
}

/** Slash-command wrappers, for the agents that need one to expose a skill. */
function planWrappers(sourceRoot, skills, agent) {
  if (!agent.wrapperFormat || !agent.wrapperDir) return [];
  const entries = [];
  for (const skill of skills) {
    const meta = readSkillMeta(path.join(sourceRoot, 'skills', skill, 'SKILL.md'));
    if (!meta.name) continue;
    const { filename, content } = renderWrapper(agent.wrapperFormat, meta);
    const buffer = Buffer.from(content, 'utf8');
    entries.push({
      path: toPosix(path.join(agent.wrapperDir, filename)),
      sha256: hashBytes(buffer),
      bytes: buffer.length,
      owner: 'wrapper',
      skill,
      agent: agent.id,
      content: buffer,
    });
  }
  return entries;
}

/**
 * One link per skill, from an agent's directory to the canonical tree.
 *
 * The lockfile needs a hash for every entry, and a link has no content to hash — so the
 * hash is of the target path. That is not a formality: it makes `verify` able to catch a
 * link that still exists but now points somewhere else, which is exactly what happens
 * when a second tool claims the same directory.
 */
function planLinks(skills, skillsDir, agentId, qaRoot, root) {
  return skills.map((skill) => {
    const target = path.join(qaRoot, SHARED_SKILLS_STORE, skill);
    const rel = toPosix(path.join(skillsDir, skill));
    return {
      path: rel,
      sha256: hashString(toPosix(path.relative(root, target))),
      bytes: 0,
      owner: 'link',
      skill,
      agent: agentId,
      linkTarget: target,
    };
  });
}

/**
 * Build the full plan for a scope.
 *
 * `targets` are agent definitions already resolved for this scope, each carrying the
 * scope-relative `skillsDir` it wants and whether it can be served by a link.
 */
export function buildPlan({ sourceRoot, scope, targets, preferLinks = true }) {
  const skills = listSkills(sourceRoot);
  const files = [];
  const links = [];

  if (scope.shareEngine) {
    files.push(...planSharedEngine(sourceRoot, scope.qaRootRelative));
    files.push(...planSkillStore(sourceRoot, skills, scope.qaRootRelative));
  }

  for (const agent of targets) {
    if (scope.shareEngine && preferLinks && agent.linkable !== false) {
      links.push(...planLinks(skills, agent.skillsDir, agent.id, scope.qaRoot, scope.root));
    } else {
      files.push(
        ...planSkillCopies(sourceRoot, skills, agent.skillsDir, agent.id, {
          // A copied skill needs its own engine only when nothing is shared; with a
          // shared engine present the launcher finds it by walking up.
          bundleEngine: !scope.shareEngine,
        }),
      );
    }
    files.push(...planWrappers(sourceRoot, skills, agent));
  }

  return { skills, files, links };
}

/**
 * Collapse duplicate destinations, refusing any that disagree about content.
 *
 * Two agents can name the same directory — Cursor and Codex both read `.agents/skills` —
 * and writing it twice is wasted work. Two *different* contents for one path is a
 * planning bug, and failing loudly beats letting whichever ran last win.
 */
export function dedupePlan(entries) {
  const byPath = new Map();
  const conflicts = [];
  for (const entry of entries) {
    const previous = byPath.get(entry.path);
    if (!previous) {
      byPath.set(entry.path, entry);
      continue;
    }
    if (previous.sha256 !== entry.sha256) conflicts.push(entry.path);
  }
  return { unique: [...byPath.values()], conflicts };
}
