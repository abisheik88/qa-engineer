// What the pack ships: the set of skills, the files inside each, and which skills
// carry the bundled deterministic engine.

import fs from 'node:fs';
import path from 'node:path';
import { listFilesRelative } from './paths.mjs';

// Every bundling skill carries the same payload, named once so the map below reads
// as the list of skills it is.
const ENGINE = Object.freeze({ engine: true });

// Skills that run the deterministic engine in the consumer's repository. The
// bundle is materialized at install time, never shipped pre-built.
//
// Every one of them bundles the same thing now. Under the Python engine this was a
// per-skill list of packages and single-file adapters, because a skill that never
// touched a Playwright trace had no reason to carry the adapter. The Node engine is
// one package of about 3,000 lines with no dependencies, so splitting it would save
// nothing measurable and would give nine skills nine slightly different bundles to
// go wrong in. qa-review, qa-generate, qa-example and the qa router remain
// knowledge-only and bundle nothing.
export const BUNDLE_MANIFEST = Object.freeze({
  'qa-init': ENGINE,
  'qa-run': ENGINE,
  'qa-debug': ENGINE,
  'qa-fix': ENGINE,
  'qa-report': ENGINE,
  'qa-flaky': ENGINE,
  'qa-api': ENGINE,
  'qa-audit': ENGINE,
  'qa-explore': ENGINE,
});

// The engine, copied wholesale: `lib/` for the modules and `bin/` for the CLI the
// launcher executes.
export const ENGINE_SOURCE = 'packages/engine';

// The engine keeps the non-code files it reads at runtime — the context contract,
// the internal seam schemas, the branding metadata — inside its own lib/, so a
// wholesale copy of the engine directory is a complete engine. Nothing to enumerate
// here, and no second place for a data file to be forgotten.
export const ENGINE_DATA = Object.freeze([]);

// The launcher every bundling skill carries, one level above lib/.
//
// It is a *committed* file in each skill rather than something the installer
// generates — `node scripts/sync-shared.mjs --write` refreshes the copies and
// `--check` fails on drift. That is what lets a generic file copier (`npx skills
// add`, or a plain `git clone`) produce a working skill without running this
// installer at all. Consequently the bundler does not copy it: two sources for one
// destination path is a conflict, and the installer is right to refuse it.
export const BUNDLE_LAUNCHER = Object.freeze({
  from: 'shared/tooling/qa-tool.mjs',
  to: 'scripts/qa-tool.mjs',
});

// Where the bundled engine lands inside an installed skill.
export const BUNDLE_DEST = 'scripts/lib';

/** True when this skill bundles the engine. */
export function bundlesEngine(skill) {
  return Object.prototype.hasOwnProperty.call(BUNDLE_MANIFEST, skill);
}

/** All skill names shipped by the pack (directories under skills/). */
export function listSkills(sourceRoot) {
  const base = path.join(sourceRoot, 'skills');
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/**
 * Files that make up a skill, relative to the skill directory. Excludes the bundled
 * engine (scripts/lib): it is a generated artifact produced by the bundle step at
 * install time, not copied from source.
 */
export function skillFiles(sourceRoot, skill) {
  const dir = path.join(sourceRoot, 'skills', skill);
  return listFilesRelative(dir).filter((rel) => !rel.startsWith(`${BUNDLE_DEST}/`));
}
