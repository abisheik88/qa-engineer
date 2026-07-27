// A tiny leveled logger. Human-readable progress and diagnostics go to stderr
// so that stdout carries only a command's primary result (often JSON), keeping
// the CLI pipeable. Colour is used only when stderr is a TTY.

const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

const COLOR = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
};

export function createLogger({ level = 'info', color = process.stderr.isTTY } = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;
  const paint = (c, s) => (color ? `${c}${s}${COLOR.reset}` : s);
  const at = (name) => LEVELS[name] <= threshold;

  return {
    level,
    error(msg) {
      if (at('error')) process.stderr.write(`${paint(COLOR.red, 'error')} ${msg}\n`);
    },
    warn(msg) {
      if (at('warn')) process.stderr.write(`${paint(COLOR.yellow, 'warn')}  ${msg}\n`);
    },
    info(msg) {
      if (at('info')) process.stderr.write(`${msg}\n`);
    },
    step(msg) {
      if (at('info')) process.stderr.write(`${paint(COLOR.cyan, '›')} ${msg}\n`);
    },
    ok(msg) {
      if (at('info')) process.stderr.write(`${paint(COLOR.green, '✓')} ${msg}\n`);
    },
    debug(msg) {
      if (at('debug')) process.stderr.write(`${paint(COLOR.dim, `· ${msg}`)}\n`);
    },
    // Primary machine-readable output belongs on stdout.
    result(value) {
      process.stdout.write(typeof value === 'string' ? `${value}\n` : `${JSON.stringify(value, null, 2)}\n`);
    },
  };
}
