// Bundling the deterministic engine, integrated into installation.
//
// Skills that run the engine need it to travel with them (self-containment). The
// installer materializes it by COPYING the engine from packages/engine/ into the
// installed skill's scripts/lib/ — a pure file copy, no code executed at install
// time, honoring the SECURITY.md guarantee.
//
// The engine is Node, and Node is already present: the user ran `npx` to get here.
// That removes the whole class of failure the Python bundle had, where the files
// could be copied perfectly and still not run because the interpreter was missing,
// the wrong version, or named `python` rather than `python3` (ADR-0012).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { BUNDLE_MANIFEST, ENGINE_SOURCE, ENGINE_DATA, BUNDLE_DEST } from './manifest.mjs';
import { listFilesRelative } from './paths.mjs';

/** Bundle file entries for one skill, relative to the skill directory. */
export function bundleFilesForSkill(sourceRoot, skill) {
  if (!BUNDLE_MANIFEST[skill]) return [];
  const entries = [];

  const engineRoot = path.join(sourceRoot, ENGINE_SOURCE);
  if (!fs.existsSync(engineRoot)) {
    throw new Error(`engine source missing: ${ENGINE_SOURCE} (needed by ${skill})`);
  }
  for (const rel of listFilesRelative(engineRoot)) {
    // Tests and the package manifest are development files; the bundle is the
    // runtime only.
    if (rel.startsWith('test/') || rel === 'package.json') continue;
    entries.push({
      rel: `${BUNDLE_DEST}/${rel}`,
      content: fs.readFileSync(path.join(engineRoot, rel)),
    });
  }

  // Data the engine reads at runtime: the context contract, the internal seam
  // schemas, and the branding metadata.
  for (const data of ENGINE_DATA) {
    const from = path.join(sourceRoot, data.from);
    if (!fs.existsSync(from)) {
      throw new Error(`engine data missing: ${data.from} (needed by ${skill})`);
    }
    if (fs.statSync(from).isDirectory()) {
      for (const rel of listFilesRelative(from)) {
        entries.push({
          rel: `${BUNDLE_DEST}/${data.to}/${rel}`,
          content: fs.readFileSync(path.join(from, rel)),
        });
      }
    } else {
      entries.push({ rel: `${BUNDLE_DEST}/${data.to}`, content: fs.readFileSync(from) });
    }
  }

  // The launcher is deliberately NOT bundled. It is a *committed* file in each
  // skill (kept in step by sync-shared), because that is what makes a skill work
  // when a generic file copier installs it. Copying it again here produced two
  // different contents for one path — the committed copy carries a provenance
  // marker — and the installer's conflict detector rejected the install outright.
  // One file, one source.

  return entries;
}

/** True if any skill carries the bundled engine (used to gate doctor's deep check). */
export function packHasBundles() {
  return Object.keys(BUNDLE_MANIFEST).length > 0;
}

/**
 * Verify the bundled engine RUNS from its own directory, under the Node that will
 * run it.
 *
 * Copying files correctly is not the same as the result working: a missing data file
 * only surfaces when the code reads it. So this executes a real command whose whole
 * path touches the runtime data — `classify` exercises the taxonomy, and the
 * diagnostics report validates against the bundled internal schemas.
 */
export function verifyEngine({ libDir }) {
  const cli = path.join(libDir, 'bin', 'qa-engine.mjs');
  if (!fs.existsSync(cli)) {
    return { ok: false, stderr: `bundled engine CLI missing at ${cli}` };
  }
  const probe = spawnSync(process.execPath, [cli, 'analysis', 'classify', 'no such element: #cart'], {
    encoding: 'utf8',
  });
  if (probe.status !== 0) {
    return { ok: false, stderr: (probe.stderr || probe.stdout || '').trim() };
  }
  try {
    const parsed = JSON.parse(probe.stdout);
    if (parsed.classification !== 'locator-failure') {
      return { ok: false, stderr: `engine classified a missing element as ${parsed.classification}` };
    }
  } catch (error) {
    return { ok: false, stderr: `engine did not emit JSON: ${error.message}` };
  }
  return { ok: true, stderr: '' };
}
