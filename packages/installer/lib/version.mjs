// Single source of truth for the pack version the installer reports and writes
// into lockfiles. Read from a package.json at runtime so the two can never
// drift. Works on any Node 18+ without JSON import attributes.
//
// Two layouts must both work, and one of them used to fail silently:
//
//   repository   packages/installer/lib/version.mjs -> ../package.json
//   published    the same relative path, IF packages/installer/package.json is
//                in the `files` allowlist — it was not, so the published CLI
//                reported 0.0.0 and wrote 0.0.0 into every lockfile.
//
// Both candidates are now tried, and an unresolvable version is loudly wrong
// (`0.0.0-unknown`) rather than plausibly wrong. `scripts/release/validate-release.mjs`
// asserts the manifest actually ships, so this fallback should never be reached.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const MANIFEST_CANDIDATES = [
  // The workspace member's own manifest.
  path.join(here, '..', 'package.json'),
  // The pack root manifest — always present in a published tarball.
  path.join(here, '..', '..', '..', 'package.json'),
];

function readVersion() {
  for (const manifest of MANIFEST_CANDIDATES) {
    try {
      const version = JSON.parse(fs.readFileSync(manifest, 'utf8')).version;
      if (typeof version === 'string' && version.length > 0) return version;
    } catch {
      /* try the next candidate */
    }
  }
  return '0.0.0-unknown';
}

export const VERSION = readVersion();

// The Agent Skills specification revision this pack validated against. The
// specification is a living document without formal releases; this records the
// revision each install was made against so `verify` and support can reason
// about it. Bump when the pack is re-validated against a newer revision.
export const SPEC_REVISION = '2026-07';
