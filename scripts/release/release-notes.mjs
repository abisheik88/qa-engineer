#!/usr/bin/env node
// Release notes and integrity digests, derived from the changelog.
//
// The changelog is curated prose written by a human who decided what mattered;
// a git log is a list of commits. So the notes are generated from CHANGELOG.md
// rather than from history — the generator's job is to extract, verify, and
// stamp, never to summarize.
//
//   node scripts/release/release-notes.mjs --version 1.0.0             notes to stdout
//   node scripts/release/release-notes.mjs --version 1.0.0 --check     verify only
//   node scripts/release/release-notes.mjs --version 1.0.0 --checksums per-file digests
//
// `--check` exits non-zero when the changelog cannot support a release: no
// section for the version, an empty section, or a section still marked
// [Unreleased]. Release engineering that cannot fail is not a gate.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1] ?? true;
}
const has = (name) => process.argv.includes(`--${name}`);

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = arg('version') === true || arg('version') === null ? pkg.version : arg('version');

/** The changelog body for one version, or for [Unreleased]. */
function changelogSection(target) {
  const text = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  const lines = text.split('\n');
  const heading = new RegExp(`^## \\[${target.replace(/\./g, '\\.')}\\]`);
  const anyHeading = /^## \[/;

  const start = lines.findIndex((l) => heading.test(l));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (anyHeading.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { heading: lines[start], body: lines.slice(start + 1, end).join('\n').trim() };
}

/** sha256 of every file the tarball would ship, so contents are verifiable. */
function tarballChecksums() {
  const pack = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: root, encoding: 'utf8' });
  if (pack.status !== 0) {
    throw new Error(`npm pack --dry-run failed: ${(pack.stderr || '').trim()}`);
  }
  const files = JSON.parse(pack.stdout)[0].files.map((f) => f.path).sort();
  const digests = files.map((rel) => {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
    return { path: rel, sha256: hash };
  });
  // A single digest over the per-file digests: stable across repacks, because it
  // ignores the archive wrapper's timestamps.
  const manifest = digests.map((d) => `${d.sha256}  ${d.path}`).join('\n');
  return {
    files: digests,
    contentDigest: crypto.createHash('sha256').update(manifest).digest('hex'),
    manifest,
  };
}

const problems = [];
const section = changelogSection(version);

if (has('check')) {
  if (!section) {
    problems.push(
      `CHANGELOG.md has no "## [${version}]" section — convert [Unreleased] before tagging`,
    );
  } else if (!section.body) {
    problems.push(`CHANGELOG.md section for ${version} is empty`);
  }
  if (!/^## \[Unreleased\]/m.test(fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'))) {
    problems.push('CHANGELOG.md must keep an "## [Unreleased]" section for the next cycle');
  }
  const installer = JSON.parse(
    fs.readFileSync(path.join(root, 'packages/installer/package.json'), 'utf8'),
  );
  if (installer.version !== pkg.version) {
    problems.push(`version mismatch: root ${pkg.version} vs installer ${installer.version}`);
  }

  if (problems.length) {
    console.error('release-notes --check failed:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`release notes OK for ${version} (changelog section present and non-empty)`);
  process.exit(0);
}

if (has('checksums')) {
  const { files, contentDigest } = tarballChecksums();
  console.log(`# ${pkg.name}@${version} — content digest`);
  console.log(`# ${files.length} files`);
  console.log(`# sha256(manifest) = ${contentDigest}`);
  console.log('#');
  console.log('# Reproduce: node scripts/release/release-notes.mjs --version <v> --checksums');
  console.log('# The archive wrapper embeds timestamps, so compare THIS digest, not the .tgz.');
  for (const f of files) console.log(`${f.sha256}  ${f.path}`);
  process.exit(0);
}

// Default: emit the notes.
if (!section) {
  console.error(`CHANGELOG.md has no "## [${version}]" section.`);
  process.exit(1);
}

const { contentDigest, files } = tarballChecksums();

console.log(`# ${pkg.name} ${version}

${section.body}

## Verifying this release

\`\`\`bash
npm pack                                   # from the v${version} tag
node scripts/release/release-notes.mjs --version ${version} --checksums
\`\`\`

- Files shipped: **${files.length}**
- Content digest (sha256 over the per-file manifest): \`${contentDigest}\`

The digest covers file contents, not the archive wrapper, so it is stable across
repacks of the same commit.

## Installing

\`\`\`bash
npx ${pkg.name}@${version} --yes --project .
npx ${pkg.name}@${version} self-test --project .
\`\`\`

## Known limitations

See [docs/release/](../../docs/release/) for the verified state of this release,
including what it does **not** prove.`);
