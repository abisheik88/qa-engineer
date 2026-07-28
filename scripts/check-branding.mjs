#!/usr/bin/env node
// Branding single-source check.
//
// The promise is that changing the report footer means editing exactly one file:
// packages/engine/lib/analysis/branding.json. A promise like that decays the
// first time someone pastes the tagline into a template "just here", so it is
// checked rather than trusted.
//
// Two rules:
//   1. No branding VALUE appears anywhere outside the metadata file and the
//      renderer's own tests. Naming the fields is fine; hardcoding the strings is
//      not.
//   2. No machine-readable artifact carries a footer. Appending prose to a
//      contract, a lockfile, or CLI JSON corrupts an interface.
//
// Run: node scripts/check-branding.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

const METADATA_REL = 'packages/engine/lib/analysis/branding.json';
const RENDERER_REL = 'packages/engine/lib/analysis/branding.mjs';

if (!fs.existsSync(path.join(root, METADATA_REL))) {
  console.error(`branding check failed:\n  - missing ${METADATA_REL}`);
  process.exit(1);
}

const metadata = JSON.parse(fs.readFileSync(path.join(root, METADATA_REL), 'utf8'));
for (const key of ['projectName', 'tagline', 'author', 'website', 'attributionPrefix', 'authorPrefix']) {
  if (!metadata[key]) problems.push(`${METADATA_REL}: missing or empty "${key}"`);
}
if (metadata.website && !/^https?:\/\//.test(metadata.website)) {
  problems.push(`${METADATA_REL}: website must be an http(s) URL, got "${metadata.website}"`);
}

// The values that must not be duplicated. `projectName` is excluded: "QA
// Automation Pack" is the project's actual name and appears legitimately in prose
// throughout the documentation. The distinguishing strings are the ones that exist
// only to brand a report.
const GUARDED = ['tagline', 'website', 'authorPrefix']
  .map((key) => ({ key, value: metadata[key] }))
  .filter((entry) => entry.value);

// Files allowed to contain any guarded value.
const ALLOWED = new Set([
  METADATA_REL,
  RENDERER_REL,
  'packages/engine/test/branding.test.mjs',      // snapshots, by design
  'packages/engine/test/corpus/expected.json',   // the recorded corpus, by design
  'docs/release/v1-excellence-audit.md',        // audits quote what was implemented
  'CHANGELOG.md',                                // release notes describe the footer
]);

// Per-value exceptions. The rule this gate protects is "a *generated* footer has
// one source" — not "the author's URL may never appear". A hand-written landing
// page or maintainer list crediting the author is ordinary open-source practice
// and is nobody's copy of a rendered footer. The footer-specific strings
// (`tagline`, `authorPrefix`) stay guarded everywhere, so a pasted footer is still
// caught wherever it lands.
const VALUE_EXCEPTIONS = {
  website: new Set(['README.md', 'MAINTAINERS.md', 'GOVERNANCE.md', 'SUPPORT.md']),
};

// Where a footer is legitimately rendered at runtime rather than hardcoded: the
// synced knowledge module tells skills to CALL the renderer, so it may name the
// command but must not contain the strings.
const MACHINE_READABLE_EXTENSIONS = new Set(['.json', '.yml', '.yaml', '.lock']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'test-results', 'playwright-report', '.qa']);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(path.relative(root, full));
  }
  return files;
}

const files = walk(root);

for (const rel of files) {
  if (ALLOWED.has(rel)) continue;
  const ext = path.extname(rel);
  // Binary-ish and generated files are not scanned for prose.
  if (['.png', '.jpg', '.zip', '.pyc', '.tgz', '.ico', '.woff', '.woff2'].includes(ext)) continue;

  let text;
  try {
    text = fs.readFileSync(path.join(root, rel), 'utf8');
  } catch {
    continue;
  }

  // Rule 1 — no duplicated branding values.
  for (const { key, value } of GUARDED) {
    if (VALUE_EXCEPTIONS[key]?.has(rel)) continue;
    if (text.includes(value)) {
      problems.push(
        `${rel}: hardcodes the branding "${key}" ("${value}") — read it from ${METADATA_REL} ` +
          "via the engine's branding module instead, so a wording change stays a one-file edit",
      );
    }
  }

  // Rule 2 — machine-readable artifacts carry no footer.
  if (MACHINE_READABLE_EXTENSIONS.has(ext) && rel !== METADATA_REL) {
    for (const marker of [metadata.attributionPrefix, 'qa-pack-attribution']) {
      if (marker && text.includes(marker)) {
        problems.push(
          `${rel}: a machine-readable artifact contains a branding footer ("${marker}") — ` +
            'a contract or config is an interface, and prose appended to it is corruption',
        );
      }
    }
  }
}

// The product name is one name. The README's title, the npm description, and the
// attribution footer must agree — a rename that touches only the README ships a
// package whose landing page says one thing and whose every report says another.
// That happened: the H1 was changed to "QA Engineer Pack" while 44 occurrences of
// the old name remained, including the footer, the doctor header, and the CLI help.
const readmeTitle = (fs.readFileSync(path.join(root, 'README.md'), 'utf8').match(/^#\s+(.+)$/m) ?? [])[1]?.trim();
if (!readmeTitle) {
  problems.push('README.md has no H1 title to compare against the branding metadata');
} else if (readmeTitle !== metadata.projectName) {
  problems.push(
    `README.md title "${readmeTitle}" does not match branding projectName ` +
      `"${metadata.projectName}" — the landing page and the report footer would disagree`,
  );
}

// Any lingering trace of a previous product name is drift, not history: the
// footer is generated, so a stale name in prose means the rename was incomplete.
const PREVIOUS_NAMES = ['QA Automation Pack'];
const HISTORICAL = new Set([
  'CHANGELOG.md',
  'docs/v1-readiness-assessment.md',
  'docs/release/audit-verification.md',
  'docs/release/final-release-audit.md',
  'docs/release/v1-excellence-audit.md',
  'docs/release/v0.9-release-checklist.md',
  'scripts/check-branding.mjs',
]);
for (const rel of files) {
  if (HISTORICAL.has(rel)) continue;
  const ext = path.extname(rel);
  if (['.png', '.jpg', '.zip', '.pyc', '.tgz', '.ico'].includes(ext)) continue;
  let text;
  try {
    text = fs.readFileSync(path.join(root, rel), 'utf8');
  } catch {
    continue;
  }
  for (const stale of PREVIOUS_NAMES) {
    if (stale !== metadata.projectName && text.includes(stale)) {
      problems.push(`${rel}: still says "${stale}" — the product is now "${metadata.projectName}"`);
    }
  }
}

// The renderer must exist and expose the documented functions.
const renderer = fs.readFileSync(path.join(root, RENDERER_REL), 'utf8');
for (const fn of ['footerHtml', 'footerMarkdown', 'footerText', 'appendTo', 'metadata']) {
  if (!renderer.includes(`export function ${fn}(`)) {
    problems.push(`${RENDERER_REL}: missing the documented function ${fn}()`);
  }
}

// Deliberately NOT checked here: that the rendered anchor carries `target="_blank"`
// and `rel="noopener noreferrer"`. A first attempt grepped the renderer's source for
// those attributes and passed even after they were deleted from the emitted markup —
// because the module's own prose mentions them. A check that cannot fail is worse
// than none: it reports safety it never verified. Those attributes are asserted
// against the RENDERED output, where it counts, by
// packages/engine/test/branding.test.mjs.

// The instruction must reach skills from one synced source, not per-skill copies.
const knowledge = fs.readFileSync(path.join(root, 'shared/domains/evidence-and-reporting.md'), 'utf8');
if (!knowledge.includes('analysis branding')) {
  problems.push(
    'shared/domains/evidence-and-reporting.md must tell skills to render the footer with ' +
      'the branding tool, so no skill types it by hand',
  );
}
// And the whole report, not only its footer: a hand-written HTML report is where
// both the footer and the required finding fields went missing on the first live run.
if (!knowledge.includes('analysis report-html')) {
  problems.push(
    'shared/domains/evidence-and-reporting.md must tell skills to render HTML reports with ' +
      'analysis report-html — a typed report is a lossy copy of the artifact',
  );
}

if (problems.length) {
  console.error('branding check failed:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(
  `branding OK (single source: ${METADATA_REL}; ${GUARDED.length} guarded value(s), ` +
    `${files.length} file(s) scanned)`,
);
