// File-type facts for artifacts: what a file is, and how a report may show it.
//
// Kept as a table rather than a dependency because the set is small, closed, and
// the report must render offline from a bundled skill. An unknown extension is
// reported as unknown rather than guessed — a report that labels a `.trace` file
// "image/png" and then renders a broken `<img>` is the failure this module exists
// to prevent.

const BY_EXTENSION = Object.freeze({
  // Images — the only kinds that may be rendered inline as <img>.
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  // Video — rendered as <video>, never as <img>.
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.ogv': 'video/ogg',
  // Structured evidence.
  '.json': 'application/json',
  '.har': 'application/json',
  '.xml': 'application/xml',
  '.csv': 'text/csv',
  '.sarif': 'application/json',
  // Text evidence.
  '.txt': 'text/plain',
  '.log': 'text/plain',
  '.md': 'text/markdown',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.diff': 'text/x-diff',
  '.patch': 'text/x-diff',
  // Archives — Playwright traces are zips.
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
});

// An SVG is an image the browser will render, and also a document that can carry
// script. A report embeds artifacts it did not author, so SVG is shown as a link
// rather than inlined into the page.
const INLINE_IMAGE = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);

const VIDEO = new Set(['video/webm', 'video/mp4', 'video/ogg']);

// When the declared kind is absent, the extension decides. Ordered most specific
// first: `.har` is JSON, but it is a HAR before it is a document.
const KIND_BY_EXTENSION = Object.freeze({
  '.har': 'har',
  '.zip': 'trace',
  '.webm': 'video',
  '.mp4': 'video',
  '.ogv': 'video',
  '.png': 'screenshot',
  '.jpg': 'screenshot',
  '.jpeg': 'screenshot',
  '.webp': 'screenshot',
  '.gif': 'screenshot',
  '.avif': 'screenshot',
  '.html': 'dom',
  '.htm': 'dom',
  '.log': 'log',
  '.diff': 'diff',
  '.patch': 'diff',
});

/** The lower-cased extension of a path, including the dot, or '' when there is none. */
export function extensionOf(filePath) {
  const name = String(filePath ?? '').split(/[\\/]/).pop() ?? '';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot).toLowerCase() : '';
}

/** The MIME type for a path, or null when the extension is not one we know. */
export function mimeFor(filePath) {
  return BY_EXTENSION[extensionOf(filePath)] ?? null;
}

/** The artifact kind a path implies, or null. Used only when `kind` is absent. */
export function kindFor(filePath) {
  return KIND_BY_EXTENSION[extensionOf(filePath)] ?? null;
}

/** True when the report may render this MIME type inline with `<img>`. */
export function isInlineImage(mimeType) {
  return INLINE_IMAGE.has(String(mimeType ?? ''));
}

/** True when the report may render this MIME type with `<video>`. */
export function isVideo(mimeType) {
  return VIDEO.has(String(mimeType ?? ''));
}

/** Bytes as a short human string: 812 B, 44.1 KB, 3.2 MB. */
export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return '';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB'];
  let scaled = value / 1024;
  let unit = 0;
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  return `${scaled >= 10 ? Math.round(scaled) : scaled.toFixed(1)} ${units[unit]}`;
}
