// Clack-based UX helpers. Human progress stays on stderr; machine JSON on stdout.

import * as p from '@clack/prompts';
import { createLogger } from '../core/logger.mjs';

export function isCancel(value) {
  return p.isCancel(value);
}

export function createUi({ quiet = false, json = false } = {}) {
  const log = createLogger({
    level: quiet || json ? 'error' : process.env.QA_LOG_LEVEL || 'info',
  });

  return {
    log,
    intro(message = 'Welcome to QA Engineer Pack') {
      if (quiet || json) return;
      p.intro(message);
    },
    outro(message) {
      if (quiet || json) return;
      p.outro(message);
    },
    note(message, title) {
      if (quiet || json) return;
      p.note(message, title);
    },
    logLine(message) {
      if (quiet || json) return;
      p.log.step(message);
    },
    success(message) {
      if (quiet || json) return;
      p.log.success(message);
    },
    warn(message) {
      if (quiet || json) return;
      p.log.warn(message);
    },
    error(message) {
      if (!json) p.log.error(message);
      else log.error(message);
    },
    async confirm(message, { initialValue = true } = {}) {
      return p.confirm({ message, initialValue });
    },
    async multiselect(message, options, { required = true } = {}) {
      return p.multiselect({
        message,
        options,
        required,
      });
    },
    async text(message, opts = {}) {
      return p.text({ message, ...opts });
    },
    spinner() {
      if (quiet || json) {
        return {
          start() {},
          stop() {},
          message() {},
        };
      }
      return p.spinner();
    },
    cancel(message = 'Installation cancelled.') {
      if (!quiet && !json) p.cancel(message);
    },
  };
}

/** Format a QaError (or generic Error) for end users — no stack unless debug. */
export function formatUserError(error, { debug = false } = {}) {
  const lines = [];
  lines.push(error?.message || String(error));
  if (error?.hint) lines.push(`Next step: ${error.hint}`);
  if (debug && error?.stack) lines.push(error.stack);
  return lines.join('\n');
}
