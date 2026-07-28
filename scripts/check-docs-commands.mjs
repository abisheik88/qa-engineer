#!/usr/bin/env node
// Documented CLI commands must exist, run, and be spelled the way users will
// actually type them.
//
// Three failures this catches, all of which were live:
//
//   1. `npx qa …` — npx resolves a PACKAGE name, so the documented command
//      fetched an unrelated registry package called `qa`, not this pack. The
//      package must expose a bin matching its own name for `npx <name>` to work.
//   2. A command shipped but undocumented (`uninstall`), or documented but never
//      implemented — fs-safe.mjs described an uninstall for a release in which
//      none existed.
//   3. A documented command that no longer runs.
//
// Run: node scripts/check-docs-commands.mjs

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { COMMAND_NAMES } from '../packages/installer/lib/cli/commands.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const PACKAGE_NAME = pkg.name;
const cli = path.join(root, 'packages', 'installer', 'bin', 'qa.mjs');

// Documents that quote historical or incorrect commands as evidence, and must
// not be rewritten to match the current CLI.
// Historical records. They state what was observed and done at a point in time,
// under the names in use then, so rewriting them to match the current CLI would
// make them false. The audit trail is worth more than uniform search-and-replace.
const EXEMPT = new Set([
  'docs/release/audit-verification.md',
  'docs/release/final-release-audit.md',
  'docs/release/v1-excellence-audit.md',
  'docs/release/v0.9-release-checklist.md',
  'CHANGELOG.md',
]);

function markdownFiles(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) markdownFiles(full, found);
    else if (entry.name.endsWith('.md')) found.push(path.relative(root, full));
  }
  return found;
}

// --- 1. `npx <name>` must resolve to this package ---------------------------
if (!pkg.bin || !Object.prototype.hasOwnProperty.call(pkg.bin, PACKAGE_NAME)) {
  problems.push(
    `package.json must expose a bin named "${PACKAGE_NAME}" so \`npx ${PACKAGE_NAME}\` resolves ` +
      `a default binary (bins present: ${Object.keys(pkg.bin ?? {}).join(', ') || 'none'})`,
  );
}

const docs = markdownFiles(root).filter((f) => !EXEMPT.has(f));
const documented = new Set();

/**
 * True when this occurrence sits on a line that marks itself as a counter-example
 * — troubleshooting documentation has to be able to show the wrong command in
 * order to explain it. The convention is a `wrong` marker on the same line, which
 * keeps the rest of the file checked instead of exempting it wholesale.
 */
function isAntiExample(text, index) {
  const lineStart = text.lastIndexOf('\n', index) + 1;
  let lineEnd = text.indexOf('\n', index);
  if (lineEnd === -1) lineEnd = text.length;
  return /\bwrong\b|\bdo not use\b|\bincorrect\b/i.test(text.slice(lineStart, lineEnd));
}

for (const rel of docs) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');

  // A bare `npx qa` (not the package name) installs something else entirely.
  for (const match of text.matchAll(/npx\s+(-[a-z-]+\s+)?([@a-z0-9/._-]+)/gi)) {
    const target = match[2];
    if (isAntiExample(text, match.index)) continue;
    if (target === PACKAGE_NAME) continue;
    // Allowed: documented third-party tooling.
    if (['playwright', '--yes', 'markdownlint-cli2', 'editorconfig-checker'].includes(target)) continue;
    if (target === 'qa' || target === 'qa-pack' || target === 'qa-automation-pack') {
      problems.push(
        `${rel}: \`npx ${target}\` resolves a package named "${target}", not this pack — ` +
          `use \`npx ${PACKAGE_NAME}\``,
      );
    }
  }

  // Collect documented subcommands of this pack's CLI.
  const invocation = new RegExp(
    `(?:npx\\s+${PACKAGE_NAME}|\\bqa)\\s+([a-z][a-z-]*)`,
    'g',
  );
  for (const match of text.matchAll(invocation)) {
    const candidate = match[1];
    // Skip flag-only and prose matches.
    if (candidate.startsWith('-')) continue;
    if (COMMAND_NAMES.includes(candidate)) documented.add(candidate);
    else if (/^(install|verify|doctor|repair|update|uninstall|onboard|self-test|version|help)$/.test(candidate)) {
      documented.add(candidate);
    }
  }
}

// --- 2. Every shipped command must be documented ---------------------------
const README = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
for (const name of COMMAND_NAMES) {
  if (name === 'onboard' || name === 'help' || name === 'version') continue; // covered by the bare form
  if (!documented.has(name)) {
    problems.push(`no documentation shows how to run \`${name}\` — it ships but is unexplained`);
  }
  if (!README.includes(name)) {
    problems.push(`README.md does not mention the \`${name}\` command`);
  }
}

// --- 3. Every documented command must actually run --------------------------
for (const name of [...documented].sort()) {
  const result = spawnSync(process.execPath, [cli, name, '--help'], {
    encoding: 'utf8',
    env: { ...process.env, QA_LOG_LEVEL: 'error' },
  });
  if (result.status !== 0) {
    problems.push(
      `\`qa ${name} --help\` exited ${result.status}: ${(result.stderr || result.stdout || '').trim().slice(0, 120)}`,
    );
  }
}

if (problems.length) {
  console.error('documented-command check failed:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(
  `documented commands OK (${documented.size} of ${COMMAND_NAMES.length} commands shown in docs, ` +
    `\`npx ${PACKAGE_NAME}\` resolves)`,
);
