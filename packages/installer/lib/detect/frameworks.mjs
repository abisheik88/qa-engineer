// Detect test frameworks and languages. Framework identity comes from the
// canonical registry (shared/frameworks/registry.json) — do not hard-code
// framework lists here.

import fs from 'node:fs';
import path from 'node:path';
import { listFrameworks } from '../../../../shared/frameworks/registry.mjs';

function readPackageJson(root) {
  const p = path.join(root, 'package.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function depsOf(pkg) {
  if (!pkg) return new Set();
  return new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ]);
}

function anyExists(root, names) {
  return names.some((n) => fs.existsSync(path.join(root, n)));
}

function hasConfigPrefix(root, prefixes) {
  if (!prefixes.length || !fs.existsSync(root)) return false;
  const entries = fs.readdirSync(root);
  return prefixes.some((prefix) => entries.some((name) => name.startsWith(prefix)));
}

function hasPythonMarkers(root) {
  return anyExists(root, [
    'requirements.txt',
    'pyproject.toml',
    'setup.py',
    'Pipfile',
    'pytest.ini',
  ]);
}

function detectOne(root, fw, deps) {
  const d = fw.detection;
  if (d.configFiles.length && anyExists(root, d.configFiles)) return true;
  if (d.configPrefixes.length && hasConfigPrefix(root, d.configPrefixes)) return true;
  if (d.dependencies.some((name) => deps.has(name))) return true;
  if (d.directories.some((dir) => fs.existsSync(path.join(root, dir)))) return true;
  return false;
}

/**
 * @param {string} projectRoot
 * @returns {{
 *   frameworks: string[],
 *   languages: string[],
 *   details: Record<string, boolean>,
 * }}
 */
export function detectFrameworks(projectRoot) {
  const pkg = readPackageJson(projectRoot);
  const deps = depsOf(pkg);
  const registry = listFrameworks().filter((f) => f.supportLevel !== 'Planning');

  /** @type {Record<string, boolean>} */
  const details = {};
  const frameworks = [];
  for (const fw of registry) {
    const hit = detectOne(projectRoot, fw, deps);
    details[fw.id] = hit;
    if (hit) frameworks.push(fw.id);
  }

  const typescript =
    anyExists(projectRoot, ['tsconfig.json', 'tsconfig.base.json']) || deps.has('typescript');
  const javascript = Boolean(pkg) || anyExists(projectRoot, ['jsconfig.json']);
  const python = hasPythonMarkers(projectRoot);

  const languages = [];
  if (typescript) languages.push('typescript');
  else if (javascript) languages.push('javascript');
  if (python) languages.push('python');

  details.typescript = typescript;
  details.javascript = javascript;
  details.python = python;

  return { frameworks, languages, details };
}
