// Post-install validation shared by install, onboard, self-test, and doctor.

import fs from 'node:fs';
import path from 'node:path';
import { LOCKFILE, SHARED_SKILLS_DIR, CLAUDE_SKILLS_DIR } from '../constants.mjs';
import { readLock } from './lockfile.mjs';
import { entryDigest } from './integrity.mjs';
import { verifyEngine, packHasBundles } from './bundle.mjs';
import { BUNDLE_DEST, BUNDLE_MANIFEST } from './manifest.mjs';

/**
 * @typedef {{ id: string, ok: boolean, hard: boolean, message: string, hint?: string }} CheckResult
 */

/**
 * Validate an installed project. Does not throw — returns structured checks.
 * @param {string} projectRoot
 * @returns {{ ok: boolean, checks: CheckResult[] }}
 */
export function validateInstall(projectRoot, { scope = null } = {}) {
  /** @type {CheckResult[]} */
  const checks = [];

  const lockRelative = scope?.lockfile ?? LOCKFILE;
  const lock = readLock(projectRoot, lockRelative);
  if (!lock) {
    checks.push({
      id: 'lockfile',
      ok: false,
      hard: true,
      message: `${lockRelative} missing`,
      hint: 'run: qa install',
    });
    return { ok: false, checks };
  }

  checks.push({
    id: 'lockfile',
    ok: true,
    hard: true,
    message: `${lockRelative} present (${lock.files.length} files, pack ${lock.pack?.version ?? '?'})`,
  });

  let drift = 0;
  for (const entry of lock.files) {
    if (entryDigest(projectRoot, entry) !== entry.sha256) drift += 1;
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

  // Where the engine should be depends on how it was installed: a shared scope has
  // exactly one copy in its qaRoot, a project install has one inside each bundling
  // skill. Looking only for the second is what made the first report a broken install.
  const sharedScope = scope?.shareEngine || lock.scope?.sharedEngine;
  if (sharedScope) {
    const qaRootRelative = scope?.qaRootRelative ?? lock.scope?.qaRoot ?? '.';
    const libDir = path.join(projectRoot, qaRootRelative, 'engine');
    const bundleOk = fs.existsSync(path.join(libDir, 'bin', 'qa-engine.mjs'));
    checks.push({
      id: 'engine',
      ok: bundleOk,
      hard: true,
      message: bundleOk
        ? `deterministic engine shared at ${path.relative(projectRoot, libDir) || '.'}`
        : 'shared deterministic engine missing',
      hint: bundleOk ? undefined : 'run: qa repair',
    });
    if (bundleOk) {
      const result = verifyEngine({ libDir });
      checks.push({
        id: 'engine-runs',
        ok: result.ok,
        hard: true,
        message: result.ok
          ? `shared engine runs (node ${process.versions.node})`
          : `shared engine failed to run: ${result.stderr || 'unknown error'}`,
        hint: result.ok ? undefined : 'run: qa repair',
      });
    }
  } else if (packHasBundles()) {
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

    // The engine runs under the Node that is already here — no second runtime to
    // find, and nothing to skip when it is absent.
    if (bundleOk) {
      const result = verifyEngine({ libDir });
      checks.push({
        id: 'engine-runs',
        ok: result.ok,
        hard: true,
        message: result.ok
          ? `bundled engine runs (node ${process.versions.node})`
          : `bundled engine failed to run: ${result.stderr || 'unknown error'}`,
        hint: result.ok ? undefined : 'run: qa repair',
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
