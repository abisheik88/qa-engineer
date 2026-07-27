// Content hashing for the lockfile. sha256 over raw bytes, so integrity checks
// are exact and independent of line endings or text encoding assumptions.

import crypto from 'node:crypto';
import fs from 'node:fs';

export const HASH_ALGORITHM = 'sha256';

export function hashBytes(buffer) {
  return crypto.createHash(HASH_ALGORITHM).update(buffer).digest('hex');
}

export function hashString(text) {
  return hashBytes(Buffer.from(text, 'utf8'));
}

export function hashFile(filePath) {
  return hashBytes(fs.readFileSync(filePath));
}
