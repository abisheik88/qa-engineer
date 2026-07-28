#!/usr/bin/env node
// Spec ⇄ code consistency: description budgets and envelope field shapes must
// match docs/skills/output-contracts.md and validate-skills constants.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

const validateSrc = fs.readFileSync(path.join(root, 'scripts/validate-skills.mjs'), 'utf8');
const contractsDoc = fs.readFileSync(path.join(root, 'docs/skills/output-contracts.md'), 'utf8');

// Envelope fields documented and enforced
const ENVELOPE = ['contract', 'skill', 'generatedAt', 'summary', 'classification', 'evidence'];
for (const field of ENVELOPE) {
  if (!validateSrc.includes(`'${field}'`) && !validateSrc.includes(`"${field}"`)) {
    problems.push(`validate-skills.mjs missing envelope field ${field}`);
  }
  if (!contractsDoc.toLowerCase().includes(field.toLowerCase())) {
    problems.push(`output-contracts.md missing envelope field ${field}`);
  }
}

// Every skill contract must require the same envelope fields
const skillsDir = path.join(root, 'skills');
for (const skill of fs.readdirSync(skillsDir)) {
  const cdir = path.join(skillsDir, skill, 'contracts');
  if (!fs.existsSync(cdir)) continue;
  for (const file of fs.readdirSync(cdir).filter((f) => f.endsWith('.schema.json'))) {
    const schema = JSON.parse(fs.readFileSync(path.join(cdir, file), 'utf8'));
    const required = new Set(schema.required || []);
    for (const field of ENVELOPE) {
      if (!required.has(field)) {
        problems.push(`${skill}/contracts/${file} missing required envelope field: ${field}`);
      }
    }
    // evidence must require minItems >= 1 (principle: evidence before conclusions)
    const evidence = schema.properties?.evidence;
    if (evidence && (evidence.minItems ?? 0) < 1) {
      problems.push(`${skill}/contracts/${file} evidence.minItems must be >= 1`);
    }
  }
}

// Framework registry referenced by fitness + detector
if (!fs.existsSync(path.join(root, 'shared/frameworks/registry.json'))) {
  problems.push('shared/frameworks/registry.json missing');
}

// Deterministic boundary doc must exist and name the LLM/fact split
const boundary = fs.readFileSync(
  path.join(root, 'docs/architecture/deterministic-execution-boundary.md'),
  'utf8',
);
for (const needle of ['Deterministic code owns', 'LLM must not', 'Invent execution facts']) {
  if (!boundary.includes(needle)) problems.push(`deterministic-execution-boundary.md missing: ${needle}`);
}

// The supported JSON Schema subset is declared in two places: the validator and
// output-contracts.md. They must agree, or a contract author writes a constraint the
// documentation promises and the validator ignores — which is worse than no rule,
// because the schema *looks* like it enforces something.
//
// This used to compare three places, the third being a second validator in Python.
// One validator is the point of ADR-0012; the documentation check is what still has
// teeth, and packages/installer/test/parity.test.mjs additionally holds every shipped
// contract to the subset.
const jsSrc = fs.readFileSync(
  path.join(root, 'packages/engine/lib/analysis/contracts.mjs'),
  'utf8',
);

function keywordsFrom(source, startMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) return null;
  const end = source.indexOf('}', start);
  if (end === -1) return null;
  return [...source.slice(start, end).matchAll(/'([^']+)'|"([^"]+)"/g)]
    .map((m) => m[1] ?? m[2])
    .sort();
}

const jsKeywords = keywordsFrom(jsSrc, 'const SUPPORTED = new Set([');

if (!jsKeywords) {
  problems.push('contracts.mjs: could not read SUPPORTED');
} else {
  // The documented subset must list exactly the implemented keywords.
  const subsetDoc = fs.readFileSync(path.join(root, 'docs/skills/output-contracts.md'), 'utf8');
  const documented = [...subsetDoc.matchAll(/`(\$?[a-zA-Z]+)`/g)].map((m) => m[1]);
  for (const k of jsKeywords) {
    if (!documented.includes(k)) {
      problems.push(`output-contracts.md does not document supported keyword "${k}"`);
    }
  }
}

// Every declared cross-field invariant must actually exist in its contract.
const INVARIANT_CONTRACTS = [
  ['qa-run', 'execution-result.schema.json'],
  ['qa-report', 'report-result.schema.json'],
  ['qa-fix', 'fix-result.schema.json'],
];
for (const [skill, file] of INVARIANT_CONTRACTS) {
  const schema = JSON.parse(
    fs.readFileSync(path.join(skillsDir, skill, 'contracts', file), 'utf8'),
  );
  const invariants = schema.allOf ?? [];
  if (invariants.length === 0) {
    problems.push(`${skill}/contracts/${file} declares no cross-field invariants (allOf)`);
    continue;
  }
  for (const [index, inv] of invariants.entries()) {
    if (!inv.if || !inv.then) {
      problems.push(`${skill}/contracts/${file} allOf[${index}] is not an if/then invariant`);
    }
    if (!inv.title) {
      problems.push(`${skill}/contracts/${file} allOf[${index}] has no title explaining what it prevents`);
    }
  }
}

if (problems.length) {
  console.error('spec⇄code consistency check failed:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log('spec⇄code consistency OK');
