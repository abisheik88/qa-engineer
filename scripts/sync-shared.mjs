#!/usr/bin/env node
// Materializes shared/ knowledge modules into skills as committed copies.
// The manifest is the files themselves: any file whose first line is a
// "synced-from" marker is owned by this tool. See shared/README.md.
//
//   node scripts/sync-shared.mjs --check                    verify copies match sources (CI)
//   node scripts/sync-shared.mjs --write                    refresh all copies from sources
//   node scripts/sync-shared.mjs --add <shared-file> <skill-dir>   start syncing a module into a skill

import fs from 'node:fs';
import path from 'node:path';

const MARKER_PATTERN = /^<!-- synced-from: (shared\/\S+) /;

function markerFor(source) {
  return `<!-- synced-from: ${source} — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->`;
}

function composedContent(source) {
  return `${markerFor(source)}\n${fs.readFileSync(source, 'utf8')}`;
}

/** Every marker-owned file under skills/. */
function findSyncedFiles() {
  const results = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        const firstLine = fs.readFileSync(full, 'utf8').split('\n', 1)[0];
        const match = firstLine.match(MARKER_PATTERN);
        if (match) results.push({ file: full, source: match[1] });
      }
    }
  };
  if (fs.existsSync('skills')) walk('skills');
  return results;
}

const mode = process.argv[2] ?? '--check';

if (mode === '--add') {
  const [source, skillDir] = process.argv.slice(3);
  if (!source || !skillDir) {
    console.error('usage: node scripts/sync-shared.mjs --add <shared-file> <skill-dir>');
    process.exit(2);
  }
  if (!fs.existsSync(source) || !source.startsWith('shared/')) {
    console.error(`source must be an existing file under shared/: ${source}`);
    process.exit(2);
  }
  const destDir = path.join(skillDir, 'references');
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, path.basename(source));
  fs.writeFileSync(dest, composedContent(source));
  console.log(`synced ${source} -> ${dest}`);
  process.exit(0);
}

if (mode !== '--check' && mode !== '--write') {
  console.error('usage: node scripts/sync-shared.mjs [--check | --write | --add <shared-file> <skill-dir>]');
  process.exit(2);
}

const synced = findSyncedFiles();
let drifted = 0;

for (const { file, source } of synced) {
  if (!fs.existsSync(source)) {
    console.error(`ERROR   ${file}: source does not exist: ${source}`);
    drifted += 1;
    continue;
  }
  const expected = composedContent(source);
  const actual = fs.readFileSync(file, 'utf8');
  if (actual === expected) continue;
  if (mode === '--write') {
    fs.writeFileSync(file, expected);
    console.log(`updated ${file} (from ${source})`);
  } else {
    console.error(`DRIFT   ${file}: differs from ${source} — run: node scripts/sync-shared.mjs --write`);
    drifted += 1;
  }
}

console.log(`sync-shared ${mode}: ${synced.length} synced file(s)${mode === '--check' ? `, ${drifted} problem(s)` : ''}`);
process.exit(mode === '--check' && drifted > 0 ? 1 : 0);
