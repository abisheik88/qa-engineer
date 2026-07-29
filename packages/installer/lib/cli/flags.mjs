// Shared CLI flag parsing helpers for installer commands.

import { usageError } from '../core/errors.mjs';

/**
 * Parse common flags from argv. Unknown tokens are returned in `rest` unless
 * `strict` is true (then they throw).
 *
 * @param {string[]} argv
 * @param {{ strict?: boolean }} [opts]
 */
export function parseCommonFlags(argv, { strict = true } = {}) {
  const flags = {
    yes: false,
    ci: false,
    json: false,
    debug: false,
    force: false,
    dryRun: false,
    help: false,
    project: null,
    global: false,
    workspace: false,
    allAgents: false,
    agents: [],
    rest: /** @type {string[]} */ ([]),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--yes' || a === '-y') flags.yes = true;
    else if (a === '--ci') {
      flags.ci = true;
      flags.yes = true;
    } else if (a === '--json') flags.json = true;
    else if (a === '--debug') flags.debug = true;
    else if (a === '--force') flags.force = true;
    else if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--help' || a === '-h') flags.help = true;
    else if (a === '--agent' || a === '-a') {
      const id = argv[++i];
      if (!id) throw usageError('--agent requires an id');
      flags.agents.push(id);
    } else if (a === '--global' || a === '-g') {
      flags.global = true;
    } else if (a === '--workspace' || a === '-w') {
      flags.workspace = true;
    } else if (a === '--all-agents') {
      flags.allAgents = true;
    } else if (a === '--project' || a === '-C') {
      // `--project` doubles as a scope selector and as a path. Bare, it means "this
      // directory"; with a value it names one. Requiring a path made `--project` alone
      // an error while `--global` alone worked, which reads as an inconsistency rather
      // than as a rule.
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        flags.project = next;
        i += 1;
      } else {
        flags.project = '.';
      }
    } else if (strict) {
      throw usageError(`unknown option: ${a}`);
    } else {
      flags.rest.push(a);
    }
  }

  if (process.env.CI === 'true' || process.env.CI === '1') {
    flags.ci = true;
    flags.yes = true;
  }
  if (process.env.QA_DEBUG === '1' || process.env.QA_DEBUG === 'true') {
    flags.debug = true;
  }

  return flags;
}

export function wantsNonInteractive(flags) {
  return Boolean(flags.yes || flags.ci || !process.stdin.isTTY || !process.stdout.isTTY);
}
