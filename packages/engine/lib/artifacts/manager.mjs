// The artifact registry: one place that knows where every evidence file actually is.
//
// ## Why this is code
//
// The first live `/qa-explore` report rendered every screenshot as a broken image.
// The artifact was on disk, the path in the JSON was correct, and the `<img>` still
// 404ed — because the renderer emitted the declared path verbatim. The declared path
// was relative to the *project root* (`qa-artifacts/explore-R/screenshots/a.png`)
// while the report was written *inside that folder*, so the browser resolved
// `qa-artifacts/explore-R/qa-artifacts/explore-R/screenshots/a.png`.
//
// Two bugs, one cause: nothing owned the difference between "where the file is" and
// "how this document should link to it". This module owns it.
//
//   declared path  ─┐
//                   ├─► resolve on disk ─► verify ─► href relative to the output file
//   output dir     ─┘
//
// ## What it guarantees
//
// - A path is resolved against the result's own directory *and* every ancestor up to
//   the search root, so a project-root-relative path finds its file instead of 404ing.
// - Every artifact is stat'ed. `exists` is a fact, never an assumption, so the
//   renderer can show "Artifact missing" instead of a broken image icon.
// - Resolution cannot escape the search root. A `../../../etc/passwd` in an artifact
//   path is refused, because the result JSON is attacker-influenced input the moment
//   a report is forwarded.
// - Hash, size, and MIME type are computed from the file, not trusted from the JSON.
//   A declared `sha256` that disagrees with the file is reported as a mismatch.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { mimeFor, kindFor, isInlineImage, isVideo, formatBytes } from './mime.mjs';

export class ArtifactError extends Error {
  name = 'ArtifactError';
}

// How far up from the result directory a declared path may be resolved. Six levels
// reaches a project root from `<root>/qa-artifacts/explore-<id>/` with room to spare,
// and stops well short of scanning a whole filesystem.
const MAX_ASCENT = 6;

// Reasons an artifact is not renderable, in the words the report shows the reader.
const MISSING_REASON = Object.freeze({
  'not-found': 'File not found at the recorded path',
  'not-a-file': 'The recorded path is a directory, not a file',
  'escapes-root': 'The recorded path points outside the report folder and was refused',
  empty: 'File is present but empty',
  unreadable: 'File could not be read',
});

/** True for a reference the report should link to rather than resolve on disk. */
function isExternal(reference) {
  return /^(https?:|data:|mailto:)/i.test(String(reference ?? ''));
}

/**
 * Candidate absolute paths for a declared reference, nearest first.
 *
 * The order is the whole point: the result's own directory is what the contract
 * documents, so a correct producer resolves on the first try. Ancestors follow, which
 * is what rescues a project-root-relative path written by a producer that treated the
 * repository root as the base.
 */
function candidatesFor(reference, baseDir) {
  if (path.isAbsolute(reference)) return [path.resolve(reference)];
  const candidates = [];
  let dir = baseDir;
  for (let level = 0; level <= MAX_ASCENT; level += 1) {
    candidates.push(path.resolve(dir, reference));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return candidates;
}

/** True when `child` is inside `root` (or is `root`), after both are resolved. */
function contains(root, child) {
  const rel = path.relative(root, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function statFile(absolute) {
  try {
    const stat = fs.statSync(absolute);
    if (!stat.isFile()) return { ok: false, reason: 'not-a-file' };
    return { ok: true, bytes: stat.size, mtime: stat.mtime };
  } catch {
    return { ok: false, reason: 'not-found' };
  }
}

/** SHA-256 of a file, streamed in chunks so a large trace does not land in memory. */
export function hashFile(absolute) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(absolute, 'r');
  try {
    const buffer = Buffer.alloc(64 * 1024);
    for (;;) {
      const read = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (read <= 0) break;
      hash.update(buffer.subarray(0, read));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

/**
 * Turn a declared reference into a resolved artifact record.
 *
 * `declared` carries whatever the producer wrote; everything else is measured. When
 * the file is not found the record still comes back — with `exists: false` and a
 * reason — because a report that silently omits missing evidence is how a reader
 * concludes there was none.
 */
function resolveOne(declared, options) {
  const { baseDir, outDir, searchRoot, hash, embed, embedLimit } = options;
  const reference = String(declared.path ?? declared.source ?? '').trim();

  const record = {
    id: declared.id ?? null,
    kind: declared.kind ?? kindFor(reference) ?? 'file',
    declaredPath: reference,
    label: declared.label ?? declared.caption ?? declared.description ?? null,
    note: declared.note ?? null,
    capturedAt: declared.capturedAt ?? null,
    compares: declared.compares ?? null,
    width: declared.width ?? null,
    height: declared.height ?? null,
    external: false,
    exists: false,
    missingReason: null,
    absolutePath: null,
    href: null,
    thumbnailHref: null,
    dataUri: null,
    embedded: false,
    bytes: declared.bytes ?? null,
    sizeLabel: '',
    mimeType: declared.mimeType ?? mimeFor(reference),
    sha256: null,
    declaredSha256: declared.sha256 ?? null,
    hashMismatch: false,
    registered: Boolean(declared.id),
  };

  if (!reference) {
    record.missingReason = MISSING_REASON['not-found'];
    return record;
  }

  // An http(s) reference is somebody else's file. Link to it, do not claim to have
  // verified it — a report that says "present" about a URL it never fetched is lying.
  if (isExternal(reference)) {
    record.external = true;
    record.exists = true;
    record.href = reference;
    record.mimeType = record.mimeType ?? mimeFor(reference);
    record.renderAs = renderModeFor(record);
    return record;
  }

  let found = null;
  for (const candidate of candidatesFor(reference, baseDir)) {
    if (!contains(searchRoot, candidate)) continue;
    const stat = statFile(candidate);
    if (stat.ok) {
      found = { absolute: candidate, ...stat };
      break;
    }
  }

  if (!found) {
    // Distinguish "we refused to look" from "we looked and it was not there": the
    // first is a producer writing a path outside the report, and the reader should
    // be told which.
    const anyInsideRoot = candidatesFor(reference, baseDir).some((c) => contains(searchRoot, c));
    record.missingReason = MISSING_REASON[anyInsideRoot ? 'not-found' : 'escapes-root'];
    record.renderAs = 'missing';
    return record;
  }

  record.exists = true;
  record.absolutePath = found.absolute;
  record.bytes = found.bytes;
  record.sizeLabel = formatBytes(found.bytes);
  record.mimeType = record.mimeType ?? mimeFor(found.absolute);
  record.capturedAt = record.capturedAt ?? found.mtime.toISOString();
  // A bundle copies evidence into its own `assets/` tree, so the href has to point at
  // the copy rather than at wherever the file was found. Supplying the map is how the
  // bundler redirects every link without the renderer knowing a bundle exists.
  record.href = options.hrefMap?.get(found.absolute) ?? hrefFrom(outDir, found.absolute);

  if (found.bytes === 0) {
    // A zero-byte screenshot renders as a broken image just as reliably as a missing
    // one. It is captured evidence that failed, and it is reported as such.
    record.exists = false;
    record.missingReason = MISSING_REASON.empty;
    record.renderAs = 'missing';
    return record;
  }

  if (hash) {
    try {
      record.sha256 = hashFile(found.absolute);
      record.hashMismatch = Boolean(
        record.declaredSha256 && record.declaredSha256 !== record.sha256,
      );
    } catch {
      record.missingReason = MISSING_REASON.unreadable;
      record.exists = false;
      record.renderAs = 'missing';
      return record;
    }
  }

  if (declared.thumbnail) {
    const thumb = resolveOne(
      { path: declared.thumbnail, kind: 'screenshot' },
      { ...options, hash: false, embed: false },
    );
    if (thumb.exists) record.thumbnailHref = thumb.href;
  }

  // Embedding turns the report into one genuinely portable file: an image inlined as a
  // data URI survives being forwarded as a lone attachment, uploaded to a wiki, or
  // pasted into a ticket, none of which carry the sibling folder along. It is opt-in
  // because base64 costs a third more bytes than the file, and a run with forty
  // full-page screenshots produces a document too large to mail.
  if (embed && isInlineImage(record.mimeType) && found.bytes <= embedLimit) {
    try {
      const encoded = fs.readFileSync(found.absolute).toString('base64');
      record.dataUri = `data:${record.mimeType};base64,${encoded}`;
      record.embedded = true;
    } catch {
      // Falls through to the file href, which is a working link on disk.
    }
  }

  record.renderAs = renderModeFor(record);
  return record;
}

/** How the report should present this artifact: inline, playable, or as a link. */
function renderModeFor(record) {
  if (!record.exists) return 'missing';
  if (isInlineImage(record.mimeType)) return 'image';
  if (isVideo(record.mimeType)) return 'video';
  return 'link';
}

/** A relative, URL-encoded href from the output directory to a file. */
export function hrefFrom(outDir, absolute) {
  const relative = path.relative(outDir, absolute);
  const posix = relative.split(path.sep).join('/');
  // Encode per segment so slashes survive and spaces, #, and ? do not break the link.
  const encoded = posix
    .split('/')
    .map((segment) => (segment === '..' ? segment : encodeURIComponent(segment)))
    .join('/');
  // A sibling file must not read as a protocol-relative URL or a bare word the
  // browser resolves against the wrong base.
  return posix.startsWith('.') ? encoded : `./${encoded}`;
}

/**
 * Build the registry for one result.
 *
 * `baseDir` is the directory the result JSON lives in — declared paths are relative
 * to it. `outDir` is where the rendered document will be written, which is usually
 * the same directory but must not be assumed to be: `--out ../summary.html` is legal
 * and every href has to survive it.
 */
export function createRegistry(result, options = {}) {
  const baseDir = path.resolve(options.baseDir ?? process.cwd());
  const outDir = path.resolve(options.outDir ?? baseDir);
  const searchRoot = path.resolve(
    options.searchRoot ?? ascend(baseDir, MAX_ASCENT),
  );
  const hash = options.hash !== false;
  // 2 MB per image: comfortably above a full-page PNG screenshot, below the point where
  // one oversized capture makes the whole report undeliverable.
  const resolveOptions = {
    baseDir,
    outDir,
    searchRoot,
    hash,
    embed: options.embed === true,
    embedLimit: Number.isFinite(options.embedLimit) ? options.embedLimit : 2 * 1024 * 1024,
    hrefMap: options.hrefMap ?? null,
  };

  const byId = new Map();
  const byPath = new Map();
  const all = [];

  const register = (declared) => {
    const record = resolveOne(declared, resolveOptions);
    all.push(record);
    if (record.id) byId.set(record.id, record);
    if (record.declaredPath) byPath.set(record.declaredPath, record);
    return record;
  };

  for (const declared of result?.artifacts ?? []) {
    if (declared && typeof declared === 'object') register(declared);
  }

  /**
   * Resolve an evidence entry to an artifact record.
   *
   * `artifactId` is the contract's preferred link and is honored first. A `source`
   * that matches a registered path reuses that record rather than stat-ing the file
   * twice. Anything else is resolved on the spot, so a 1.0 producer that never wrote
   * an `artifacts[]` block still gets working images and honest missing markers.
   */
  const forEvidence = (entry) => {
    if (!entry || typeof entry !== 'object') return null;
    if (entry.artifactId) {
      const known = byId.get(entry.artifactId);
      if (known) return known;
      // A dangling id is a producer error worth surfacing, not worth crashing on.
      const stub = {
        ...resolveOne({ path: '', kind: entry.type }, resolveOptions),
        id: entry.artifactId,
        missingReason: `No artifact registered with id "${entry.artifactId}"`,
        renderAs: 'missing',
        label: entry.caption ?? entry.description ?? null,
      };
      all.push(stub);
      return stub;
    }
    const source = String(entry.source ?? '').trim();
    if (!source) return null;
    const known = byPath.get(source);
    if (known) return known;
    return register({
      path: source,
      kind: entry.type,
      label: entry.caption ?? entry.description ?? null,
    });
  };

  return {
    baseDir,
    outDir,
    searchRoot,
    get: (id) => byId.get(id) ?? null,
    forEvidence,
    list: () => [...all],
    registered: () => all.filter((record) => record.registered),
    missing: () => all.filter((record) => !record.exists),
    stats() {
      const present = all.filter((record) => record.exists);
      return {
        total: all.length,
        present: present.length,
        missing: all.length - present.length,
        bytes: present.reduce((sum, record) => sum + (record.bytes ?? 0), 0),
        hashMismatches: all.filter((record) => record.hashMismatch).length,
        byKind: countBy(all, (record) => record.kind),
      };
    },
  };
}

function ascend(dir, levels) {
  let current = dir;
  for (let level = 0; level < levels; level += 1) {
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return current;
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const bucket = key(item);
    counts[bucket] = (counts[bucket] ?? 0) + 1;
  }
  return counts;
}

/**
 * Describe a directory's files as artifact records, for a producer that captured
 * evidence but did not register it.
 *
 * This is the `artifacts verify` CLI's input and the honest answer to "did the run
 * write what it said it wrote": it reads the directory rather than the JSON.
 */
export function scan(directory, { root = directory } = {}) {
  const base = path.resolve(directory);
  if (!fs.existsSync(base)) throw new ArtifactError(`no such directory: ${directory}`);
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile()) {
        const stat = fs.statSync(absolute);
        found.push({
          path: path.relative(path.resolve(root), absolute).split(path.sep).join('/'),
          kind: kindFor(absolute) ?? 'file',
          mimeType: mimeFor(absolute),
          bytes: stat.size,
          sizeLabel: formatBytes(stat.size),
          capturedAt: stat.mtime.toISOString(),
          empty: stat.size === 0,
        });
      }
    }
  };
  walk(base);
  return found;
}

/**
 * Check a result's artifacts against the filesystem.
 *
 * Returns the shape the CLI prints and a skill reads before it declares a run
 * complete: `ok` is false when anything a finding points at is not there.
 */
export function verify(result, options = {}) {
  const registry = createRegistry(result, options);
  const records = registry.list();
  const missing = registry.missing();
  const mismatches = records.filter((record) => record.hashMismatch);
  return {
    ok: missing.length === 0 && mismatches.length === 0,
    stats: registry.stats(),
    missing: missing.map((record) => ({
      id: record.id,
      kind: record.kind,
      declaredPath: record.declaredPath,
      reason: record.missingReason,
    })),
    hashMismatches: mismatches.map((record) => ({
      id: record.id,
      declaredPath: record.declaredPath,
      declared: record.declaredSha256,
      actual: record.sha256,
    })),
  };
}
