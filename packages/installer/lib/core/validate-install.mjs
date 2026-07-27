// Post-install validation shared by install, onboard, self-test, and doctor.

import fs from 'node:fs';
import path from 'node:path';
import { LOCKFILE, SHARED_SKILLS_DIR, CLAUDE_SKILLS_DIR } from '../constants.mjs';
import { readLock } from './lockfile.mjs';
import { hashFile } from './hash.mjs';
import { findPython, verifyImports, packHasBundles } from './bundle.mjs';
import { BUNDLE_DEST, BUNDLE_MANIFEST, bundlePackagesForSkill } from './manifest.mjs';

/**
 * @typedef {{ id: string, ok: boolean, hard: boolean, message: string, hint?: string }} CheckResult
 */

/**
 * Validate an installed project. Does not throw — returns structured checks.
 * @param {string} projectRoot
 * @returns {{ ok: boolean, checks: CheckResult[] }}
 */
export function validateInstall(projectRoot) {
  /** @type {CheckResult[]} */
  const checks = [];

  const lock = readLock(projectRoot);
  if (!lock) {
    checks.push({
      id: 'lockfile',
      ok: false,
      hard: true,
      message: `${LOCKFILE} missing`,
      hint: 'run: qa install',
    });
    return { ok: false, checks };
  }

  checks.push({
    id: 'lockfile',
    ok: true,
    hard: true,
    message: `${LOCKFILE} present (${lock.files.length} files, pack ${lock.pack?.version ?? '?'})`,
  });

  let drift = 0;
  for (const entry of lock.files) {
    const abs = path.join(projectRoot, entry.path);
    if (!fs.existsSync(abs)) {
      drift += 1;
      continue;
    }
    if (hashFile(abs) !== entry.sha256) drift += 1;
  }
  checks.push({
    id: 'integrity',
    ok: drift === 0,
    hard: true,
    message: drift === 0 ? 'all installed files match lockfile hashes' : `${drift} file(s) missing or drifted`,
    hint: drift === 0 ? undefined : 'run: qa repair',
  });

  const skillDirs = [SHARED_SKILLS_DIR, CLAUDE_SKILLS_DIR]
    .map((d) => path.join(projectRoot, d))
    .filter((d) => fs.existsSync(d));

  let skillCount = 0;
  let contractCount = 0;
  for (const dir of skillDirs) {
    for (const name of fs.readdirSync(dir)) {
      const skillMd = path.join(dir, name, 'SKILL.md');
      if (fs.existsSync(skillMd)) skillCount += 1;
      const contracts = path.join(dir, name, 'contracts');
      if (fs.existsSync(contracts)) {
        contractCount += fs.readdirSync(contracts).filter((f) => f.endsWith('.json')).length;
      }
    }
  }

  checks.push({
    id: 'skills',
    ok: skillCount > 0,
    hard: true,
    message: skillCount > 0 ? `${skillCount} skill(s) installed` : 'no skills found under discovery paths',
    hint: skillCount > 0 ? undefined : 'run: qa install',
  });

  checks.push({
    id: 'contracts',
    ok: contractCount > 0,
    hard: false,
    message:
      contractCount > 0
        ? `${contractCount} contract schema(s) present`
        : 'no contract schemas found (optional for minimal installs)',
  });

  if (packHasBundles()) {
    const bundledSkill = Object.keys(BUNDLE_MANIFEST)[0];
    let libDir = null;
    for (const base of [SHARED_SKILLS_DIR, CLAUDE_SKILLS_DIR]) {
      const candidate = path.join(projectRoot, base, bundledSkill, BUNDLE_DEST);
      if (fs.existsSync(candidate)) {
        libDir = candidate;
        break;
      }
    }

    const bundleOk = Boolean(libDir);
    checks.push({
      id: 'engine',
      ok: bundleOk,
      hard: true,
      message: bundleOk
        ? `deterministic engine bundled under ${path.relative(projectRoot, libDir)}`
        : 'deterministic engine bundle missing',
      hint: bundleOk ? undefined : 'run: qa repair',
    });

    const python = findPython();
    if (bundleOk && python) {
      const packages = bundlePackagesForSkill(bundledSkill);
      const result = verifyImports({ pythonBin: python.bin, libDir, packages });
      checks.push({
        id: 'python-imports',
        ok: result.ok,
        hard: false,
        message: result.ok
          ? `Python imports OK (${python.bin} ${python.version})`
          : `Python import check failed: ${result.stderr || 'unknown error'}`,
        hint: result.ok ? undefined : 'install Python 3.8+ or run: qa doctor',
      });
    } else if (bundleOk && !python) {
      checks.push({
        id: 'python-imports',
        ok: false,
        hard: false,
        message: 'Python not found — analysis engine import check skipped',
        hint: 'install Python 3.8+ for full diagnostics',
      });
    }
  }

  const major = Number(process.versions.node.split('.')[0]);
  checks.push({
    id: 'node',
    ok: major >= 18,
    hard: true,
    message: `Node ${process.version}`,
    hint: major >= 18 ? undefined : 'upgrade to Node.js 18.18+',
  });

  const ok = checks.filter((c) => c.hard).every((c) => c.ok);
  return { ok, checks };
}
