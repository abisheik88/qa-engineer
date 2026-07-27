#!/usr/bin/env node
// Knowledge-base consistency check: every domain document under shared/domains/
// carries the seven canonical sections, so the knowledge base stays uniform.
// Run: node scripts/check-knowledge.mjs   (CI runs this; exit 1 on a problem)

import fs from 'node:fs';
import path from 'node:path';

const DOMAINS = 'shared/domains';
// Files that are not domain documents.
const EXEMPT = new Set(['README.md', 'example-domain.md', 'evidence-and-reporting.md']);
const REQUIRED = [
  '## Best practices',
  '## Common failures',
  '## Detection signals',
  '## Repair guidance',
  '## Framework notes',
  '## Anti-patterns',
  '## Future extension',
];

let errors = 0;
let checked = 0;

for (const entry of fs.readdirSync(DOMAINS).sort()) {
  if (!entry.endsWith('.md') || EXEMPT.has(entry)) continue;
  const file = path.join(DOMAINS, entry);
  const text = fs.readFileSync(file, 'utf8');
  checked += 1;
  for (const heading of REQUIRED) {
    if (!text.includes(`${heading}\n`)) {
      console.log(`::error file=${file}::missing required section "${heading}"`);
      errors += 1;
    }
  }
  // Domain docs are synced into skills, so they must be self-contained.
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = match[1];
    if (/^[a-z]+:/.test(target) || target.startsWith('#')) continue;
    console.log(`::error file=${file}::relative link "${target}" — domain docs are synced and must be link-free`);
    errors += 1;
  }
}

console.log(`\ncheck-knowledge: ${checked} domain document(s), ${errors} problem(s)`);
process.exit(errors > 0 ? 1 : 0);
