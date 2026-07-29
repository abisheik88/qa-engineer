// Design tokens for the report.
//
// One source for colour, type, and spacing, consumed twice: the stylesheet emits
// them as custom properties, and the SVG charts read the JavaScript values directly
// because an `<svg>` attribute cannot resolve `var(--sev-critical)` in every renderer
// that matters (Safari's print path and most PDF engines drop it).
//
// So a severity has exactly one red, and a chart cannot drift from the badge beside
// it. Adding a severity means adding it here, and the badge, the donut segment, and
// the legend all learn about it at once.

/**
 * Severity is the report's primary signal, so it gets a full ramp rather than a
 * single hex: a badge needs a readable foreground on a tinted chip, a chart needs a
 * saturated fill, and dark mode needs both again at a different luminance.
 */
export const SEVERITY = Object.freeze({
  critical: {
    label: 'Critical',
    rank: 0,
    light: { fg: '#8a1c13', bg: '#fef3f2', border: '#fda29b', solid: '#d92d20' },
    dark: { fg: '#ffbdb5', bg: 'rgba(217,45,32,.16)', border: 'rgba(253,162,155,.32)', solid: '#f97066' },
    meaning: 'Blocks release. Data loss, a security hole, or a core flow that cannot be completed.',
  },
  high: {
    label: 'High',
    rank: 1,
    light: { fg: '#b93815', bg: '#fff4ed', border: '#f9b98c', solid: '#ef6820' },
    dark: { fg: '#ffc9a8', bg: 'rgba(239,104,32,.16)', border: 'rgba(249,185,140,.32)', solid: '#f38744' },
    meaning: 'Fix before release. A user hits this on a normal path and the product does the wrong thing.',
  },
  medium: {
    label: 'Medium',
    rank: 2,
    light: { fg: '#a15c07', bg: '#fffaeb', border: '#fedf89', solid: '#f79009' },
    dark: { fg: '#fedf89', bg: 'rgba(247,144,9,.14)', border: 'rgba(254,223,137,.3)', solid: '#fdb022' },
    meaning: 'Fix soon. Real but survivable — a workaround exists, or the path is less common.',
  },
  low: {
    label: 'Low',
    rank: 3,
    light: { fg: '#3538cd', bg: '#eef4ff', border: '#b2ccff', solid: '#6172f3' },
    dark: { fg: '#b2ccff', bg: 'rgba(97,114,243,.16)', border: 'rgba(178,204,255,.3)', solid: '#8098f9' },
    meaning: 'Worth fixing. Polish, hygiene, or a measurement that needs confirming before it is acted on.',
  },
});

/** Non-severity status colours: test outcomes, check results, page health. */
export const STATUS = Object.freeze({
  passed: { label: 'Passed', light: { fg: '#067647', bg: '#ecfdf3', solid: '#17b26a' }, dark: { fg: '#75e0a7', bg: 'rgba(23,178,106,.14)', solid: '#47cd89' } },
  failed: { label: 'Failed', light: { fg: '#b42318', bg: '#fef3f2', solid: '#f04438' }, dark: { fg: '#fda29b', bg: 'rgba(240,68,56,.14)', solid: '#f97066' } },
  blocked: { label: 'Blocked', light: { fg: '#b54708', bg: '#fffaeb', solid: '#f79009' }, dark: { fg: '#fedf89', bg: 'rgba(247,144,9,.14)', solid: '#fdb022' } },
  skipped: { label: 'Skipped', light: { fg: '#475467', bg: '#f2f4f7', solid: '#98a2b3' }, dark: { fg: '#cdd5df', bg: 'rgba(152,162,179,.14)', solid: '#98a2b3' } },
  neutral: { label: '—', light: { fg: '#475467', bg: '#f2f4f7', solid: '#98a2b3' }, dark: { fg: '#cdd5df', bg: 'rgba(152,162,179,.14)', solid: '#98a2b3' } },
});

/** The release decision, which owns the loudest surface on the page. */
export const VERDICT = Object.freeze({
  ship: { label: 'Ship it', tone: 'good', blurb: 'No release-blocking defects were found.' },
  'ship-with-risks': { label: 'Ship with risks', tone: 'warn', blurb: 'Releasable, but known defects go out with it.' },
  'do-not-ship': { label: 'Do not ship', tone: 'bad', blurb: 'At least one defect blocks release.' },
  'insufficient-data': { label: 'Insufficient data', tone: 'muted', blurb: 'The run could not establish enough to judge.' },
  // The four `classification` values, mapped onto the same surface so a result
  // without an `executive` block still renders a verdict rather than a blank strip.
  pass: { label: 'No defects found', tone: 'good', blurb: 'Nothing reportable was found in the areas covered.' },
  'issues-found': { label: 'Issues found', tone: 'warn', blurb: 'Defects were found and are listed below.' },
  blocked: { label: 'Blocked', tone: 'bad', blurb: 'The run could not complete.' },
  ready: { label: 'Ready to ship', tone: 'good', blurb: 'Every gate the run checked is green.' },
  'ready-with-risks': { label: 'Ready with risks', tone: 'warn', blurb: 'Releasable with known risks accepted.' },
  'not-ready': { label: 'Not ready', tone: 'bad', blurb: 'A gate the run checked is red.' },
});

/** A score's band. Lighthouse taught every reader what 0–49 / 50–89 / 90+ means. */
export function scoreBand(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 'muted';
  if (value >= 90) return 'good';
  if (value >= 50) return 'warn';
  return 'bad';
}

/** Tone colours, used by scores, verdict surfaces, and gauges. */
export const TONE = Object.freeze({
  good: { light: '#17b26a', dark: '#47cd89' },
  warn: { light: '#f79009', dark: '#fdb022' },
  bad: { light: '#f04438', dark: '#f97066' },
  muted: { light: '#98a2b3', dark: '#98a2b3' },
  accent: { light: '#5344e8', dark: '#9b8afb' },
});

/**
 * The categorical ramp for charts that plot something other than severity — API
 * timings, payload sizes, page health. Ordered for maximum separation between
 * neighbours, and checked against both backgrounds.
 */
export const CATEGORICAL = Object.freeze([
  '#5344e8', '#0ba5ec', '#17b26a', '#f79009', '#ee46bc', '#7a5af8', '#2ed3b7', '#f38744',
]);

/** Which colour a chart should use for `key`, in `mode` ('light' | 'dark'). */
export function colourFor(key, mode = 'light') {
  if (SEVERITY[key]) return SEVERITY[key][mode].solid;
  if (STATUS[key]) return STATUS[key][mode].solid;
  if (TONE[key]) return TONE[key][mode];
  return TONE.muted[mode];
}

/** Severity keys, worst first — the order findings and legends are rendered in. */
export const SEVERITY_ORDER = Object.freeze(
  Object.keys(SEVERITY).sort((a, b) => SEVERITY[a].rank - SEVERITY[b].rank),
);

/**
 * Core Web Vitals thresholds, as Google publishes them. Used to colour a metric tile
 * and to decide whether a number is worth a reader's attention — a report that shows
 * `LCP 4.1s` in the same grey as `TTFB 40ms` has buried the finding.
 */
export const VITALS = Object.freeze({
  lcpMs: { label: 'LCP', full: 'Largest Contentful Paint', good: 2500, poor: 4000, unit: 'ms', plain: 'How long until the main content is visible' },
  fcpMs: { label: 'FCP', full: 'First Contentful Paint', good: 1800, poor: 3000, unit: 'ms', plain: 'How long until anything is painted' },
  ttfbMs: { label: 'TTFB', full: 'Time to First Byte', good: 800, poor: 1800, unit: 'ms', plain: 'How long the server took to start responding' },
  inpMs: { label: 'INP', full: 'Interaction to Next Paint', good: 200, poor: 500, unit: 'ms', plain: 'How quickly the page responds to a click or tap' },
  cls: { label: 'CLS', full: 'Cumulative Layout Shift', good: 0.1, poor: 0.25, unit: '', plain: 'How much the layout jumps while loading' },
  longTaskMs: { label: 'Long tasks', full: 'Blocking main-thread time', good: 200, poor: 600, unit: 'ms', plain: 'Time the page spent unable to respond' },
  domNodes: { label: 'DOM nodes', full: 'DOM size', good: 1500, poor: 3000, unit: '', plain: 'How large the rendered page is' },
  jsHeapBytes: { label: 'JS heap', full: 'JavaScript heap used', good: 30e6, poor: 100e6, unit: 'bytes', plain: 'Memory the page is holding' },
});

/** 'good' | 'warn' | 'bad' for a vitals measurement, or 'muted' when unknown. */
export function vitalBand(key, value) {
  const spec = VITALS[key];
  const number = Number(value);
  if (!spec || !Number.isFinite(number)) return 'muted';
  if (number <= spec.good) return 'good';
  if (number <= spec.poor) return 'warn';
  return 'bad';
}
