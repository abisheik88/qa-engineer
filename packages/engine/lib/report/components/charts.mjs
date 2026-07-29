// Charts, drawn as inline SVG.
//
// ## Why hand-rolled
//
// A charting library would be a remote script or a bundled megabyte, and the report
// has to open offline from a mail attachment. It would also draw to a `<canvas>`,
// which prints as a blur and is invisible to a screen reader.
//
// So these are SVG: a few hundred bytes each, sharp at any zoom, printable, and
// carrying a `<title>` plus a text legend so the numbers are readable without the
// picture. Every chart here degrades to a table of the same figures elsewhere in the
// report — the chart is the summary, never the only copy of the data.
//
// ## Colour
//
// Fills come from CSS custom properties (`var(--sev-solid)`) applied through a class
// rather than from hard-coded hex, so a segment changes with the theme exactly as the
// badge beside it does. Presentation attributes cannot resolve `var()`, so fills are
// set through `style=` where they need to be dynamic.

import { SEVERITY, SEVERITY_ORDER, CATEGORICAL, VITALS, vitalBand } from '../theme/tokens.mjs';
import { e, formatDuration, formatBytes } from './primitives.mjs';

/** Wrap a chart in its card, with a heading and an optional footnote. */
export function chartCard({ title, body, legend = '', note = null }) {
  if (!body) return '';
  return (
    '<figure class="chart">' +
    `<h4>${e(title)}</h4>` +
    body +
    legend +
    (note ? `<figcaption class="muted" style="font-size:.75rem;margin-top:.5rem">${e(note)}</figcaption>` : '') +
    '</figure>'
  );
}

/**
 * A donut of severity counts.
 *
 * Donut rather than pie because the hole holds the total, which is the number most
 * readers want first. Segments are drawn as dashed arcs on one circle — cheaper than
 * path arithmetic and immune to the rounding seams that `<path>` wedges produce.
 */
export function severityDonut(counts, { size = 168 } = {}) {
  const entries = SEVERITY_ORDER.map((key) => ({
    key,
    label: SEVERITY[key].label,
    value: Number(counts?.[key] ?? 0),
  })).filter((entry) => entry.value > 0);

  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const centre = size / 2;

  let body;
  if (total === 0) {
    body =
      `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="No findings recorded">` +
      `<circle cx="${centre}" cy="${centre}" r="${radius}" fill="none" stroke="var(--border)" stroke-width="18"/>` +
      `<text x="${centre}" y="${centre - 4}" text-anchor="middle" font-size="26" font-weight="750" ` +
      'fill="var(--text)">0</text>' +
      `<text x="${centre}" y="${centre + 16}" text-anchor="middle" font-size="10" ` +
      'fill="var(--text-muted)" letter-spacing="1">FINDINGS</text></svg>';
    return { body, legend: '', total };
  }

  let offset = 0;
  const segments = entries
    .map((entry) => {
      const length = (entry.value / total) * circumference;
      // A 2-unit gap between segments reads as separation without distorting the
      // proportion at these sizes.
      const gap = entries.length > 1 ? 2 : 0;
      const arc = Math.max(0, length - gap);
      const segment =
        `<circle class="sev-${entry.key}" cx="${centre}" cy="${centre}" r="${radius}" fill="none" ` +
        `style="stroke:var(--sev-solid)" stroke-width="18" stroke-linecap="butt" ` +
        `stroke-dasharray="${arc.toFixed(2)} ${(circumference - arc).toFixed(2)}" ` +
        `stroke-dashoffset="${(-offset).toFixed(2)}" ` +
        `transform="rotate(-90 ${centre} ${centre})">` +
        `<title>${e(entry.label)}: ${entry.value}</title></circle>`;
      offset += length;
      return segment;
    })
    .join('');

  body =
    `<svg viewBox="0 0 ${size} ${size}" role="img" ` +
    `aria-label="Findings by severity: ${e(entries.map((x) => `${x.value} ${x.label.toLowerCase()}`).join(', '))}">` +
    segments +
    `<text x="${centre}" y="${centre - 4}" text-anchor="middle" font-size="26" font-weight="750" ` +
    `fill="var(--text)">${total}</text>` +
    `<text x="${centre}" y="${centre + 16}" text-anchor="middle" font-size="10" ` +
    'fill="var(--text-muted)" letter-spacing="1">FINDING' + (total === 1 ? '' : 'S') + '</text>' +
    '</svg>';

  const legend =
    '<div class="legend">' +
    entries
      .map(
        (entry) =>
          `<span class="sev-${entry.key}"><i style="background:var(--sev-solid)"></i>` +
          `${e(entry.label)} <b>${entry.value}</b></span>`,
      )
      .join('') +
    '</div>';

  return { body, legend, total };
}

/**
 * Horizontal bars — the default for "which of these is worst".
 *
 * Horizontal because the labels are endpoint paths and page URLs, which do not fit
 * under a vertical bar without rotating them 45 degrees and becoming unreadable.
 */
export function horizontalBars(rows, { max = null, unit = 'ms', height = 26 } = {}) {
  const data = rows.filter((row) => Number.isFinite(Number(row.value)));
  if (data.length === 0) return { body: '', legend: '' };

  const ceiling = max ?? Math.max(...data.map((row) => Number(row.value)));
  const labelWidth = 128;
  const valueWidth = 62;
  const gap = 6;
  const chartWidth = 420;
  const barArea = chartWidth - labelWidth - valueWidth - gap * 2;
  const totalHeight = data.length * height + 4;

  const format = (value) =>
    unit === 'bytes' ? formatBytes(value) : unit === 'ms' ? formatDuration(value) : String(value);

  const bars = data
    .map((row, index) => {
      const y = index * height + 2;
      const width = ceiling > 0 ? Math.max(2, (Number(row.value) / ceiling) * barArea) : 2;
      const fill = row.className
        ? 'var(--sev-solid)'
        : row.colour ?? CATEGORICAL[index % CATEGORICAL.length];
      const cls = row.className ? ` class="${e(row.className)}"` : '';
      return (
        `<g${cls}>` +
        `<title>${e(row.label)} — ${e(row.display ?? format(row.value))}</title>` +
        `<text x="0" y="${y + height / 2}" dominant-baseline="central" font-size="11" ` +
        `fill="var(--text-soft)">${e(truncate(row.label, 22))}</text>` +
        `<rect x="${labelWidth + gap}" y="${y + 4}" width="${barArea}" height="${height - 12}" ` +
        'rx="3" fill="var(--surface-sunken)"/>' +
        `<rect x="${labelWidth + gap}" y="${y + 4}" width="${width.toFixed(1)}" height="${height - 12}" ` +
        `rx="3" style="fill:${fill}"/>` +
        `<text x="${chartWidth}" y="${y + height / 2}" text-anchor="end" dominant-baseline="central" ` +
        `font-size="11" font-weight="600" fill="var(--text)">${e(row.display ?? format(row.value))}</text>` +
        '</g>'
      );
    })
    .join('');

  return {
    body:
      `<svg viewBox="0 0 ${chartWidth} ${totalHeight}" role="img" ` +
      `aria-label="${e(data.map((r) => `${r.label} ${r.display ?? format(r.value)}`).join('; '))}">` +
      bars +
      '</svg>',
    legend: '',
  };
}

/**
 * A request waterfall: when each request started and how long it took.
 *
 * This is the one chart that shows a *shape* rather than a ranking — a staircase means
 * serial requests, a solid block means a burst, and a repeated pair at the same offset
 * is the duplicate-request bug that a table of totals hides completely.
 */
export function waterfall(requests, { limit = 24 } = {}) {
  const rows = requests
    .filter((request) => Number.isFinite(Number(request.startedMs)) || Number.isFinite(Number(request.durationMs)))
    .slice(0, limit);
  if (rows.length === 0) return { body: '', legend: '', truncated: 0 };

  const span = Math.max(
    1,
    ...rows.map((row) => (Number(row.startedMs) || 0) + (Number(row.durationMs) || 0)),
  );
  const labelWidth = 150;
  const chartWidth = 480;
  const trackWidth = chartWidth - labelWidth - 52;
  const rowHeight = 20;
  const axisHeight = 16;
  const totalHeight = rows.length * rowHeight + axisHeight + 6;

  const ISSUE_COLOUR = {
    failed: 'var(--sev-solid)',
    slow: 'var(--sev-solid)',
    duplicate: 'var(--sev-solid)',
  };

  const bars = rows
    .map((row, index) => {
      const y = index * rowHeight + axisHeight;
      const start = ((Number(row.startedMs) || 0) / span) * trackWidth;
      const width = Math.max(2, ((Number(row.durationMs) || 0) / span) * trackWidth);
      const severity = issueSeverity(row);
      const fill = severity ? ISSUE_COLOUR[row.issue] ?? 'var(--sev-solid)' : 'var(--tone,#0ba5ec)';
      const cls = severity ? ` class="sev-${severity}"` : ' class="tone-accent"';
      const label = `${row.method ?? ''} ${pathOf(row.url)}`.trim();
      return (
        `<g${cls}>` +
        `<title>${e(label)} — ${e(formatDuration(row.durationMs))}` +
        `${row.status ? ` · HTTP ${row.status}` : ''}${row.issue ? ` · ${row.issue}` : ''}</title>` +
        `<text x="0" y="${y + rowHeight / 2}" dominant-baseline="central" font-size="10" ` +
        `fill="var(--text-soft)" font-family="var(--mono)">${e(truncate(label, 26))}</text>` +
        `<rect x="${(labelWidth + start).toFixed(1)}" y="${y + 4}" width="${width.toFixed(1)}" ` +
        `height="${rowHeight - 9}" rx="2" style="fill:${fill}"/>` +
        `<text x="${chartWidth}" y="${y + rowHeight / 2}" text-anchor="end" dominant-baseline="central" ` +
        `font-size="10" fill="var(--text-muted)">${e(formatDuration(row.durationMs))}</text>` +
        '</g>'
      );
    })
    .join('');

  // Four ticks: enough to read an offset, few enough not to fence in the bars.
  const ticks = [0, 0.25, 0.5, 0.75, 1]
    .map((fraction) => {
      const x = labelWidth + fraction * trackWidth;
      return (
        `<line class="gridline" x1="${x.toFixed(1)}" y1="${axisHeight - 4}" x2="${x.toFixed(1)}" ` +
        `y2="${totalHeight - 4}"/>` +
        `<text class="axis" x="${x.toFixed(1)}" y="6" text-anchor="middle">` +
        `${e(formatDuration(span * fraction))}</text>`
      );
    })
    .join('');

  return {
    body:
      `<svg viewBox="0 0 ${chartWidth} ${totalHeight}" role="img" ` +
      `aria-label="Request waterfall over ${e(formatDuration(span))}, ${rows.length} requests">` +
      ticks +
      bars +
      '</svg>',
    legend: '',
    truncated: Math.max(0, requests.length - rows.length),
  };
}

function issueSeverity(request) {
  if (request.issue === 'failed' || (Number(request.status) >= 500)) return 'critical';
  if (Number(request.status) >= 400) return 'high';
  if (request.issue === 'slow' || request.issue === 'n-plus-one') return 'high';
  if (request.issue) return 'medium';
  return null;
}

/**
 * A bullet bar for one Core Web Vital: the measurement against its two thresholds.
 *
 * A raw "LCP 3200ms" means nothing to a product manager. The same number sitting past
 * the green band and inside the amber one is instantly legible, which is the whole
 * reason Lighthouse draws it this way.
 */
export function vitalsBullets(performance) {
  const keys = Object.keys(VITALS).filter(
    (key) => performance?.[key] !== undefined && performance?.[key] !== null,
  );
  if (keys.length === 0) return { body: '', legend: '' };

  const width = 420;
  const rowHeight = 34;
  const labelWidth = 96;
  const valueWidth = 66;
  const trackWidth = width - labelWidth - valueWidth - 12;

  const rows = keys
    .map((key, index) => {
      const spec = VITALS[key];
      const value = Number(performance[key]);
      const band = vitalBand(key, value);
      // The axis runs to 1.5× the poor threshold so a bad measurement still lands on
      // the chart instead of pinning to the right edge with no sense of how bad.
      const ceiling = Math.max(spec.poor * 1.5, value * 1.05);
      const y = index * rowHeight + 4;
      const x = labelWidth + 6;
      const goodWidth = (spec.good / ceiling) * trackWidth;
      const warnWidth = ((spec.poor - spec.good) / ceiling) * trackWidth;
      const poorWidth = trackWidth - goodWidth - warnWidth;
      const marker = Math.min(trackWidth, (value / ceiling) * trackWidth);
      const shown =
        spec.unit === 'bytes' ? formatBytes(value)
          : spec.unit === 'ms' ? formatDuration(value)
            : value.toFixed(key === 'cls' ? 3 : 0);
      return (
        `<g class="tone-${band}">` +
        `<title>${e(spec.full)}: ${e(shown)} (good under ${e(thresholdLabel(spec, spec.good))}, ` +
        `poor over ${e(thresholdLabel(spec, spec.poor))})</title>` +
        `<text x="0" y="${y + 12}" dominant-baseline="central" font-size="11" font-weight="600" ` +
        `fill="var(--text-soft)">${e(spec.label)}</text>` +
        `<rect x="${x}" y="${y + 6}" width="${goodWidth.toFixed(1)}" height="12" rx="2" ` +
        'fill="#17b26a" opacity=".22"/>' +
        `<rect x="${(x + goodWidth).toFixed(1)}" y="${y + 6}" width="${Math.max(0, warnWidth).toFixed(1)}" ` +
        'height="12" rx="2" fill="#f79009" opacity=".22"/>' +
        `<rect x="${(x + goodWidth + warnWidth).toFixed(1)}" y="${y + 6}" ` +
        `width="${Math.max(0, poorWidth).toFixed(1)}" height="12" rx="2" fill="#f04438" opacity=".18"/>` +
        `<rect x="${(x + marker - 1.5).toFixed(1)}" y="${y + 2}" width="3" height="20" rx="1.5" ` +
        'style="fill:var(--tone)"/>' +
        `<text x="${width}" y="${y + 12}" text-anchor="end" dominant-baseline="central" font-size="11" ` +
        `font-weight="650" style="fill:var(--tone)">${e(shown)}</text>` +
        '</g>'
      );
    })
    .join('');

  return {
    body:
      `<svg viewBox="0 0 ${width} ${keys.length * rowHeight + 8}" role="img" ` +
      'aria-label="Core Web Vitals against their thresholds">' +
      rows +
      '</svg>',
    legend:
      '<div class="legend">' +
      '<span><i style="background:#17b26a"></i>Good</span>' +
      '<span><i style="background:#f79009"></i>Needs improvement</span>' +
      '<span><i style="background:#f04438"></i>Poor</span>' +
      '</div>',
  };
}

function thresholdLabel(spec, value) {
  if (spec.unit === 'bytes') return formatBytes(value);
  if (spec.unit === 'ms') return formatDuration(value);
  return String(value);
}

/**
 * Page health as a stacked bar per page: how many findings, at what severity.
 *
 * One row per page makes the worst page obvious at a glance, which is the question a
 * multi-page run exists to answer.
 */
export function pageHealthBars(pages, findings) {
  const rows = pages
    .map((page) => {
      const own = findings.filter(
        (finding) => finding.page === page.url || (page.findingIds ?? []).includes(finding.id),
      );
      const counts = {};
      for (const key of SEVERITY_ORDER) {
        counts[key] = own.filter((finding) => finding.severity === key).length;
      }
      return { page, counts, total: own.length };
    })
    .sort((a, b) => weight(b.counts) - weight(a.counts));

  if (rows.length === 0) return { body: '', legend: '' };

  const width = 460;
  const rowHeight = 26;
  const labelWidth = 190;
  const trackWidth = width - labelWidth - 40;
  const maxTotal = Math.max(1, ...rows.map((row) => row.total));

  const bars = rows
    .map((row, index) => {
      const y = index * rowHeight;
      let x = labelWidth;
      const segments = SEVERITY_ORDER.filter((key) => row.counts[key] > 0)
        .map((key) => {
          const segmentWidth = (row.counts[key] / maxTotal) * trackWidth;
          const rect =
            `<rect class="sev-${key}" x="${x.toFixed(1)}" y="${y + 7}" ` +
            `width="${Math.max(2, segmentWidth).toFixed(1)}" height="12" rx="2" ` +
            `style="fill:var(--sev-solid)"><title>${e(SEVERITY[key].label)}: ${row.counts[key]}</title></rect>`;
          x += segmentWidth + 1;
          return rect;
        })
        .join('');
      const label = row.page.title || pathOf(row.page.url) || row.page.url;
      return (
        `<g><text x="0" y="${y + 13}" dominant-baseline="central" font-size="11" ` +
        `fill="var(--text-soft)">${e(truncate(label, 32))}</text>` +
        (row.total === 0
          ? `<rect x="${labelWidth}" y="${y + 7}" width="14" height="12" rx="2" fill="#17b26a" opacity=".35">` +
            '<title>No findings</title></rect>'
          : segments) +
        `<text x="${width}" y="${y + 13}" text-anchor="end" dominant-baseline="central" font-size="11" ` +
        `font-weight="600" fill="var(--text)">${row.total || '—'}</text></g>`
      );
    })
    .join('');

  return {
    body:
      `<svg viewBox="0 0 ${width} ${rows.length * rowHeight + 4}" role="img" ` +
      'aria-label="Findings per page by severity">' +
      bars +
      '</svg>',
    legend:
      '<div class="legend">' +
      SEVERITY_ORDER.map(
        (key) =>
          `<span class="sev-${key}"><i style="background:var(--sev-solid)"></i>${e(SEVERITY[key].label)}</span>`,
      ).join('') +
      '</div>',
  };
}

function weight(counts) {
  return (counts.critical ?? 0) * 1000 + (counts.high ?? 0) * 100 + (counts.medium ?? 0) * 10 + (counts.low ?? 0);
}

/** The path portion of a URL, for a label that has to fit. */
export function pathOf(url) {
  const text = String(url ?? '');
  const withoutScheme = text.includes('://') ? text.slice(text.indexOf('://') + 3) : text;
  const slash = withoutScheme.indexOf('/');
  return slash === -1 ? withoutScheme : withoutScheme.slice(slash) || '/';
}

/** Shorten from the middle, so an endpoint keeps both its resource and its verb. */
export function truncate(text, max) {
  const value = String(text ?? '');
  if (value.length <= max) return value;
  const keep = Math.floor((max - 1) / 2);
  return `${value.slice(0, keep)}…${value.slice(value.length - (max - keep - 1))}`;
}
