#!/usr/bin/env node
// Fail CI when capability / framework matrices drift from the canonical
// shared/frameworks/registry.json, or when detection docs omit registry signals.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFrameworkRegistry, registryPath } from '../shared/frameworks/registry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    problems.push(`missing: ${rel}`);
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

function cells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.replace(/\*\*/g, '').replace(/`/g, '').trim());
}

function tableRows(md, headerHas) {
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].trim().startsWith('|')) continue;
    const header = cells(lines[i]).map((c) => c.toLowerCase());
    if (!headerHas.every((h) => header.some((c) => c.includes(h.toLowerCase())))) continue;
    if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) continue;
    const rows = [];
    for (let j = i + 2; j < lines.length && lines[j].trim().startsWith('|'); j += 1) {
      rows.push(cells(lines[j]));
    }
    return { header: cells(lines[i]), rows };
  }
  return { header: [], rows: [] };
}

const registry = loadFrameworkRegistry();
const byId = new Map(registry.frameworks.map((f) => [f.id, f]));

// Validate registry against its schema (minimal required-field check; full
// draft-2020 validation is not required — registry.schema.json documents shape).
for (const fw of registry.frameworks) {
  if (!fw.id || !fw.supportLevel) problems.push(`registry entry missing id/supportLevel`);
  if (fw.supportLevel !== 'Planning' && fw.adapterDir) {
    const abs = path.join(root, fw.adapterDir);
    if (!fs.existsSync(abs)) problems.push(`adapter missing for ${fw.id}: ${fw.adapterDir}`);
  }
  if (fw.supportLevel === 'Planning' && fw.adapterDir) {
    problems.push(`Planning framework ${fw.id} must have adapterDir: null`);
  }
  if (fw.liveExecution && fw.supportLevel !== 'Production') {
    problems.push(`${fw.id}: liveExecution requires Production supportLevel`);
  }
}

const canonical = read('docs/capability-matrix.md');
const frameworkMatrix = read('docs/compatibility/framework-matrix.md');

const capTable = tableRows(canonical, ['framework', 'level']);
for (const row of capTable.rows) {
  const name = row[0];
  const level = row[row.length - 1];
  const match = registry.frameworks.find(
    (f) =>
      f.displayName.toLowerCase() === name.toLowerCase() ||
      name.toLowerCase().includes(f.id) ||
      f.id === name.toLowerCase(),
  );
  if (!match) {
    problems.push(`capability-matrix framework not in registry: ${name}`);
    continue;
  }
  if (match.supportLevel !== level) {
    problems.push(`capability-matrix ${name}: level ${level} != registry ${match.supportLevel}`);
  }
}

const fwTable = tableRows(frameworkMatrix, ['framework', 'support']);
for (const row of fwTable.rows) {
  const name = row[0];
  const level = row[row.length - 1];
  const match =
    registry.frameworks.find(
      (f) =>
        f.displayName.toLowerCase() === name.toLowerCase() ||
        name.toLowerCase().includes(f.id),
    ) ?? null;
  if (!match) {
    problems.push(`framework-matrix framework not in registry: ${name}`);
    continue;
  }
  if (match.supportLevel !== level) {
    problems.push(`framework-matrix ${name}: level ${level} != registry ${match.supportLevel}`);
  }
}

// Detection guide / shared modules should mention each non-planning framework id
const detectionDocs = [
  'skills/qa-init/references/detection-guide.md',
  'shared/execution/framework-detection.md',
  'shared/generation/framework-selection.md',
];
for (const rel of detectionDocs) {
  const text = read(rel).toLowerCase();
  if (!text) continue;
  for (const fw of registry.frameworks) {
    if (fw.supportLevel === 'Planning') continue;
    if (!text.includes(fw.id) && !text.includes(fw.displayName.toLowerCase())) {
      problems.push(`${rel} does not mention registry framework ${fw.id}`);
    }
  }
}

// Live gate: only playwright may have liveExecution true today
const live = registry.frameworks.filter((f) => f.liveExecution);
if (live.length !== 1 || live[0].id !== 'playwright') {
  problems.push(
    `expected exactly one liveExecution framework (playwright); got ${live.map((f) => f.id).join(',')}`,
  );
}

if (problems.length) {
  console.error('framework registry check failed:');
  for (const p of problems) console.error(`  - ${p}`);
  console.error(`registry: ${path.relative(root, registryPath())}`);
  process.exit(1);
}

console.log(`framework registry OK (${registry.frameworks.length} frameworks)`);
