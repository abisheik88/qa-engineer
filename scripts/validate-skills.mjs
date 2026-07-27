#!/usr/bin/env node
// Validates every skill under skills/ against the pack's skill standard:
// docs/skills/skill-specification.md (frontmatter, body, prohibitions) and
// docs/skills/skill-anatomy.md (layout). Run: node scripts/validate-skills.mjs
// CI runs this on every pull request; exit code 1 means validation errors.

import fs from 'node:fs';
import path from 'node:path';
import { listSkillDirs, parseSkillMd, createReporter } from './lib/skills.mjs';

const NAME_PATTERN = /^qa(-[a-z0-9]+)*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const MATURITIES = new Set(['example', 'experimental', 'beta', 'stable']);
const AUDIENCES = new Set(['user', 'model']);
const ALLOWED_KEYS = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'argument-hint']);
const ALLOWED_META_KEYS = new Set(['version', 'maturity', 'audience', 'deprecated']);
const ALLOWED_ENTRIES = new Set(['SKILL.md', 'README.md', 'references', 'contracts', 'examples', 'scripts', 'templates', 'tests']);
const USER_SECTIONS = ['Purpose', 'Inputs', 'Context loading', 'Procedure', 'Guardrails', 'Output'];
const ENVELOPE_REQUIRED = ['contract', 'skill', 'generatedAt', 'summary', 'classification', 'evidence'];

// Each entry: [regex, explanation]. Patterns are assembled from fragments so
// this file does not itself trip a naive text scan.
const FORBIDDEN = [
  [new RegExp('\\$' + 'ARGUMENTS'), 'argument placeholder token (portable phrasing: "the user\'s request follows in the conversation")'],
  [new RegExp('\\{' + '\\{'), 'unreplaced template token or brace placeholder'],
  [new RegExp('!' + '`'), 'shell-injection syntax (single-agent feature; breaks other agents)'],
];

const DESCRIPTION_BUDGET_TOTAL = 6000;
const DESCRIPTION_BUDGET_WARN = 4500;
const DESCRIPTION_MAX = 1024;
const DESCRIPTION_RECOMMENDED = 500;
const BODY_MAX_LINES = 500;
const BODY_WARN_LINES = 400;

const report = createReporter();
const skillDirs = listSkillDirs();
let totalDescriptionChars = 0;

const linkPattern = /\[[^\]]*\]\(([^)\s]+)\)/g;

function checkForbidden(file, text) {
  for (const [pattern, why] of FORBIDDEN) {
    if (pattern.test(text)) report.error(file, `forbidden content: ${why}`);
  }
}

for (const dir of skillDirs) {
  const skillName = path.basename(dir);
  const skillFile = path.join(dir, 'SKILL.md');

  // --- Layout ---
  for (const required of ['SKILL.md', 'README.md']) {
    if (!fs.existsSync(path.join(dir, required))) report.error(dir, `missing required file: ${required}`);
  }
  for (const entry of fs.readdirSync(dir)) {
    if (!ALLOWED_ENTRIES.has(entry)) {
      report.error(path.join(dir, entry), 'not part of the canonical skill layout (see docs/skills/skill-anatomy.md)');
      continue;
    }
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory() && fs.readdirSync(full).length === 0) {
      report.error(full, 'empty directory — "as needed" directories exist only with content');
    }
  }
  const referencesDir = path.join(dir, 'references');
  if (fs.existsSync(referencesDir)) {
    for (const entry of fs.readdirSync(referencesDir)) {
      if (fs.statSync(path.join(referencesDir, entry)).isDirectory()) {
        report.error(path.join(referencesDir, entry), 'references/ must not contain subdirectories (one level deep)');
      }
    }
  }
  if (!fs.existsSync(skillFile)) continue;

  // --- Frontmatter ---
  const text = fs.readFileSync(skillFile, 'utf8');
  const parsed = parseSkillMd(text);
  if (parsed.error) {
    report.error(skillFile, parsed.error);
    continue;
  }
  const { data, body } = parsed;
  const meta = data.metadata ?? {};

  for (const key of Object.keys(data)) {
    if (!ALLOWED_KEYS.has(key)) report.error(skillFile, `unknown frontmatter key "${key}"`);
  }
  for (const key of Object.keys(meta)) {
    if (!ALLOWED_META_KEYS.has(key)) report.error(skillFile, `unknown metadata key "${key}"`);
  }

  if (!data.name) report.error(skillFile, 'missing required field: name');
  else {
    if (data.name !== skillName) report.error(skillFile, `name "${data.name}" does not match directory "${skillName}"`);
    if (!NAME_PATTERN.test(data.name)) report.error(skillFile, `name "${data.name}" must match ${NAME_PATTERN}`);
    if (data.name.length > 64) report.error(skillFile, 'name exceeds 64 characters');
  }

  if (!data.description) report.error(skillFile, 'missing required field: description');
  else {
    totalDescriptionChars += data.description.length;
    if (data.description.length > DESCRIPTION_MAX) {
      report.error(skillFile, `description is ${data.description.length} chars (max ${DESCRIPTION_MAX})`);
    } else if (data.description.length > DESCRIPTION_RECOMMENDED) {
      report.warn(skillFile, `description is ${data.description.length} chars (recommended ≤ ${DESCRIPTION_RECOMMENDED})`);
    }
    if (!/\bUse when\b/.test(data.description)) {
      report.warn(skillFile, 'description has no "Use when..." sentence — activation will suffer');
    }
  }

  if (data.license !== 'MIT') report.error(skillFile, `license must be exactly "MIT" (got "${data.license ?? ''}")`);
  if (!meta.version) report.error(skillFile, 'missing metadata.version');
  else if (!SEMVER_PATTERN.test(meta.version)) report.error(skillFile, `metadata.version "${meta.version}" is not a semantic version`);
  if (!MATURITIES.has(meta.maturity)) report.error(skillFile, `metadata.maturity must be one of: ${[...MATURITIES].join(', ')}`);
  if (!AUDIENCES.has(meta.audience)) report.error(skillFile, `metadata.audience must be "user" or "model"`);
  if (meta.deprecated && !/^replaced-by:qa(-[a-z0-9]+)*$/.test(meta.deprecated)) {
    report.error(skillFile, 'metadata.deprecated must be "replaced-by:<skill-name>"');
  }

  // --- Body ---
  const bodyLines = body.split('\n').length;
  if (bodyLines > BODY_MAX_LINES) report.error(skillFile, `body is ${bodyLines} lines (max ${BODY_MAX_LINES})`);
  else if (bodyLines > BODY_WARN_LINES) report.warn(skillFile, `body is ${bodyLines} lines (budget ${BODY_MAX_LINES}; consider references/)`);

  const requiredSections = meta.audience === 'user' ? USER_SECTIONS : ['Purpose'];
  for (const section of requiredSections) {
    if (!new RegExp(`^## ${section}$`, 'm').test(body)) {
      report.error(skillFile, `missing required section "## ${section}"`);
    }
  }

  // --- Prohibitions (SKILL.md body + references) ---
  checkForbidden(skillFile, body);
  if (fs.existsSync(referencesDir)) {
    for (const entry of fs.readdirSync(referencesDir)) {
      const refFile = path.join(referencesDir, entry);
      if (fs.statSync(refFile).isFile()) checkForbidden(refFile, fs.readFileSync(refFile, 'utf8'));
    }
  }
  // Unreplaced template tokens anywhere else in the skill.
  for (const entry of ['README.md', 'examples']) {
    const full = path.join(dir, entry);
    if (!fs.existsSync(full)) continue;
    const files = fs.statSync(full).isDirectory() ? fs.readdirSync(full).map((f) => path.join(full, f)) : [full];
    for (const file of files) {
      if (fs.statSync(file).isFile() && /\{\{/.test(fs.readFileSync(file, 'utf8'))) {
        report.error(file, 'unreplaced template token');
      }
    }
  }

  // --- Links: relative targets must exist, stay inside the skill, one level deep ---
  const referencedTargets = new Set();
  for (const match of body.matchAll(linkPattern)) {
    const target = match[1];
    if (/^[a-z]+:/.test(target) || target.startsWith('#')) continue;
    const clean = target.split('#')[0];
    if (clean.includes('..')) {
      report.error(skillFile, `link "${target}" escapes the skill directory`);
      continue;
    }
    if (!fs.existsSync(path.join(dir, clean))) report.error(skillFile, `link target does not exist: ${target}`);
    // references/ is one level deep by spec; templates/ and scripts/ may nest.
    if (clean.startsWith('references/') && clean.replace(/\/$/, '').split('/').length > 2) {
      report.error(skillFile, `reference link "${target}" nests deeper than one level`);
    }
    referencedTargets.add(clean);
  }
  if (fs.existsSync(referencesDir)) {
    for (const entry of fs.readdirSync(referencesDir)) {
      const refFile = path.join(referencesDir, entry);
      if (!referencedTargets.has(`references/${entry}`)) {
        report.warn(refFile, 'not referenced from SKILL.md — unreachable knowledge');
      }
      // Reference files must be self-contained: no link may escape the skill.
      if (fs.statSync(refFile).isFile() && entry.endsWith('.md')) {
        for (const match of fs.readFileSync(refFile, 'utf8').matchAll(linkPattern)) {
          const target = match[1];
          if (/^[a-z]+:/.test(target) || target.startsWith('#')) continue;
          if (target.split('#')[0].includes('..')) {
            report.error(refFile, `link "${target}" escapes the skill directory (references must be self-contained)`);
          }
        }
      }
    }
  }

  // --- Contracts: valid JSON, standard envelope ---
  const contractsDir = path.join(dir, 'contracts');
  if (fs.existsSync(contractsDir)) {
    for (const entry of fs.readdirSync(contractsDir)) {
      const contractFile = path.join(contractsDir, entry);
      if (!entry.endsWith('.schema.json')) {
        report.error(contractFile, 'contracts/ may only contain <name>.schema.json files');
        continue;
      }
      let schema;
      try {
        schema = JSON.parse(fs.readFileSync(contractFile, 'utf8'));
      } catch (parseError) {
        report.error(contractFile, `invalid JSON: ${parseError.message}`);
        continue;
      }
      for (const field of ENVELOPE_REQUIRED) {
        if (!Array.isArray(schema.required) || !schema.required.includes(field)) {
          report.error(contractFile, `envelope field "${field}" missing from "required" (see docs/skills/output-contracts.md)`);
        }
      }
      const idPattern = new RegExp(`^urn:qa-pack:contract:${skillName}:[a-z0-9-]+:\\d+$`);
      if (!idPattern.test(schema.$id ?? '')) {
        report.error(contractFile, `$id must match urn:qa-pack:contract:${skillName}:<contract-name>:<major>`);
      }
    }
  }

  // --- Synced copies point at real sources (content drift is sync-shared's job) ---
  if (fs.existsSync(referencesDir)) {
    for (const entry of fs.readdirSync(referencesDir)) {
      const refFile = path.join(referencesDir, entry);
      if (!fs.statSync(refFile).isFile()) continue;
      const firstLine = fs.readFileSync(refFile, 'utf8').split('\n', 1)[0];
      const marker = firstLine.match(/^<!-- synced-from: (shared\/\S+)/);
      if (marker && !fs.existsSync(marker[1])) {
        report.error(refFile, `synced-from source does not exist: ${marker[1]}`);
      }
    }
  }
}

// --- Pack-wide description budget ---
if (totalDescriptionChars > DESCRIPTION_BUDGET_TOTAL) {
  report.error('skills/', `total description budget exceeded: ${totalDescriptionChars} chars (max ${DESCRIPTION_BUDGET_TOTAL})`);
} else if (totalDescriptionChars > DESCRIPTION_BUDGET_WARN) {
  report.warn('skills/', `total descriptions at ${totalDescriptionChars} chars (budget ${DESCRIPTION_BUDGET_TOTAL})`);
}

const { errors, warnings } = report.summary();
console.log(`\nvalidate-skills: ${skillDirs.length} skill(s), ${errors} error(s), ${warnings} warning(s), description budget ${totalDescriptionChars}/${DESCRIPTION_BUDGET_TOTAL}`);
process.exit(errors > 0 ? 1 : 0);
