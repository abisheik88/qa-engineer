// Rendering evidence: screenshots, video, traces, logs — and honest absence.
//
// The contract for this module is one sentence: **it never emits a broken link.**
//
// Every path here has already been through the artifact registry, so each record
// carries `exists` as a measured fact. A record that is present renders as a preview
// with actions; a record that is not renders as a stated absence with the reason and
// the path that was searched. What it must never do is emit `<img src=…>` for a file
// nobody checked, because the browser's broken-image glyph tells the reader nothing
// except that the report is unreliable.

import { e, icon, chip, formatBytes } from './primitives.mjs';

// What each evidence kind is called in the report. The contract guarantees `type` on
// every entry but a caption only sometimes, so the type label is what a caption can
// always fall back to.
export const EVIDENCE_LABEL = Object.freeze({
  screenshot: 'Screenshot',
  video: 'Video',
  trace: 'Playwright trace',
  network: 'Network capture',
  console: 'Console output',
  dom: 'DOM snapshot',
  har: 'HAR archive',
  db: 'Database query',
  performance: 'Performance metrics',
  accessibility: 'Accessibility report',
  security: 'Security report',
  api: 'API report',
  coverage: 'Coverage report',
  log: 'Log',
  diff: 'Diff',
  file: 'File',
  report: 'Report',
  command: 'Command output',
});

export function evidenceLabel(kind) {
  return EVIDENCE_LABEL[kind] ?? 'Evidence';
}

/**
 * A stated absence.
 *
 * Named rather than silent: a missing screenshot is itself a finding about the run,
 * and hiding it lets a reader assume the evidence exists and they simply cannot see
 * it. The recorded path is shown because it is the one thing that makes the problem
 * fixable — nine times in ten it is a path written relative to the wrong directory.
 */
export function missingArtifact(record) {
  const name = record.label ?? evidenceLabel(record.kind);
  const reason = record.missingReason ?? 'File not found at the recorded path';
  const path = record.declaredPath
    ? `<div style="margin-top:.25rem"><code>${e(record.declaredPath)}</code></div>`
    : '';
  return (
    '<div class="artifact-missing" role="note">' +
    icon('warning', 18) +
    `<div><span class="why">Artifact missing — ${e(name)}</span>` +
    `<span>${e(reason)}.</span>${path}</div>` +
    '</div>'
  );
}

/** The caption strip under a preview: what it is, how big, and where to open it. */
function caption(record, { side = null } = {}) {
  const name = record.label ?? evidenceLabel(record.kind);
  const bits = [
    `<span class="name"${side ? ` data-side="${e(side)}"` : ''}>${e(name)}</span>`,
    record.sizeLabel ? `<span class="muted">${e(record.sizeLabel)}</span>` : '',
    record.declaredPath ? `<code>${e(record.declaredPath)}</code>` : '',
  ].filter(Boolean);

  const actions = record.href
    ? '<span class="shot-actions">' +
      `<a href="${e(record.href)}" target="_blank" rel="noopener noreferrer">Open full size</a>` +
      '</span>'
    : '';
  return `<figcaption>${bits.join('')}${actions}</figcaption>`;
}

/**
 * One artifact, rendered the way its type allows.
 *
 * Images get a lazy-loaded preview that opens in the lightbox; video gets native
 * controls; everything else gets a link and, when the run captured one, a text
 * excerpt. `loading="lazy"` and explicit dimensions matter here — a report with forty
 * screenshots that decodes all of them on open is a report nobody scrolls.
 */
export function artifactFigure(record, { side = null, excerpt = null } = {}) {
  if (!record) return '';
  if (!record.exists) return missingArtifact(record);

  if (record.renderAs === 'image') {
    // An embedded copy wins: it is the one that still shows when the report travels
    // alone. The full-size link stays pointed at the file on disk.
    const src = record.dataUri ?? record.thumbnailHref ?? record.href;
    const dimensions =
      record.width && record.height ? ` width="${record.width}" height="${record.height}"` : '';
    return (
      '<figure class="shot">' +
      `<img src="${e(src)}" alt="${e(record.label ?? evidenceLabel(record.kind))}" loading="lazy" ` +
      `decoding="async"${dimensions} data-full="${e(record.dataUri ?? record.href)}" ` +
      `data-name="${e(record.label ?? record.declaredPath)}" class="js-zoom">` +
      caption(record, { side }) +
      '</figure>'
    );
  }

  if (record.renderAs === 'video') {
    return (
      '<figure class="shot">' +
      `<video controls preload="metadata" src="${e(record.href)}"></video>` +
      caption(record, { side }) +
      '</figure>'
    );
  }

  // A trace, a HAR, a log. The excerpt is what makes it readable without leaving the
  // page; the link is what makes it verifiable.
  return (
    '<figure class="shot">' +
    (excerpt ? `<pre><code>${e(excerpt)}</code></pre>` : '') +
    caption(record, { side }) +
    '</figure>'
  );
}

/**
 * A before/after pair, shown side by side.
 *
 * Two screenshots stacked vertically are two screenshots; side by side with a shared
 * caption they are a comparison, and the reader sees the difference without being
 * told what to look for.
 */
export function comparePair(before, after) {
  if (!before || !after) return '';
  return (
    '<div class="compare">' +
    artifactFigure(before, { side: 'Before' }) +
    artifactFigure(after, { side: 'After' }) +
    '</div>'
  );
}

/**
 * Every evidence entry on a finding, resolved and rendered.
 *
 * Before/after pairs are pulled out first so they render together rather than as two
 * unrelated tiles; whatever is left renders in declaration order.
 */
export function evidenceGrid(entries, registry) {
  const records = (entries ?? [])
    .map((entry) => ({ entry, record: registry.forEvidence(entry) }))
    .filter((pair) => pair.record);
  if (records.length === 0) return '';

  const rendered = [];
  const consumed = new Set();

  for (const { entry, record } of records) {
    if (consumed.has(record)) continue;
    if (record.compares) {
      const other = registry.get(record.compares);
      if (other) {
        consumed.add(record);
        consumed.add(other);
        // `compares` points at the earlier state, so the record declaring it is "after".
        rendered.push(comparePair(other, record));
        continue;
      }
    }
    consumed.add(record);
    rendered.push(artifactFigure(record, { excerpt: entry.excerpt ?? null }));
  }

  return `<div class="evidence">${rendered.join('')}</div>`;
}

/** The run-level evidence index: one table of every artifact and whether it is there. */
export function artifactTable(records) {
  if (records.length === 0) return '';
  const rows = records
    .map((record) => {
      const state = record.exists
        ? '<span class="pill st-passed">Present</span>'
        : '<span class="pill st-failed">Missing</span>';
      const link = record.exists && record.href
        ? `<a href="${e(record.href)}" target="_blank" rel="noopener noreferrer"><code>${e(record.declaredPath)}</code></a>`
        : `<code>${e(record.declaredPath || '—')}</code>`;
      return (
        '<tr>' +
        `<td>${e(evidenceLabel(record.kind))}</td>` +
        `<td>${e(record.label ?? '')}</td>` +
        `<td>${link}</td>` +
        `<td class="num">${e(record.exists ? formatBytes(record.bytes) : '—')}</td>` +
        `<td>${state}${record.hashMismatch ? chip('hash mismatch') : ''}</td>` +
        '</tr>'
      );
    })
    .join('');
  return (
    '<div class="table-wrap"><table><thead><tr>' +
    '<th>Kind</th><th>Shows</th><th>File</th><th class="num">Size</th><th>State</th>' +
    `</tr></thead><tbody>${rows}</tbody></table></div>`
  );
}
