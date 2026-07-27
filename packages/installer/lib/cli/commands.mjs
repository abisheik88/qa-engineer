// The CLI's command surface, declared once.
//
// bin/qa.mjs dispatches on this list, `help` prints from it, and
// scripts/check-docs-commands.mjs holds the documentation to it — so a command
// cannot ship undocumented, and the docs cannot name a command that does not
// exist. (`uninstall` shipped only after being documented in fs-safe.mjs but
// never implemented; this is the check that would have caught it.)

/** @type {Array<{name: string, summary: string}>} */
export const COMMANDS = Object.freeze([
  { name: 'onboard', summary: 'Interactive installer (default when no command is given)' },
  { name: 'install', summary: 'Non-interactive install into Agent Skills paths' },
  { name: 'verify', summary: 'Check installed files against qa-lock.json' },
  { name: 'doctor', summary: 'Diagnose environment and installation' },
  { name: 'self-test', summary: 'PASS/FAIL smoke checks for the installed pack' },
  { name: 'repair', summary: 'Fix drifted or missing pack files' },
  { name: 'update', summary: 'Refresh install from the current pack source' },
  { name: 'uninstall', summary: 'Remove every file listed in qa-lock.json' },
  { name: 'version', summary: 'Print pack version' },
  { name: 'help', summary: 'Show this help' },
]);

/** Aliases accepted in addition to the command names above. */
export const ALIASES = Object.freeze(['--version', '-V', '--help', '-h']);

export const COMMAND_NAMES = Object.freeze(COMMANDS.map((c) => c.name));

/** Every token `resolveCommand` accepts as a command. */
export const ACCEPTED = Object.freeze([...COMMAND_NAMES, ...ALIASES]);
