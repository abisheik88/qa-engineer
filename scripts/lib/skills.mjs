// Shared helpers for the repository's skill tooling.
// Zero dependencies; Node.js 18+. Consumed by validate-skills.mjs and
// check-keywords.mjs — not shipped to users.

import fs from 'node:fs';
import path from 'node:path';

export const SKILLS_DIR = 'skills';

/** Directories under skills/ (each one a skill). */
export function listSkillDirs(root = '.') {
  const base = path.join(root, SKILLS_DIR);
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(base, e.name))
    .sort();
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Parse the restricted YAML subset the skill specification allows:
 * plain scalars, ">-"/">" folded blocks, and one flat map ("metadata:").
 * Returns { data, body } or { error }.
 */
export function parseSkillMd(text) {
  const lines = text.split('\n');
  if (lines[0] !== '---') return { error: 'frontmatter must open with "---" on line 1' };
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return { error: 'frontmatter closing "---" not found' };

  const data = {};
  let i = 1;
  while (i < end) {
    const line = lines[i];
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    const top = line.match(/^([A-Za-z][A-Za-z0-9-]*):(?:[ \t]+(.*))?$/);
    if (!top) return { error: `unparseable frontmatter line ${i + 1}: "${line}"` };
    const key = top[1];
    const raw = (top[2] ?? '').trim();
    i += 1;

    if (raw === '>-' || raw === '>') {
      const parts = [];
      while (i < end && (lines[i].startsWith('  ') || lines[i].trim() === '')) {
        if (lines[i].trim() !== '') parts.push(lines[i].trim());
        i += 1;
      }
      data[key] = parts.join(' ');
    } else if (raw === '' && key === 'metadata') {
      const meta = {};
      while (i < end) {
        const sub = lines[i].match(/^ {2}([A-Za-z][A-Za-z0-9-]*):[ \t]+(.*)$/);
        if (!sub) break;
        meta[sub[1]] = stripQuotes(sub[2].trim());
        i += 1;
      }
      data.metadata = meta;
    } else if (raw === '') {
      return { error: `frontmatter key "${key}" has no value (only "metadata" may open a map)` };
    } else {
      data[key] = stripQuotes(raw);
    }
  }

  return { data, body: lines.slice(end + 1).join('\n') };
}

/** Issue collector with GitHub Actions annotation output. */
export function createReporter() {
  const issues = [];
  const annotate = process.env.GITHUB_ACTIONS === 'true';
  return {
    error(file, message) {
      issues.push({ level: 'error', file, message });
      if (annotate) console.log(`::error file=${file}::${message}`);
    },
    warn(file, message) {
      issues.push({ level: 'warning', file, message });
      if (annotate) console.log(`::warning file=${file}::${message}`);
    },
    summary() {
      for (const issue of issues) {
        console.log(`${issue.level.toUpperCase().padEnd(7)} ${issue.file}: ${issue.message}`);
      }
      const errors = issues.filter((x) => x.level === 'error').length;
      const warnings = issues.filter((x) => x.level === 'warning').length;
      return { errors, warnings };
    },
  };
}
