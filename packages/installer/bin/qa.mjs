#!/usr/bin/env node
// qa-engineer CLI entry.

import { EXIT } from '../lib/constants.mjs';
import { VERSION } from '../lib/version.mjs';
import { QaError } from '../lib/core/errors.mjs';
import { createLogger } from '../lib/core/logger.mjs';
import { runInstall } from '../lib/commands/install.mjs';
import { runVerify } from '../lib/commands/verify.mjs';
import { runDoctor } from '../lib/commands/doctor.mjs';
import { runOnboard } from '../lib/commands/onboard.mjs';
import { runSelfTest } from '../lib/commands/self-test.mjs';
import { runRepair } from '../lib/commands/repair.mjs';
import { runUpdate } from '../lib/commands/update.mjs';
import { runUninstall } from '../lib/commands/uninstall.mjs';
import { listAgentIds } from '../lib/agents/registry.mjs';
import { COMMANDS, ACCEPTED } from '../lib/cli/commands.mjs';
import { formatUserError } from '../lib/ui/theme.mjs';

const debug =
  process.env.QA_DEBUG === '1' ||
  process.env.QA_DEBUG === 'true' ||
  process.argv.includes('--debug');

const log = createLogger({ level: process.env.QA_LOG_LEVEL || 'info' });

function printHelp() {
  const commandLines = COMMANDS.map((c) => `  ${c.name.padEnd(10)} ${c.summary}`).join('\n');
  log.result(`qa-engineer ${VERSION}

Usage:
  qa                  Interactive install + guided first-run
  qa <command> [options]

Commands:
${commandLines}

Common options:
  --project <d>  Project root (default: cwd)
  --agent <id>   Target agent (repeatable). Known: ${listAgentIds().join(', ')}
  --yes / --ci   Skip prompts
  --json         Machine-readable stdout
  --force        Overwrite conflicting files
  --dry-run      Plan without writing
  --debug        Show stack traces on unexpected errors

Skills install into .agents/skills/ (most agents) and .claude/skills/
(Claude Code).`);
}

function resolveCommand(argv) {
  const first = argv[0];
  const commands = new Set(ACCEPTED);

  if (!first) {
    // Bare `qa`: interactive onboard on TTY; help otherwise.
    if (process.stdin.isTTY && process.stdout.isTTY) return { cmd: 'onboard', rest: [] };
    return { cmd: 'help-non-tty', rest: [] };
  }

  if (commands.has(first)) {
    return { cmd: first, rest: argv.slice(1) };
  }

  // Flags without a command → onboard with those flags (e.g. qa --yes --project .)
  if (first.startsWith('-')) {
    return { cmd: 'onboard', rest: argv };
  }

  return { cmd: 'unknown', rest: argv };
}

async function main() {
  const argv = process.argv.slice(2);
  const { cmd, rest } = resolveCommand(argv);

  try {
    let code = EXIT.OK;
    switch (cmd) {
      case 'onboard':
        code = await runOnboard(rest, { log });
        break;
      case 'install':
        code = await runInstall(rest, { log });
        break;
      case 'verify':
        code = await runVerify(rest, { log });
        break;
      case 'doctor':
        code = await runDoctor(rest, { log });
        break;
      case 'self-test':
        code = await runSelfTest(rest, { log });
        break;
      case 'repair':
        code = await runRepair(rest, { log });
        break;
      case 'update':
        code = await runUpdate(rest, { log });
        break;
      case 'uninstall':
        code = await runUninstall(rest, { log });
        break;
      case 'version':
      case '--version':
      case '-V':
        log.result(VERSION);
        break;
      case 'help':
      case '--help':
      case '-h':
        printHelp();
        break;
      case 'help-non-tty':
        printHelp();
        code = EXIT.USAGE;
        break;
      case 'unknown':
      default:
        log.error(`unknown command: ${argv[0]}`);
        printHelp();
        code = EXIT.USAGE;
    }
    process.exitCode = code;
  } catch (error) {
    if (error instanceof QaError) {
      log.error(formatUserError(error, { debug }));
      process.exitCode = error.code ?? EXIT.FAILURE;
    } else {
      log.error(formatUserError(error, { debug: true }));
      process.exitCode = EXIT.FAILURE;
    }
  }
}

main();
