// A dependency-free ZIP reader for the entries the pack needs to read.
//
// Node has no archive API, and a dependency is ruled out for code that runs in
// other people's repositories (ADR-0009). Playwright writes its trace as a zip of
// newline-delimited JSON, so the central directory is walked here and each entry
// inflated with the built-in `zlib`.
//
// Supported: stored (method 0) and deflated (method 8) entries — the only two a
// zip writer produces in practice, and the only two Playwright emits. Anything
// else raises by name rather than returning empty bytes, because a silently empty
// trace reads as "nothing happened" instead of "could not be read".

import fs from 'node:fs';
import zlib from 'node:zlib';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const MAX_COMMENT = 0xffff;

export class ZipError extends Error {}

/**
 * Every entry in the archive: `[{name, method, compressedSize, size, offset}]`.
 *
 * Read from the central directory, which is authoritative — the per-entry local
 * headers may carry zeroed sizes when the writer streamed the file.
 */
export function listEntries(buffer) {
  const eocd = findEndOfCentralDirectory(buffer);
  const count = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  const entries = [];

  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) {
      throw new ZipError(`central directory entry ${index} is malformed`);
    }
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const size = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const offset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    entries.push({ name, method, compressedSize, size, offset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** The bytes of one entry, inflated if it was deflated. */
export function readEntry(buffer, entry) {
  if (entry.offset + 30 > buffer.length) {
    throw new ZipError(`entry ${entry.name} points past the end of the archive`);
  }
  const nameLength = buffer.readUInt16LE(entry.offset + 26);
  const extraLength = buffer.readUInt16LE(entry.offset + 28);
  const start = entry.offset + 30 + nameLength + extraLength;
  const raw = buffer.subarray(start, start + entry.compressedSize);

  if (entry.method === 0) return raw;
  if (entry.method === 8) {
    try {
      return zlib.inflateRawSync(raw);
    } catch (error) {
      throw new ZipError(`entry ${entry.name} could not be inflated: ${error.message}`);
    }
  }
  throw new ZipError(`entry ${entry.name} uses unsupported compression method ${entry.method}`);
}

/** Is this a readable ZIP archive? Locates the end-of-central-directory record. */
export function isZip(buffer) {
  try {
    findEndOfCentralDirectory(buffer);
    return true;
  } catch {
    return false;
  }
}

/** Open a zip file and hand back `{entries, read}`. */
export function openZip(path) {
  let buffer;
  try {
    buffer = fs.readFileSync(path);
  } catch (error) {
    throw new ZipError(`could not read ${path}: ${error.message}`);
  }
  const entries = listEntries(buffer);
  return { entries, read: (entry) => readEntry(buffer, entry) };
}

/**
 * The record is last in the file, possibly followed by a comment, so the tail is
 * scanned backwards. Trusting the first four bytes instead would accept a
 * truncated archive whose header still reads `PK\x03\x04`.
 */
function findEndOfCentralDirectory(buffer) {
  if (buffer.length < 22) throw new ZipError('too short to be a zip archive');
  const earliest = Math.max(0, buffer.length - 22 - MAX_COMMENT);
  for (let cursor = buffer.length - 22; cursor >= earliest; cursor -= 1) {
    if (buffer.readUInt32LE(cursor) === EOCD_SIGNATURE) return cursor;
  }
  throw new ZipError('no end-of-central-directory record: not a zip archive');
}
