#!/usr/bin/env node
// Advisory check for activation-keyword collisions between skill descriptions.
// Descriptions are the routing surface on every agent; two skills sharing
// distinctive keywords will misroute each other's requests.
//
//   node scripts/check-keywords.mjs             report collisions (always exits 0)
//   node scripts/check-keywords.mjs --strict    exit 1 on collisions (release gate)

import fs from 'node:fs';
import path from 'node:path';
import { listSkillDirs, parseSkillMd } from './lib/skills.mjs';

// Generic vocabulary that legitimately appears in many descriptions and
// carries no routing signal. Keep lowercase; words shorter than 4 letters
// are ignored automatically.
const STOPWORDS = new Set([
  'when', 'with', 'that', 'this', 'them', 'then', 'from', 'into', 'your',
  'each', 'have', 'been', 'will', 'what', 'which', 'where', 'while', 'their',
  'test', 'tests', 'testing', 'automation', 'skill', 'skills', 'pack',
  'agent', 'agents', 'quality', 'validate', 'validating', 'correctly',
  'lightweight', 'implementation', 'reference', 'capability', 'example',
]);

const tokensBySkill = new Map();

for (const dir of listSkillDirs()) {
  const skillFile = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(skillFile)) continue;
  const parsed = parseSkillMd(fs.readFileSync(skillFile, 'utf8'));
  if (parsed.error || !parsed.data.description) continue;
  const tokens = new Set(
    parsed.data.description
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, ' ')
      .split(' ')
      .filter((word) => word.length >= 4 && !STOPWORDS.has(word)),
  );
  tokensBySkill.set(path.basename(dir), tokens);
}

const owners = new Map();
for (const [skill, tokens] of tokensBySkill) {
  for (const token of tokens) {
    if (!owners.has(token)) owners.set(token, []);
    owners.get(token).push(skill);
  }
}

const collisions = [...owners.entries()]
  .filter(([, skills]) => skills.length > 1)
  .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

if (collisions.length === 0) {
  console.log(`check-keywords: ${tokensBySkill.size} skill(s), no keyword collisions`);
  process.exit(0);
}

console.log(`check-keywords: ${collisions.length} keyword(s) shared between skills\n`);
for (const [token, skills] of collisions) {
  console.log(`  "${token}"  ->  ${skills.join(', ')}`);
}
console.log('\nShared keywords weaken routing for every skill involved.');
console.log('Make each description distinctive, or accept the overlap knowingly.');
process.exit(process.argv.includes('--strict') ? 1 : 0);
