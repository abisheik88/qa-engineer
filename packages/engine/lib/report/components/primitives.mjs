// The small pieces every section is built from: escaping, formatting, badges, icons.
//
// Escaping lives here and is used everywhere, because a report renders text the run
// did not author — page titles, console messages, response bodies, DOM excerpts. That
// content is untrusted the same way a log line is untrusted, and a `<script>` in a
// console error must reach the reader as characters, never as markup.

import { SEVERITY, STATUS, VITALS, vitalBand, scoreBand } from '../theme/tokens.mjs';
import { formatBytes } from '../../artifacts/mime.mjs';

/** HTML-escape text for element content and quoted attribute values alike. */
export function e(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Escape for a JSON literal embedded in a `<script>` block.
 *
 * `JSON.stringify` alone is not enough: the string `</script>` inside any value ends
 * the block early and drops the rest of the page into the document as markup. The
 * `<` and ` `/` ` escapes close that off.
 */
export function jsonScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Join class names, dropping the falsy ones. */
export function cx(...names) {
  return names.filter(Boolean).join(' ');
}

/** An id safe to use as an anchor, derived from a finding or section key. */
export function slug(value, prefix = '') {
  const safe = [...String(value ?? '')]
    .map((ch) => (/[\p{L}\p{N}]/u.test(ch) || ch === '-' || ch === '_' ? ch : '-'))
    .join('')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return safe ? `${prefix}${safe}` : '';
}

/** Sort TC-2 before TC-10, the way a reader expects a case list to run. */
export function compareNatural(a, b) {
  const key = (v) =>
    String(v ?? '')
      .split(/(\d+)/)
      .map((part) => (/^\d+$/.test(part) ? Number.parseInt(part, 10) : part.toLowerCase()));
  const left = key(a);
  const right = key(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const x = left[i];
    const y = right[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    return x < y ? -1 : 1;
  }
  return 0;
}

/** A severity badge. */
export function severityBadge(severity) {
  const key = SEVERITY[severity] ? severity : 'low';
  return `<span class="badge sev-${key}">${e(SEVERITY[key].label)}</span>`;
}

/** A status pill — pass, fail, blocked, skipped, or a free-form label. */
export function statusPill(status, label = null) {
  const map = {
    pass: 'passed', passed: 'passed', ok: 'passed', confirmed: 'failed',
    fail: 'failed', failed: 'failed', issues: 'failed',
    blocked: 'blocked', warn: 'blocked', warned: 'blocked',
    skipped: 'skipped', 'not-checked': 'skipped',
  };
  const key = map[status] ?? 'neutral';
  const text = label ?? STATUS[key]?.label ?? status;
  return `<span class="pill st-${key}">${e(text)}</span>`;
}

/** A neutral chip for dimensions, tags, owners. */
export function chip(text, title = null) {
  if (!text) return '';
  const attr = title ? ` title="${e(title)}"` : '';
  return `<span class="chip"${attr}>${e(text)}</span>`;
}

/**
 * A KPI tile.
 *
 * `variant` picks the accent: `sev-<key>` colours it by severity, `st-<key>` by test
 * status. A zero gets muted deliberately — a wall of tiles where "0 critical" shouts
 * as loudly as "3 critical" trains the reader to skip all of them.
 */
export function kpi({ value, label, sub = null, variant = null, zeroMuted = true }) {
  const numeric = Number(value);
  const isZero = zeroMuted && Number.isFinite(numeric) && numeric === 0;
  const kind = variant?.startsWith('sev-') ? 'sev' : variant?.startsWith('st-') ? 'st' : '';
  return (
    `<div class="${cx('kpi', kind, variant, isZero && 'kpi-zero')}">` +
    `<span class="kpi-n">${e(value)}</span>` +
    `<span class="kpi-l">${e(label)}</span>` +
    (sub ? `<span class="kpi-sub">${e(sub)}</span>` : '') +
    '</div>'
  );
}

/** A ring gauge for a 0–100 score, drawn as SVG so it survives print and PDF. */
export function scoreGauge(score, label) {
  const value = Math.max(0, Math.min(100, Math.round(Number(score))));
  const band = scoreBand(value);
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const filled = (value / 100) * circumference;
  return (
    `<div class="score tone-${band}">` +
    `<svg width="48" height="48" viewBox="0 0 48 48" role="img" ` +
    `aria-label="${e(label)} score ${value} out of 100">` +
    `<circle cx="24" cy="24" r="${radius}" fill="none" stroke="var(--border)" stroke-width="4"/>` +
    `<circle cx="24" cy="24" r="${radius}" fill="none" stroke="var(--tone)" stroke-width="4" ` +
    `stroke-linecap="round" stroke-dasharray="${filled.toFixed(2)} ${circumference.toFixed(2)}" ` +
    'transform="rotate(-90 24 24)"/>' +
    `<text x="24" y="24" text-anchor="middle" dominant-baseline="central" ` +
    `font-size="14" font-weight="700" fill="var(--tone)">${value}</text>` +
    '</svg>' +
    `<div><div class="score-l">${e(label)}</div>` +
    `<div class="score-b">${band === 'good' ? 'Good' : band === 'warn' ? 'Needs work' : 'Poor'}</div></div>` +
    '</div>'
  );
}

/** A duration in the largest unit that stays readable. */
export function formatDuration(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value < 0) return '';
  if (value < 1000) return `${Math.round(value)} ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(value < 10_000 ? 2 : 1)} s`;
  const minutes = Math.floor(value / 60_000);
  const seconds = Math.round((value % 60_000) / 1000);
  return seconds ? `${minutes} m ${seconds} s` : `${minutes} m`;
}

/** A count with its noun, pluralised. */
export function plural(count, singular, pluralForm = null) {
  const n = Number(count) || 0;
  return `${n} ${n === 1 ? singular : pluralForm ?? `${singular}s`}`;
}

export { formatBytes };

/** Render one Core Web Vital as a tile whose colour states whether it is acceptable. */
export function vitalTile(key, value) {
  const spec = VITALS[key];
  if (!spec || value === null || value === undefined) return '';
  const band = vitalBand(key, value);
  const shown =
    spec.unit === 'bytes'
      ? formatBytes(value)
      : spec.unit === 'ms'
        ? formatDuration(value)
        : String(Number(value).toFixed(key === 'cls' ? 3 : 0));
  return (
    `<div class="kpi tone-${band}" style="--kpi-accent:var(--tone)" title="${e(spec.full)} — ${e(spec.plain)}">` +
    `<span class="kpi-n" style="color:var(--tone)">${e(shown)}</span>` +
    `<span class="kpi-l">${e(spec.label)}</span>` +
    `<span class="kpi-sub">${e(spec.plain)}</span>` +
    '</div>'
  );
}

/**
 * Inline SVG icons.
 *
 * Inline because the report has no second file to fetch, and an icon font would be a
 * remote asset. Every one is 16×16 on a 24-unit grid, stroked with `currentColor` so
 * it inherits the surrounding text colour in both themes.
 */
const ICON_PATHS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
  expand: '<path d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5"/>',
  print: '<path d="M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v7H8z"/>',
  warning: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5m0 3v.5"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>',
  close: '<path d="M6 6 18 18M18 6 6 18"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/>',
};

export function icon(name, size = 16) {
  const body = ICON_PATHS[name];
  if (!body) return '';
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ' +
    `aria-hidden="true" focusable="false">${body}</svg>`
  );
}

/** A `<section>` with a heading, an anchor, and an optional count badge. */
export function section({ id, title, count = null, note = null, body }) {
  if (!body) return '';
  const badge = count === null ? '' : `<span class="count">${e(count)}</span>`;
  return (
    `<section class="section" id="${e(id)}" aria-labelledby="${e(id)}-h">` +
    `<h2 id="${e(id)}-h">${e(title)}${badge}</h2>` +
    (note ? `<p class="section-note">${e(note)}</p>` : '') +
    body +
    '</section>'
  );
}

/** A table wrapped so wide content scrolls inside its own box, never the page. */
export function table(headers, rows, { className = '' } = {}) {
  if (rows.length === 0) return '';
  const head = headers
    .map((header) => {
      const label = typeof header === 'string' ? header : header.label;
      const numeric = typeof header === 'object' && header.numeric;
      return `<th${numeric ? ' class="num"' : ''}>${e(label)}</th>`;
    })
    .join('');
  return (
    `<div class="table-wrap ${e(className)}"><table><thead><tr>${head}</tr></thead>` +
    `<tbody>${rows.join('')}</tbody></table></div>`
  );
}

/** A proportional bar for a table cell — payload size, duration, request share. */
export function barCell(value, max, { colour = null, label = null } = {}) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, Number(value) / max)) : 0;
  const style = colour ? ` style="--bar:${colour}"` : '';
  return (
    `<td class="bar-cell">${label === null ? '' : `<div class="tabular" style="margin-bottom:.25rem">${e(label)}</div>`}` +
    `<div class="bar"${style}><span style="width:${(ratio * 100).toFixed(1)}%"></span></div></td>`
  );
}
