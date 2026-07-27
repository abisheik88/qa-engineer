#!/usr/bin/env node
// Architecture fitness tests — fail CI on architectural drift.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFrameworks } from '../shared/frameworks/registry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

// Required architecture constitution documents
const requiredDocs = [
  'docs/architecture/ENGINEERING_PRINCIPLES.md',
  'docs/architecture/deterministic-execution-boundary.md',
  'docs/architecture/ADR-0014-evaluation-platform.md',
  'docs/engineering-principles.md',
  'shared/frameworks/registry.json',
  'shared/diagnostics/schemas/internal/diagnosis.schema.json',
];
for (const rel of requiredDocs) {
  if (!exists(rel)) problems.push(`missing required architecture artifact: ${rel}`);
}

// ENGINEERING_PRINCIPLES must state core invariants
if (exists('docs/architecture/ENGINEERING_PRINCIPLES.md')) {
  const text = read('docs/architecture/ENGINEERING_PRINCIPLES.md');
  for (const needle of [
    'Evidence is immutable',
    'Evaluation never mutates evidence',
    'Deterministic code owns facts',
    'LLM owns reasoning',
  ]) {
    if (!text.includes(needle)) problems.push(`ENGINEERING_PRINCIPLES.md missing: ${needle}`);
  }
}

// No reserved-but-empty knowledge directories (ADR-0015). A directory under
// shared/ that holds only a README is a promise the repository is not keeping:
// shared/ci/ and shared/stacks/ sat that way from M1 until they were removed.
const sharedDir = path.join(root, 'shared');
for (const entry of fs.readdirSync(sharedDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = path.join(sharedDir, entry.name);
  const files = fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((f) => f.isFile())
    .map((f) => f.name);
  const substantive = files.filter((name) => name.toLowerCase() !== 'readme.md');
  if (substantive.length === 0) {
    problems.push(
      `shared/${entry.name}/ contains only a README — knowledge directories exist ` +
        'only when they hold knowledge a skill loads (ADR-0015)',
    );
  }
}

// Framework registry is sole source — installer detector must import it
const detector = read('packages/installer/lib/detect/frameworks.mjs');
if (!detector.includes('shared/frameworks/registry')) {
  problems.push('frameworks.mjs must derive detection from shared/frameworks/registry');
}

// No hard-coded Production framework list outside registry in detector
if (/supportLevel:\s*['"]Production['"]/.test(detector)) {
  problems.push('frameworks.mjs must not hard-code support levels');
}

// Skills must not import sibling skill paths (ADR-0002 / composition)
const skillsDir = path.join(root, 'skills');
for (const skill of fs.readdirSync(skillsDir)) {
  const skillMd = path.join(skillsDir, skill, 'SKILL.md');
  if (!fs.existsSync(skillMd)) continue;
  const body = fs.readFileSync(skillMd, 'utf8');
  if (/skills\/qa-[a-z]+\/SKILL\.md/.test(body) && !body.includes('synced-from')) {
    // Allow mentioning other skills by command name; forbid relative sibling file loads.
  }
  if (/\.\.\/qa-[a-z]+\//.test(body)) {
    problems.push(`${skill}/SKILL.md references sibling skill paths`);
  }
}

// Every user-facing skill either has eval coverage or is listed in exemptions
const exemptionsPath = path.join(root, 'tests/evals/coverage-exemptions.json');
const exemptions = exists('tests/evals/coverage-exemptions.json')
  ? JSON.parse(read('tests/evals/coverage-exemptions.json'))
  : { exempt: [] };
const exemptSet = new Set(exemptions.exempt ?? []);
const commandSkills = fs
  .readdirSync(skillsDir)
  .filter((n) => fs.existsSync(path.join(skillsDir, n, 'SKILL.md')) && n !== 'qa-example');

for (const skill of commandSkills) {
  const hasCases =
    exists(`tests/evals/${skill}`) &&
    fs.readdirSync(path.join(root, 'tests/evals', skill)).some((f) => f.endsWith('.case.json'));
  let hasSafety = false;
  if (exists('tests/evals/safety')) {
    for (const f of fs.readdirSync(path.join(root, 'tests/evals/safety'))) {
      if (!f.endsWith('.case.json')) continue;
      try {
        const caseJson = JSON.parse(
          fs.readFileSync(path.join(root, 'tests/evals/safety', f), 'utf8'),
        );
        if (caseJson.skill === skill) {
          hasSafety = true;
          break;
        }
      } catch {
        /* ignore */
      }
    }
  }
  if (!hasCases && !hasSafety && !exemptSet.has(skill)) {
    problems.push(
      `skill ${skill} has no eval cases and is not listed in tests/evals/coverage-exemptions.json`,
    );
  }
}

// Public contracts must exist for every command skill that declares contracts/
for (const skill of commandSkills) {
  const contractsDir = path.join(skillsDir, skill, 'contracts');
  if (!fs.existsSync(contractsDir)) continue;
  const schemas = fs.readdirSync(contractsDir).filter((f) => f.endsWith('.schema.json'));
  if (schemas.length === 0) problems.push(`${skill}/contracts/ has no schema.json files`);
}

// Registry live gate
const live = listFrameworks().filter((f) => f.liveExecution);
if (live.length !== 1 || live[0].id !== 'playwright') {
  problems.push('architecture invariant: exactly one liveExecution framework (playwright)');
}

if (problems.length) {
  console.error('architecture fitness check failed:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log('architecture fitness OK');
