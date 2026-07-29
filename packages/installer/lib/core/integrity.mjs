// What a lockfile entry should hash to on disk, whatever kind of entry it is.
//
// Four commands independently asked "does this file still match its recorded hash?" —
// validate, verify, uninstall, and the conflict detector — and each did it by calling
// `hashFile` directly. That was correct while every entry was a file. The moment a
// global install started recording links, all four tried to read a directory and threw
// EISDIR, which is a crash rather than a diagnosis.
//
// So the question moves here and is asked once. A link's identity is *where it points*,
// not what is behind it: hashing the target means `verify` catches a link repointed at
// something else, and does not report drift merely because the canonical skill it points
// at was legitimately updated.

import fs from 'node:fs';
import path from 'node:path';

import { hashFile, hashString } from './hash.mjs';
import { readLinkTarget } from './fs-safe.mjs';
import { toPosix } from './paths.mjs';

/**
 * The digest of an installed entry, or `null` when it is not there.
 *
 * `null` means missing, which every caller already treats as drift — so a link whose
 * path now holds a real directory reads as drift rather than as a match, which is what
 * it is.
 */
export function entryDigest(root, entry) {
  const absolute = path.join(root, entry.path);

  if (entry.owner === 'link') {
    const target = readLinkTarget(absolute);
    if (target === null) return null;
    // Relative to the scope root, so a lockfile stays valid when the whole tree moves —
    // a home directory that changes name should not invalidate every link in it.
    return hashString(toPosix(path.relative(root, path.resolve(path.dirname(absolute), target))));
  }

  if (!fs.existsSync(absolute)) return null;
  try {
    return hashFile(absolute);
  } catch {
    // A path that exists but cannot be read as a file — a directory where a file was
    // recorded — is drift, not a crash.
    return null;
  }
}

/** True when the entry on disk matches what the lockfile recorded. */
export function entryMatches(root, entry) {
  const digest = entryDigest(root, entry);
  return digest !== null && digest === entry.sha256;
}

/** True when anything at all occupies the entry's path, link or file. */
export function entryPresent(root, entry) {
  const absolute = path.join(root, entry.path);
  return fs.existsSync(absolute) || readLinkTarget(absolute) !== null;
}
