// What the pack ships: the set of skills, the files inside each, and which
// skills carry bundled deterministic tooling. This manifest deliberately
// mirrors scripts/bundle_python.py — the two must agree, and a test asserts it.

import fs from 'node:fs';
import path from 'node:path';
import { listFilesRelative } from './paths.mjs';

// Skills that run deterministic tooling in the consumer's repository. The
// bundle is materialized at install time, never shipped pre-built.
// qa-review is knowledge-only and bundles nothing.
//
//   packages — importable directories
//   modules  — single-file framework adapters, bundled flat
export const BUNDLE_MANIFEST = Object.freeze({
  'qa-init': Object.freeze({ packages: ['qa_analysis'], modules: [] }),
  'qa-run': Object.freeze({ packages: ['qa_analysis'], modules: ['playwright_analysis'] }),
  'qa-debug': Object.freeze({ packages: ['qa_analysis', 'qa_diagnostics'], modules: ['playwright_analysis'] }),
  'qa-fix': Object.freeze({ packages: ['qa_analysis', 'qa_diagnostics'], modules: [] }),
  'qa-report': Object.freeze({ packages: ['qa_analysis', 'qa_diagnostics'], modules: [] }),
  // qa-explore renders its HTML report with qa_analysis.report_html rather than
  // typing it, so every required finding field reaches the page.
  'qa-explore': Object.freeze({ packages: ['qa_analysis'], modules: [] }),
  'qa-flaky': Object.freeze({ packages: ['qa_analysis', 'qa_diagnostics'], modules: [] }),
  'qa-api': Object.freeze({ packages: ['qa_analysis', 'qa_diagnostics'], modules: [] }),
  'qa-audit': Object.freeze({ packages: ['qa_analysis', 'qa_diagnostics'], modules: [] }),
});

// Canonical source of each bundled package, relative to the pack root.
export const BUNDLE_SOURCES = Object.freeze({
  qa_analysis: 'shared/analysis/lib/qa_analysis',
  qa_diagnostics: 'shared/diagnostics/lib/qa_diagnostics',
});

// Non-Python files a bundled package reads at runtime, relative to the pack
// root and to the package directory. The diagnostics engine validates every
// diagnosis against its internal schemas, so without these it cannot run.
export const BUNDLE_PACKAGE_DATA = Object.freeze({
  // The context CLI validates .qa/context.md against the context contract.
  qa_analysis: Object.freeze([
    Object.freeze({ from: 'shared/analysis/schemas', to: 'schemas' }),
  ]),
  qa_diagnostics: Object.freeze([
    Object.freeze({ from: 'shared/diagnostics/schemas/internal', to: 'schemas/internal' }),
  ]),
});

// Canonical source of each bundled single-file module.
export const BUNDLE_MODULE_SOURCES = Object.freeze({
  playwright_analysis: 'shared/frameworks/playwright/lib/playwright_analysis.py',
});

// The launcher every bundling skill carries, one level above lib/. It resolves
// its own lib/ path, so the documented invocation needs no shell features and
// works identically in PowerShell and cmd.exe.
export const BUNDLE_LAUNCHER = Object.freeze({
  from: 'shared/tooling/qa_tool.py',
  to: 'scripts/qa_tool.py',
});

// Where bundled code lands inside an installed skill.
export const BUNDLE_DEST = 'scripts/lib';

/** Package names bundled into a skill (empty array when it bundles nothing). */
export function bundlePackagesForSkill(skill) {
  return BUNDLE_MANIFEST[skill]?.packages ?? [];
}

/** Module names bundled into a skill. */
export function bundleModulesForSkill(skill) {
  return BUNDLE_MANIFEST[skill]?.modules ?? [];
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
 * Files that make up a skill, relative to the skill directory. Excludes the
 * bundled tooling (scripts/lib): it is a generated artifact produced by the
 * bundle step at install time, not copied from source.
 */
export function skillFiles(sourceRoot, skill) {
  const dir = path.join(sourceRoot, 'skills', skill);
  return listFilesRelative(dir).filter((rel) => !rel.startsWith(`${BUNDLE_DEST}/`));
}
