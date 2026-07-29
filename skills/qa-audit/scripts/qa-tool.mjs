// synced-from: shared/tooling/qa-tool.mjs — do not edit; edit the source and run: node scripts/sync-shared.mjs --write
// The launcher every skill invokes to reach the deterministic engine.
//
// A skill's SKILL.md documents exactly one command shape:
//
//     node <SKILL_DIR>/scripts/qa-tool.mjs <tool> <subcommand> [args]
//
// and this file finds the engine, wherever it happens to be. That indirection
// exists because the pack is installed three different ways and the engine lands in
// a different place each time:
//
//   1. `qa install` bundles the engine into the skill, at ./lib/. Offline, fastest,
//      and pinned to the version that was installed.
//   2. `npx skills add <owner>/<repo>` — or any generic file copier — copies the
//      skill directory out of git and bundles nothing. The engine is then resolved
//      from node_modules if the project happens to depend on the pack.
//   3. Neither: fall back to `npx qa-engineer`, which fetches the published package
//      on first use and is served from the npm cache afterwards.
//
// Because this file is committed rather than generated, path 2 works at all — which
// is what makes the pack installable by the wider Agent Skills ecosystem. The
// command a skill runs never changes; only where the engine came from does.
//
// Exit codes pass through unchanged: 0 success, 1 an invalid contract, 2 unreadable
// input or bad usage.
//
// No shebang: the synced copies carry a provenance marker on line one, which would
// sit above it and stop the kernel seeing it anyway. Every documented invocation is
// `node qa-tool.mjs …`, which needs none.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const USAGE = `usage: node qa-tool.mjs <tool> <subcommand> [args]

  analysis     parse artifacts, classify errors, validate contracts, diff-guard,
              read .qa/context.md, render an HTML report, print the footer
  diagnostics  root cause, timeline, priority, repair plans, release readiness
  playwright   normalize a Playwright report or summarize a trace

  --where      print how the engine was resolved, and stop

examples:
  node qa-tool.mjs analysis junit test-results/results.xml
  node qa-tool.mjs analysis report-html qa-artifacts/explore-result.json --out report.html
  node qa-tool.mjs diagnostics report --execution-result qa-artifacts/run.json
`;

/**
 * Where the engine is, and how we found it.
 *
 * Ordered by cost: a bundled copy needs no resolution and no network, a shared copy
 * needs one stat per ancestor, a node_modules copy needs no network, and npx needs both
 * on first use. Reporting *which* one answered matters when a skill degrades — "the
 * engine is missing" and "the engine is being fetched" are different problems.
 *
 * The shared lookup is what lets one skill directory serve a project, a workspace, and a
 * machine-wide install without knowing which installed it. Walking up for
 * `.qa-engineer/engine` finds a workspace install from a skill inside the repository,
 * and finds a global install from a skill linked into an agent's user-level directory —
 * `~/.claude/skills/qa-explore` walks up to `~`, where `~/.qa-engineer/engine` is.
 */
function resolveEngine() {
  const bundled = path.join(here, 'lib', 'bin', 'qa-engine.mjs');
  if (fs.existsSync(bundled)) return { kind: 'bundled', command: [process.execPath, bundled] };

  for (const root of candidateSharedRoots()) {
    const shared = path.join(root, 'bin', 'qa-engine.mjs');
    if (fs.existsSync(shared)) return { kind: 'shared', command: [process.execPath, shared] };
  }

  for (const base of candidateModuleRoots()) {
    const installed = path.join(base, 'qa-engineer', 'packages', 'engine', 'bin', 'qa-engine.mjs');
    if (fs.existsSync(installed)) {
      return { kind: 'node_modules', command: [process.execPath, installed] };
    }
  }

  return {
    kind: 'npx',
    command: [npxCommand(), '--yes', 'qa-engineer', 'engine'],
  };
}

/** Shared engine directories worth checking, most specific first. */
function candidateSharedRoots() {
  const roots = [];

  // An explicit home wins over anything discovered, so a user who moved the install can
  // rely on it rather than on whatever the walk happens to find first.
  const override = process.env.QA_ENGINEER_HOME;
  if (override && override.trim()) roots.push(path.join(path.resolve(override.trim()), 'engine'));

  let dir = here;
  for (let depth = 0; depth < 12; depth += 1) {
    roots.push(path.join(dir, '.qa-engineer', 'engine'));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // The default machine home, for the case where the skill lives outside it entirely.
  const home = os.homedir();
  if (home) roots.push(path.join(home, '.qa-engineer', 'engine'));

  return roots;
}

/** node_modules directories worth checking, nearest first. */
function candidateModuleRoots() {
  const roots = [];
  let dir = here;
  for (let depth = 0; depth < 12; depth += 1) {
    roots.push(path.join(dir, 'node_modules'));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (process.cwd() !== here) roots.push(path.join(process.cwd(), 'node_modules'));
  return roots;
}

// `npx` is a shell script on POSIX and a .cmd shim on Windows; spawnSync needs the
// exact name, and `shell: true` would put user-supplied arguments through a shell.
function npxCommand() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

function main(argv) {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    process.stdout.write(USAGE);
    return argv.length === 0 ? 2 : 0;
  }

  const engine = resolveEngine();

  if (argv[0] === '--where') {
    process.stdout.write(`${JSON.stringify({ resolved: engine.kind, command: engine.command }, null, 2)}\n`);
    return 0;
  }

  const [program, ...prefix] = engine.command;
  const run = spawnSync(program, [...prefix, ...argv], { stdio: 'inherit' });

  if (run.error) {
    // Say which path was tried and what to do, because a skill's fallback prose
    // cannot diagnose this and the user is the one who has to fix it.
    const advice = engine.kind === 'npx'
      ? 'the engine is not bundled and npx is unavailable — run `npx qa-engineer install` in this project, or install Node 18+'
      : `could not execute ${program}`;
    process.stderr.write(`qa-tool: ${advice}\n${run.error.message}\n`);
    return 2;
  }
  return run.status ?? 2;
}

process.exitCode = main(process.argv.slice(2));
