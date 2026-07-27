// Bundling deterministic tooling, integrated into installation. Skills that run
// a Python engine need that engine to travel with them (self-containment). The
// installer materializes it by COPYING the canonical code from shared/ into the
// installed skill's scripts/lib/ — a pure file copy, no code executed at install
// time, honoring the SECURITY.md guarantee. This mirrors what
// scripts/bundle_python.py does for repository development; users never run it.
//
// Deep verification (that the bundle *runs* under the user's interpreter)
// requires running Python and therefore lives in `qa doctor`, an explicit,
// user-invoked diagnostic — never in the install path.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  BUNDLE_MANIFEST,
  BUNDLE_SOURCES,
  BUNDLE_PACKAGE_DATA,
  BUNDLE_MODULE_SOURCES,
  BUNDLE_DEST,
} from './manifest.mjs';
import { listFilesRelative } from './paths.mjs';

/** Bundle file entries for one skill, relative to the skill directory. */
export function bundleFilesForSkill(sourceRoot, skill) {
  const entry = BUNDLE_MANIFEST[skill];
  if (!entry) return [];
  const entries = [];

  for (const pkg of entry.packages) {
    const src = path.join(sourceRoot, BUNDLE_SOURCES[pkg]);
    if (!fs.existsSync(src)) {
      throw new Error(`bundled package source missing: ${BUNDLE_SOURCES[pkg]} (needed by ${skill})`);
    }
    for (const rel of listFilesRelative(src)) {
      entries.push({
        rel: `${BUNDLE_DEST}/${pkg}/${rel}`,
        content: fs.readFileSync(path.join(src, rel)),
      });
    }
    // Package data the code reads at runtime (internal schemas). Without these
    // the diagnostics engine raises on every diagnosis.
    for (const data of BUNDLE_PACKAGE_DATA[pkg] ?? []) {
      const dataSrc = path.join(sourceRoot, data.from);
      if (!fs.existsSync(dataSrc)) {
        throw new Error(`bundled package data missing: ${data.from} (needed by ${skill})`);
      }
      for (const rel of listFilesRelative(dataSrc)) {
        entries.push({
          rel: `${BUNDLE_DEST}/${pkg}/${data.to}/${rel}`,
          content: fs.readFileSync(path.join(dataSrc, rel)),
        });
      }
    }
  }

  for (const mod of entry.modules) {
    const src = path.join(sourceRoot, BUNDLE_MODULE_SOURCES[mod]);
    if (!fs.existsSync(src)) {
      throw new Error(`bundled module source missing: ${BUNDLE_MODULE_SOURCES[mod]} (needed by ${skill})`);
    }
    entries.push({
      rel: `${BUNDLE_DEST}/${path.basename(src)}`,
      content: fs.readFileSync(src),
    });
  }

  return entries;
}

/** True if any skill carries bundled tooling (used to gate doctor's deep check). */
export function packHasBundles() {
  return Object.keys(BUNDLE_MANIFEST).length > 0;
}

/** Locate a Python 3 interpreter, or null. Used only by doctor. */
export function findPython() {
  for (const candidate of ['python3', 'python']) {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0) {
      const version = (probe.stdout || probe.stderr).trim();
      return { bin: candidate, version };
    }
  }
  return null;
}

// Runs inside the bundle with only the bundle on PYTHONPATH. Importing is not
// enough: a missing data file only surfaces when the engine actually runs, which
// is exactly the failure this check exists to catch.
const SMOKE = `
import json, sys
names = json.loads(sys.argv[1])
for name in names:
    __import__(name)
if "qa_diagnostics" in names:
    from qa_diagnostics import engine
    diagnosis = engine.diagnose({
        "tests": {"total": 1, "passed": 0, "failed": 1, "skipped": 0},
        "executed": [{"title": "t", "status": "failed", "message": "no such element: #cart",
                      "file": "t.spec.ts", "retries": 0}],
    })
    assert diagnosis["entries"], "engine produced no diagnosis entries"
`;

/**
 * Verify bundled tooling RUNS using ONLY its own directory on PYTHONPATH —
 * proving self-containment under the user's interpreter. Doctor-only.
 */
export function verifyImports({ pythonBin, libDir, packages }) {
  const result = spawnSync(pythonBin, ['-c', SMOKE, JSON.stringify(packages)], {
    env: { PYTHONPATH: libDir, PATH: process.env.PATH ?? '' },
    encoding: 'utf8',
  });
  return { ok: result.status === 0, stderr: (result.stderr ?? '').trim() };
}
