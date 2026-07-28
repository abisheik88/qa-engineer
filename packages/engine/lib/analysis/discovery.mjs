// Deterministic artifact discovery.
//
// Locates the artifacts a run produced — automatically by convention or from
// explicit paths — and classifies each as present, partial, or corrupted. It
// handles multiple runs, parallel workers, and sharded output (many result files),
// and it reports what is missing rather than inventing it.
//
// Two things Python's standard library provided that are written out here:
//
//  - `glob(..., recursive=True)`. Node's `fs.globSync` only arrived in Node 22 and
//    the pack supports 18.17, so the walk is explicit. It reproduces glob's rules
//    that matter here: `**` spans zero or more directories, and an entry whose name
//    begins with a dot is not matched by a wildcard.
//  - `zipfile.is_zipfile`, which locates the end-of-central-directory record
//    rather than trusting the first four bytes. A trace that has been truncated
//    still starts with `PK\x03\x04`, so magic bytes alone would call a broken
//    archive intact — the exact misreport this classification exists to prevent.

import fs from 'node:fs';
import path from 'node:path';

import { artifact } from './evidence.mjs';

// Convention globs for known artifact types, relative to a run root. Order is
// significant: the first type whose pattern matches a path claims it.
const PATTERNS = [
  ['junit', ['**/results.xml', '**/junit*.xml', '**/*junit*.xml']],
  ['report', ['**/results.json', '**/report.json']],
  ['html-report', ['**/playwright-report/index.html', '**/*-report/index.html']],
  ['trace', ['**/trace.zip', '**/*-trace.zip']],
  ['har', ['**/*.har']],
  ['video', ['**/*.webm', '**/*.mp4']],
  ['screenshot', ['**/*.png', '**/*-actual.png']],
];

const EXTENSIONS = {
  junit: ['.xml'],
  report: ['.json'],
  trace: ['.zip'],
  har: ['.har'],
  video: ['.webm', '.mp4'],
  screenshot: ['.png'],
  'html-report': ['.html'],
};

/** Classify an artifact as present, partial (empty), corrupted, or missing. */
export function integrity(artifactType, filePath) {
  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch {
    return 'missing';
  }
  if (stats.size === 0) return 'partial';

  // Structural spot-checks for formats we can cheaply verify.
  if (artifactType === 'trace') {
    return isZipFile(filePath) ? 'present' : 'corrupted';
  }
  if (artifactType === 'report' || artifactType === 'har') {
    try {
      JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return 'corrupted';
    }
  }
  return 'present';
}

/**
 * Discover artifacts under `root`, or validate explicit paths.
 *
 * Explicit paths that do not exist are reported as missing; convention discovery
 * never reports missing, because absence is simply "not found".
 */
export function discover({ root = '.', explicit = null, framework = 'unknown' } = {}) {
  const present = [];
  const partial = [];
  const corrupted = [];
  const missing = [];

  const record = (artifactType, filePath) => {
    const state = integrity(artifactType, filePath);
    const entry = artifact({
      type: artifactType,
      location: path.isAbsolute(filePath) ? path.relative(root, filePath) : filePath,
      framework,
      present: state === 'present',
    });
    if (state === 'present') present.push(entry);
    else if (state === 'partial') partial.push(entry);
    else if (state === 'corrupted') corrupted.push(entry);
    else missing.push(filePath);
  };

  if (explicit && explicit.length > 0) {
    for (const candidate of explicit) {
      if (!fs.existsSync(candidate)) {
        missing.push(candidate);
        continue;
      }
      const matched = PATTERNS.find(([type]) => matchesType(type, candidate))?.[0] ?? 'attachment';
      record(matched, candidate);
    }
  } else {
    const files = walk(root);
    const seen = new Set();
    for (const [artifactType, patterns] of PATTERNS) {
      for (const pattern of patterns) {
        const matches = files.filter((file) => matchesPattern(pattern, file.relative)).map((f) => f.joined);
        for (const filePath of matches.sort()) {
          if (seen.has(filePath)) continue;
          seen.add(filePath);
          record(artifactType, filePath);
        }
      }
    }
  }

  return { present, partial, corrupted, missing };
}

/** Every file under `root`, with the path spelled the way `glob` would spell it. */
function walk(root) {
  const found = [];
  const visit = (dir, relativeParts) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      // A wildcard does not match a leading dot, so such entries are invisible to
      // convention discovery — the same rule `glob` applies.
      if (entry.name.startsWith('.')) continue;
      const next = [...relativeParts, entry.name];
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full, next);
      else if (entry.isFile()) found.push({ relative: next, joined: joinLikePython(root, next) });
    }
  };
  visit(root, []);
  return found;
}

/**
 * `os.path.join(root, relative)`, whose output the discovered `location` carries.
 *
 * Node's `path.join('.', 'a/b')` normalizes the leading `./` away and Python's
 * does not, so a bare `path.join` would report a different location string for
 * every artifact found under the default root.
 */
function joinLikePython(root, parts) {
  const tail = parts.join('/');
  if (root === '') return tail;
  return root.endsWith('/') ? `${root}${tail}` : `${root}/${tail}`;
}

/** Does a `**`-prefixed pattern match this relative path? */
function matchesPattern(pattern, relativeParts) {
  const tail = pattern.startsWith('**/') ? pattern.slice(3) : pattern;
  const wanted = tail.split('/');
  if (wanted.length > relativeParts.length) return false;
  // `**` spans zero or more directories, so the tail is matched against the last
  // segments of the path.
  const actual = relativeParts.slice(relativeParts.length - wanted.length);
  return wanted.every((segment, index) => segmentRegExp(segment).test(actual[index]));
}

const segmentCache = new Map();

function segmentRegExp(segment) {
  let cached = segmentCache.get(segment);
  if (!cached) {
    const source = segment
      .split('*')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[^/]*');
    cached = new RegExp(`^${source}$`);
    segmentCache.set(segment, cached);
  }
  return cached;
}

function matchesType(artifactType, filePath) {
  const lower = filePath.toLowerCase();
  return (EXTENSIONS[artifactType] ?? []).some((extension) => lower.endsWith(extension));
}

/**
 * Is this a readable ZIP archive?
 *
 * Locates the end-of-central-directory record the way `zipfile.is_zipfile` does,
 * searching the tail of the file (the record is last, and may be followed by up to
 * 64 KiB of comment). Reading the header alone would accept a truncated archive.
 */
export function isZipFile(filePath) {
  const EOCD = Buffer.from([0x50, 0x4b, 0x05, 0x06]); // "PK\x05\x06"
  let handle;
  try {
    handle = fs.openSync(filePath, 'r');
    const { size } = fs.fstatSync(handle);
    if (size < 22) return false;
    const window = Math.min(size, 22 + 0xffff);
    const buffer = Buffer.alloc(window);
    fs.readSync(handle, buffer, 0, window, size - window);
    return buffer.lastIndexOf(EOCD) !== -1;
  } catch {
    return false;
  } finally {
    if (handle !== undefined) {
      try {
        fs.closeSync(handle);
      } catch {
        /* already gone */
      }
    }
  }
}
