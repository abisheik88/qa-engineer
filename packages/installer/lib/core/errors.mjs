// Typed errors carrying an exit code, so the CLI can translate a thrown error
// into the right process exit without a chain of instanceof checks.

import { EXIT } from '../constants.mjs';

export class QaError extends Error {
  constructor(message, { code = EXIT.FAILURE, hint = null } = {}) {
    super(message);
    this.name = 'QaError';
    this.code = code; // one of EXIT.*
    this.hint = hint; // optional actionable next step shown to the user
  }
}

export function usageError(message, hint = null) {
  return new QaError(message, { code: EXIT.USAGE, hint });
}

export function conflictError(message, hint = null) {
  return new QaError(message, { code: EXIT.CONFLICT, hint });
}

export function verifyError(message, hint = null) {
  return new QaError(message, { code: EXIT.VERIFY, hint });
}

export function environmentError(message, hint = null) {
  return new QaError(message, { code: EXIT.ENVIRONMENT, hint });
}
