#!/usr/bin/env node
// Capability-matrix consistency check.
//
// The pack keeps ONE canonical capability matrix (docs/capability-matrix.md).
// This script fails CI when any derived document drifts from it, so a capability
// claim can never quietly overstate what the code and tests support. It checks:
//
//   1. Framework support levels agree between the canonical matrix and the
//      detailed framework matrix (docs/compatibility/framework-matrix.md).
//   2. Every framework the matrices call "supported" (not Planning) has an
//      adapter directory on disk; every "Planning" framework has none.
//   3. Every user-facing command in the canonical matrix exists as a skill, and
//      every user-facing skill on disk appears in the canonical matrix.
//
// Deterministic, standard-library-only Node. Exit 0 = consistent, 1 = drift.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANONICAL = path.join(root, 'docs', 'capability-matrix.md');
const FRAMEWORK_MATRIX = path.join(root, 'docs', 'compatibility', 'framework-matrix.md');

// Skills that are model-only reference skills, not user-facing commands.
const NON_COMMAND_SKILLS = new Set(['qa-example']);

const problems = [];
const notes = [];

function read(file) {
  if (!fs.existsSync(file)) {
    problems.push(`missing required file: ${path.relative(root, file)}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

/** Split a markdown table row "| a | b |" into trimmed, unstyled cells. */
function cells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.replace(/\*\*/g, '').replace(/`/g, '').trim());
}

/** Rows of the first table whose header contains every string in `headerHas`. */
function tableRows(md, headerHas) {
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].trim().startsWith('|')) continue;
    const header = cells(lines[i]).map((c) => c.toLowerCase());
    if (!headerHas.every((h) => header.some((c) => c.includes(h.toLowerCase())))) continue;
    // Next line must be the separator row (---).
    if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) continue;
    const rows = [];
    for (let j = i + 2; j < lines.length && lines[j].trim().startsWith('|'); j += 1) {
      rows.push(cells(lines[j]));
    }
    return rows;
  }
  return null;
}

/** Canonical framework key from a display name ("Robot Framework" -> "robot"). */
function frameworkKey(name) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)[0];
}

const KNOWN_FRAMEWORKS = new Set(['playwright', 'selenium', 'cypress', 'webdriverio', 'robot', 'appium']);

/** framework key -> support level (lowercased last cell), for rows we recognize. */
function frameworkLevels(rows, source) {
  const map = new Map();
  if (!rows) {
    problems.push(`could not locate the framework table in ${source}`);
    return map;
  }
  for (const row of rows) {
    const key = frameworkKey(row[0]);
    if (!KNOWN_FRAMEWORKS.has(key)) continue;
    map.set(key, row[row.length - 1].toLowerCase());
  }
  return map;
}

const canonicalMd = read(CANONICAL);
const frameworkMd = read(FRAMEWORK_MATRIX);

// ---- Check 1: framework levels agree across the two matrices -----------------
const canonicalFw = frameworkLevels(tableRows(canonicalMd, ['Framework', 'Level']), 'capability-matrix.md');
const detailFw = frameworkLevels(tableRows(frameworkMd, ['Framework', 'Support level']), 'framework-matrix.md');

for (const [key, level] of canonicalFw) {
  if (!detailFw.has(key)) {
    problems.push(`framework "${key}" is in capability-matrix.md but missing from framework-matrix.md`);
    continue;
  }
  if (detailFw.get(key) !== level) {
    problems.push(
      `framework "${key}" level disagrees: capability-matrix.md="${level}" vs framework-matrix.md="${detailFw.get(key)}"`,
    );
  }
}
for (const key of detailFw.keys()) {
  if (!canonicalFw.has(key)) {
    problems.push(`framework "${key}" is in framework-matrix.md but missing from capability-matrix.md`);
  }
}

// ---- Check 2: "supported" frameworks have adapters; Planning ones do not -----
for (const [key, level] of canonicalFw) {
  if (key === 'robot' || key === 'appium') {
    // Planning frameworks may have a note dir but must be labelled planning.
    if (level !== 'planning') {
      problems.push(`framework "${key}" is expected to be "planning" but is "${level}"`);
    }
    continue;
  }
  // Adapter *code*, not an adapter directory. This used to test for the existence
  // of shared/frameworks/<key>/lib/, which an empty leftover directory satisfies —
  // and did, silently, after the adapters moved into the engine: the check passed
  // on a working tree holding nothing but __pycache__ and failed in a clean clone.
  // A directory proves nothing; a module that names the framework does.
  const hasAdapter = adapterModuleFor(key) !== null;
  if (level === 'planning' && hasAdapter) {
    notes.push(`framework "${key}" is labelled planning but has adapter code — consider promoting.`);
  }
  if (level !== 'planning' && !hasAdapter) {
    problems.push(
      `framework "${key}" is labelled "${level}" but no adapter implements it under ` +
        'packages/engine/lib/frameworks/',
    );
  }
}

/**
 * The engine module that implements this framework, or null.
 *
 * Playwright has its own adapter because a trace.zip is Playwright-specific. The
 * JUnit-XML frameworks share one module and declare themselves in its glob table,
 * so membership is read from the code rather than assumed from a path.
 */
function adapterModuleFor(key) {
  const frameworks = path.join(root, 'packages', 'engine', 'lib', 'frameworks');
  const dedicated = path.join(frameworks, `${key}.mjs`);
  if (fs.existsSync(dedicated)) return dedicated;

  const shared = path.join(frameworks, 'junit-frameworks.mjs');
  if (!fs.existsSync(shared)) return null;
  // Read the declared table rather than grepping for the bare name, so a framework
  // mentioned only in a comment does not count as implemented.
  const source = fs.readFileSync(shared, 'utf8');
  const table = source.match(/RESULT_GLOBS = \{([\s\S]*?)\n\};/);
  if (table && new RegExp(`^\\s*${key}:`, 'm').test(table[1])) return shared;
  return null;
}

// ---- Check 3: command surface matches the skills on disk ---------------------
const skillsDir = path.join(root, 'skills');
const skillDirs = fs
  .readdirSync(skillsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(skillsDir, d.name, 'SKILL.md')))
  .map((d) => d.name);
const userFacingSkills = skillDirs.filter((s) => !NON_COMMAND_SKILLS.has(s)).sort();

// Commands named in the canonical matrix (any `qa` / `qa-xxx` token in a table cell).
const matrixCommands = new Set();
for (const m of canonicalMd.matchAll(/`(qa(?:-[a-z]+)?)`/g)) {
  if (!NON_COMMAND_SKILLS.has(m[1])) matrixCommands.add(m[1]);
}

for (const skill of userFacingSkills) {
  if (!matrixCommands.has(skill)) {
    problems.push(`skill "${skill}" exists on disk but is not listed in capability-matrix.md`);
  }
}
for (const cmd of matrixCommands) {
  if (!userFacingSkills.includes(cmd)) {
    problems.push(`capability-matrix.md lists command "${cmd}" but there is no skills/${cmd}/SKILL.md`);
  }
}

// ---- Report -----------------------------------------------------------------
for (const n of notes) console.log(`note: ${n}`);

if (problems.length > 0) {
  console.error(`check-capability-matrix: ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(
  `check-capability-matrix: consistent (${canonicalFw.size} frameworks, ${userFacingSkills.length} user-facing commands)`,
);
