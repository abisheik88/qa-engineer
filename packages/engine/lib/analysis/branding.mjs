// Product attribution for human-readable reports.
//
// One renderer, one metadata file, three output formats. Every report the pack
// produces for a human ends with the same footer, and changing it means editing
// `branding.json` — nothing else.
//
// ## Why this is code and not a string in each skill
//
// A footer typed by a model is a footer that drifts: the tagline gains a word, the
// URL loses a scheme, one report says "Developed by" and the next says "Built by".
// Rendering it deterministically makes every report byte-identical, and makes a
// change to the branding a one-file edit that CI can verify
// (scripts/check-branding.mjs fails if any branding string is hardcoded elsewhere).
//
// ## What gets a footer, and what must not
//
// Attribution belongs on documents a person reads. It is noise — or worse, a
// parsing hazard — anywhere else.
//
//   Branded                          | Not branded
//   ---------------------------------|--------------------------------------------
//   HTML and PDF reports             | JSON and YAML artifacts under qa-artifacts/
//   Markdown meant for people        | Markdown written for a machine to read
//   Generated documentation          | CLI stdout, progress output, --json output
//   Audit and evaluation renderings  | The system under test, the user's own source
//
// The rule behind the table: **if a program will parse it, it gets no footer.** A
// contract artifact is an interface, and appending prose to an interface breaks it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// One metadata file, beside this module — so it travels with the engine into a
// bundled skill without a second copy to keep in step.
const METADATA_CANDIDATES = [path.join(here, 'branding.json')];

// The visual width of the plain-text rules. Wide enough to frame the four lines,
// narrow enough to survive an 80-column terminal or a PDF margin.
const RULE_WIDTH = 60;

const ALLOWED_SCHEMES = ['https://', 'http://'];

export class BrandingError extends Error {}

/** The branding metadata. Read fresh, so a change needs no reinstall. */
export function metadata() {
  const source = METADATA_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!source) {
    throw new BrandingError(
      `could not find branding metadata (looked in: ${METADATA_CANDIDATES.join(', ')})`,
    );
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(source, 'utf8'));
  } catch (error) {
    throw new BrandingError(`could not read branding metadata at ${source}: ${error.message}`);
  }

  const required = ['projectName', 'tagline', 'author', 'website', 'attributionPrefix', 'authorPrefix'];
  const missing = required.filter((key) => !data[key]);
  if (missing.length > 0) {
    throw new BrandingError(`branding metadata is missing: ${missing.join(', ')}`);
  }
  if (!ALLOWED_SCHEMES.some((scheme) => data.website.startsWith(scheme))) {
    // A footer is rendered into HTML, so a non-http scheme here would be an
    // injection vector rather than a typo.
    throw new BrandingError(
      `branding website must start with http:// or https://, got '${data.website}'`,
    );
  }
  return data;
}

/** HTML-escape, matching Python's `html.escape(s, quote=True)` character for character. */
function escape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** The four footer lines, in order, as plain strings. */
function lines(data) {
  return [
    `${data.attributionPrefix} ${data.projectName}`,
    data.tagline,
    `${data.authorPrefix} ${data.author}`,
    data.website,
  ];
}

/**
 * Rule-separated plain text, for PDF and any non-markup rendering.
 *
 * Centering follows Python's `str.center`: the odd space goes on the right, which
 * then falls off with the trailing trim. Getting that backwards shifts every line
 * by a character and breaks the snapshot the branding tests pin.
 */
export function footerText({ width = RULE_WIDTH } = {}) {
  const data = metadata();
  const rule = '-'.repeat(width);
  const body = lines(data)
    .map((line) => {
      if (line.length >= width) return line;
      return ' '.repeat(Math.floor((width - line.length) / 2)) + line;
    })
    .join('\n');
  return `${rule}\n${body}\n${rule}\n`;
}

/** A thematic break and the four lines, with the site as a link. */
export function footerMarkdown() {
  const data = metadata();
  return (
    '---\n\n' +
    `<sub>${data.attributionPrefix} **${data.projectName}** — ` +
    `${data.tagline}<br>\n` +
    `${data.authorPrefix} ` +
    `[${data.author}](${data.website})</sub>\n`
  );
}

/**
 * A self-contained `<footer>`: inline styles, muted, centered, small.
 *
 * The author's site opens in a new tab. `rel="noopener noreferrer"` is not
 * optional — a report may be opened from anywhere, and a new tab that can reach
 * back into `window.opener` is a real hazard.
 */
export function footerHtml({ className = 'qa-pack-attribution' } = {}) {
  const data = metadata();
  return (
    `<footer class="${escape(className)}" style="margin-top:2.5rem;padding-top:1rem;` +
    'border-top:1px solid rgba(128,128,128,0.25);font-size:0.75rem;line-height:1.6;' +
    'color:#6b7280;text-align:center;font-family:system-ui,-apple-system,' +
    'Segoe UI,Roboto,sans-serif;">\n' +
    `  <div>${escape(data.attributionPrefix)} <strong>${escape(data.projectName)}</strong></div>\n` +
    `  <div>${escape(data.tagline)}</div>\n` +
    `  <div>${escape(data.authorPrefix)} ` +
    `<a href="${escape(data.website)}" target="_blank" rel="noopener noreferrer" ` +
    'style="color:inherit;text-decoration:underline;">' +
    `${escape(data.author)}</a></div>\n` +
    '</footer>\n'
  );
}

const RENDERERS = {
  html: footerHtml,
  markdown: footerMarkdown,
  md: footerMarkdown,
  text: footerText,
  txt: footerText,
  pdf: footerText, // what a PDF writer embeds when it cannot render markup
};

export const FORMATS = ['html', 'markdown', 'text'];

/** Render the footer in `format`. Throws BrandingError on an unknown format. */
export function footer(format = 'text') {
  const renderer = RENDERERS[String(format).toLowerCase()];
  if (!renderer) {
    throw new BrandingError(
      `unknown branding format '${format}'; expected one of: ${FORMATS.join(', ')}`,
    );
  }
  return renderer();
}

/**
 * Return `document` with the footer appended, idempotently.
 *
 * Idempotence matters: a report assembled in stages, or regenerated over its own
 * output, must not accumulate footers.
 */
export function appendTo(document, format = 'markdown') {
  const rendered = footer(format);
  if (rendered.trim() && document.includes(rendered.trim())) return document;
  const separator = document.endsWith('\n') ? '' : '\n';
  return `${document}${separator}\n${rendered}`;
}
