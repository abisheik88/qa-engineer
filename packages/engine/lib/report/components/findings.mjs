// The finding card — the unit of the report a developer actually works from.
//
// ## Collapsed by default, and why the summary has to carry weight
//
// A report with twenty findings expanded is a wall nobody reads. Collapsed, the
// summary row is all most readers ever see, so it carries the four things needed to
// triage without opening anything: severity, what is wrong, where, and whether it was
// confirmed. Everything else lives inside.
//
// `<details>` rather than a JavaScript accordion: it opens with no script, it is
// keyboard-operable and screen-reader-announced for free, and Ctrl-F finds text inside
// a closed one in Chrome. The print stylesheet forces every one open, because a
// printed report of collapsed headings is a printed table of contents.
//
// ## The order of the body
//
//   what happens now → what should happen → why it matters → how to see it
//   → why it happens → how to fix it → what to re-test → the proof
//
// A reader who stops one third of the way down still has the defect, the gap, and the
// business consequence. Root cause and fix direction come after that, because they are
// what an engineer needs and the first three are what everyone needs.

import {
  e, slug, severityBadge, statusPill, chip, icon, plural,
} from './primitives.mjs';
import { evidenceGrid } from './evidence.mjs';
import { SEVERITY } from '../theme/tokens.mjs';

const DIMENSION_LABEL = Object.freeze({
  functional: 'Functionality',
  api: 'API',
  performance: 'Performance',
  security: 'Security',
  ui: 'UI',
  ux: 'UX',
  data: 'Data',
  accessibility: 'Accessibility',
  console: 'Console',
});

const STATUS_LABEL = Object.freeze({
  confirmed: 'Confirmed',
  'validated-user-report': 'Validated user report',
  'could-not-reproduce': 'Could not reproduce',
  partial: 'Partially reproduced',
  'fixed-in-run': 'Fixed during the run',
});

const LAYER_LABEL = Object.freeze({
  frontend: 'Frontend',
  backend: 'Backend',
  network: 'Network',
  data: 'Data',
  infrastructure: 'Infrastructure',
  'third-party': 'Third party',
  unknown: 'Unknown',
});

export function dimensionLabel(dimension) {
  return DIMENSION_LABEL[dimension] ?? dimension ?? '';
}

export function findingAnchor(id) {
  return slug(id, 'f-');
}

/**
 * Reproduction as steps when the run recorded steps, as prose otherwise.
 *
 * `steps[]` is the contract's structured form and is used when present. Failing that,
 * numbered prose is split on its own numbering — nothing invented, nothing reordered.
 * Unnumbered prose is left exactly as written, because guessing sentence boundaries in
 * a repro turns "click Save. Wait 3s." into two steps that are really one.
 */
function reproBlock(finding) {
  if (Array.isArray(finding.steps) && finding.steps.length > 0) {
    return `<ol class="steps">${finding.steps.map((step) => `<li>${e(step)}</li>`).join('')}</ol>`;
  }
  const text = String(finding.repro ?? '').trim();
  if (!text) return '<span class="empty">Not recorded</span>';

  let lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 1) {
    lines = text.split(/\s+(?=\d+[.)]\s)/).map((part) => part.trim()).filter(Boolean);
  }
  if (lines.length < 2 || !lines.every((line) => /^\d+[.)]\s/.test(line))) {
    return e(text);
  }
  const steps = lines.map((line) => line.replace(/^\d+[.)]\s*/, ''));
  return `<ol class="steps">${steps.map((step) => `<li>${e(step)}</li>`).join('')}</ol>`;
}

/** A labelled row in the behaviour list. */
function row(term, body, railClass = null) {
  if (!body) return '';
  return `<dt>${e(term)}</dt><dd${railClass ? ` class="rail ${railClass}"` : ''}>${body}</dd>`;
}

/** The metrics table that turns "slow" into a number with a budget beside it. */
function metricsPanel(metrics) {
  if (!metrics || metrics.length === 0) return '';
  const rows = metrics
    .map(
      (metric) =>
        '<tr>' +
        `<td>${e(metric.label)}</td>` +
        `<td class="num"${metric.breached ? ' style="color:var(--sev-solid);font-weight:650"' : ''}>` +
        `${e(metric.value)}</td>` +
        `<td class="num muted">${e(metric.budget ?? '—')}</td>` +
        '</tr>',
    )
    .join('');
  return (
    '<div class="table-wrap" style="margin-top:1rem"><table>' +
    '<thead><tr><th>Measurement</th><th class="num">Observed</th><th class="num">Budget</th></tr></thead>' +
    `<tbody>${rows}</tbody></table></div>`
  );
}

/** Root cause: the investigation, rendered as a causal chain rather than a paragraph. */
function rootCausePanel(rootCause) {
  if (!rootCause?.summary) return '';
  const chain =
    Array.isArray(rootCause.chain) && rootCause.chain.length > 0
      ? `<ol class="chain" style="margin-top:.5rem">${rootCause.chain.map((step) => `<li>${e(step)}</li>`).join('')}</ol>`
      : '';
  const meta = [
    rootCause.layer ? chip(LAYER_LABEL[rootCause.layer] ?? rootCause.layer) : '',
    Number.isFinite(rootCause.confidence)
      ? chip(`${Math.round(rootCause.confidence * 100)}% confidence`)
      : '',
  ]
    .filter(Boolean)
    .join('');
  return (
    `<div>${e(rootCause.summary)}${chain}` +
    (meta ? `<div style="margin-top:.5rem;display:flex;gap:.375rem;flex-wrap:wrap">${meta}</div>` : '') +
    '</div>'
  );
}

/** What QA re-runs once the fix lands — the half of a bug report that usually goes missing. */
function regressionPanel(regression) {
  if (!regression?.level) return '';
  const tone = { high: 'critical', medium: 'medium', low: 'low' }[regression.level] ?? 'low';
  const retest =
    Array.isArray(regression.retest) && regression.retest.length > 0
      ? `<ul class="clean" style="margin-top:.5rem">${regression.retest.map((item) => `<li>${e(item)}</li>`).join('')}</ul>`
      : '';
  return (
    `<div><span class="badge sev-${tone}">${e(regression.level)} risk</span>` +
    (regression.note ? `<div style="margin-top:.375rem">${e(regression.note)}</div>` : '') +
    retest +
    '</div>'
  );
}

/**
 * One finding, collapsed.
 *
 * `data-*` attributes on the element carry everything the client-side filter needs, so
 * search and severity filtering run without a second copy of the findings in a script
 * block — the DOM is the index.
 */
export function findingCard(finding, registry, { open = false } = {}) {
  const severity = SEVERITY[finding.severity] ? finding.severity : 'low';
  const anchor = findingAnchor(finding.id);
  const tags = Array.isArray(finding.tags) ? finding.tags : [];

  // Everything a reader might type into the search box, flattened once at render time.
  const haystack = [
    finding.id, finding.title, finding.actual, finding.expected, finding.fixDirection,
    finding.businessImpact, finding.developerNotes, finding.page,
    finding.rootCause?.summary, dimensionLabel(finding.dimension),
    ...tags, ...(finding.affectedApis ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const meta = [
    `<span class="finding-id">${e(finding.id)}</span>`,
    chip(dimensionLabel(finding.dimension)),
    statusPill(finding.status, STATUS_LABEL[finding.status] ?? finding.status),
    finding.page ? chip(finding.page) : '',
    ...tags.map((tag) => chip(tag)),
  ]
    .filter(Boolean)
    .join('');

  const body = [
    '<dl class="behaviour">',
    row('Current behaviour', e(finding.actual), 'rail-now'),
    row('Expected behaviour', e(finding.expected), 'rail-want'),
    row('Business impact', finding.businessImpact ? e(finding.businessImpact) : '', 'rail-impact'),
    row('Reproduction', reproBlock(finding)),
    row('Root cause', rootCausePanel(finding.rootCause), 'rail-cause'),
    row('Suggested fix', e(finding.fixDirection), 'rail-fix'),
    row('Regression risk', regressionPanel(finding.regressionRisk)),
    row(
      'Affected APIs',
      (finding.affectedApis ?? []).map((api) => `<code>${e(api)}</code>`).join(' '),
    ),
    row('Developer notes', finding.developerNotes ? e(finding.developerNotes) : ''),
    '</dl>',
    metricsPanel(finding.metrics),
    evidenceGrid(finding.evidence, registry),
  ].join('');

  return (
    `<details class="finding sev-${severity}" id="${e(anchor)}"${open ? ' open' : ''} ` +
    `data-severity="${e(severity)}" data-dimension="${e(finding.dimension ?? '')}" ` +
    `data-status="${e(finding.status ?? '')}" data-page="${e(finding.page ?? '')}" ` +
    `data-tags="${e(tags.join(' '))}" data-search="${e(haystack)}">` +
    '<summary>' +
    severityBadge(severity) +
    '<span class="finding-grow">' +
    `<span class="finding-title">${e(finding.title)}</span>` +
    `<span class="finding-meta">${meta}</span>` +
    '</span>' +
    `<span class="caret">${icon('chevron', 18)}</span>` +
    '</summary>' +
    `<div class="finding-body">${body}</div>` +
    '</details>'
  );
}

/** Every finding, worst first, with a stable tie-break so reruns diff cleanly. */
export function findingList(findings, registry) {
  const sorted = [...findings].sort((a, b) => {
    const rank = (SEVERITY[a.severity] ?? SEVERITY.low).rank - (SEVERITY[b.severity] ?? SEVERITY.low).rank;
    return rank !== 0 ? rank : String(a.id).localeCompare(String(b.id), 'en', { numeric: true });
  });
  if (sorted.length === 0) {
    return '<div class="card"><div class="card-body empty">No findings recorded.</div></div>';
  }
  return (
    sorted.map((finding) => findingCard(finding, registry)).join('') +
    '<div class="no-results" id="no-results">' +
    `<p><strong>Nothing matches those filters.</strong></p><p>${e(plural(sorted.length, 'finding'))} in total — ` +
    'clear the search box or reset the severity filters to see them.</p></div>'
  );
}

/** The severity legend, so a reader can calibrate without asking what "high" means. */
export function severityLegend() {
  const rows = Object.entries(SEVERITY)
    .sort((a, b) => a[1].rank - b[1].rank)
    .map(([key, value]) => `<tr><td>${severityBadge(key)}</td><td>${e(value.meaning)}</td></tr>`)
    .join('');
  return (
    '<div class="table-wrap"><table><thead><tr><th>Severity</th><th>What it claims</th></tr></thead>' +
    `<tbody>${rows}</tbody></table></div>`
  );
}

export { STATUS_LABEL, DIMENSION_LABEL };
