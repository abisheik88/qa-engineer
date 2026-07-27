// Detect OS, shell, git, and package manager for a project root.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

function hasGit(root) {
  if (fs.existsSync(path.join(root, '.git'))) return true;
  const probe = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: root,
    encoding: 'utf8',
  });
  return probe.status === 0 && (probe.stdout || '').trim() === 'true';
}

function detectPackageManager(root) {
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(root, 'bun.lockb')) || fs.existsSync(path.join(root, 'bun.lock'))) {
    return 'bun';
  }
  if (fs.existsSync(path.join(root, 'package-lock.json'))) return 'npm';
  if (fs.existsSync(path.join(root, 'package.json'))) return 'npm';
  return null;
}

function detectShell() {
  const shell = process.env.SHELL || process.env.ComSpec || '';
  if (!shell) return null;
  return path.basename(shell);
}

/**
 * @param {string} projectRoot
 * @returns {{
 *   os: string,
 *   platform: NodeJS.Platform,
 *   shell: string|null,
 *   git: boolean,
 *   packageManager: string|null,
 *   node: string,
 * }}
 */
export function detectEnvironment(projectRoot) {
  return {
    os: `${os.type()} ${os.release()}`,
    platform: process.platform,
    shell: detectShell(),
    git: hasGit(projectRoot),
    packageManager: detectPackageManager(projectRoot),
    node: process.version,
  };
}
