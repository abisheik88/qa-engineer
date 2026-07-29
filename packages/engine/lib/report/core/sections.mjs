// The section registry: every block of the report, in reading order.
//
// A section is `{ id, title, navLabel, count, note, body }` and it is *omitted
// entirely when its body is empty*. That rule is what lets one renderer serve a
// two-finding smoke check and a twelve-page authenticated audit without either one
// looking padded: a run that never measured performance has no Performance section,
// rather than a Performance section reading "no data".
//
// Order is the argument the report makes:
//
//   verdict → what it means → what was covered → what is wrong → the measurements
//   behind it → the evidence → what to do → where everything came from
//
// Decision first, provenance last. A reader who stops after the second section still
// leaves with the right conclusion, and a reader who doubts it can walk all the way
// down to the file hashes.

import {
  e, kpi, scoreGauge, chip, statusPill, section, table, plural,
  formatDuration, formatBytes, compareNatural, vitalTile,
} from '../components/primitives.mjs';
import {
  severityDonut, horizontalBars, waterfall, vitalsBullets, pageHealthBars, chartCard,
  pathOf, truncate,
} from '../components/charts.mjs';
import { findingList, severityLegend, findingAnchor, dimensionLabel } from '../components/findings.mjs';
import { timelineList } from '../components/timeline.mjs';
import { artifactFigure, artifactTable, evidenceLabel } from '../components/evidence.mjs';
import { SEVERITY_ORDER, VITALS } from '../theme/tokens.mjs';

const ADAPTER_PLAIN = Object.freeze({
  'playwright-mcp': 'a real browser driven by Playwright',
  'cursor-browser': "the editor's built-in browser",
  cdp: 'a real browser over the Chrome DevTools Protocol',
  'cli-playwright': 'a real browser driven by the Playwright CLI',
  'cli-other': 'a real browser driven from the command line',
  unavailable: 'no browser automation — findings come from artifacts supplied to the run',
});

const DIMENSION_PLAIN = Object.freeze({
  functional: 'Does the feature do what it is supposed to do, including when the input is wrong?',
  api: 'The network requests the page makes — whether they are correct, and how the page handles a bad response',
  performance: 'How much the page downloads and how quickly it becomes usable',
  security: 'Client-side exposure: where credentials and tokens are stored, what leaks into URLs and error messages',
  ui: 'Layout and visual states — empty, loading, error — including a narrow mobile screen',
  ux: 'Whether the flow makes sense to a person using it, and whether the wording helps them',
  data: 'Whether the numbers and text on screen match the system of record behind them',
  accessibility: 'Whether the page can be operated with a keyboard and understood by a screen reader',
  console: 'What the browser reported while the page ran — errors, warnings, unhandled rejections',
});

const AUTH_METHOD_LABEL = Object.freeze({
  none: 'None', form: 'Username and password form', sso: 'Single sign-on', oauth: 'OAuth',
  saml: 'SAML', 'azure-ad': 'Microsoft Entra ID', okta: 'Okta', auth0: 'Auth0',
  google: 'Google sign-in', microsoft: 'Microsoft sign-in', 'magic-link': 'Magic link',
  jwt: 'JWT', cookie: 'Cookie session', session: 'Server session', basic: 'HTTP basic',
  'api-key': 'API key', unknown: 'Unrecognised',
});

const SESSION_SOURCE_PLAIN = Object.freeze({
  'manual-login': 'a person signed in during the run and the session was captured afterwards',
  'reused-session': 'a stored session from an earlier run was reused',
  'not-required': 'no sign-in was needed',
  failed: 'sign-in did not succeed, so authenticated areas were not reached',
});

/* ── Overview ─────────────────────────────────────────────────────────────── */

function overviewSection(model) {
  const counts = model.severityCounts;
  const tiles = SEVERITY_ORDER.map((key) =>
    kpi({ value: counts[key] ?? 0, label: key, variant: `sev-${key}` }),
  );

  const tests = model.testCases;
  if (tests) {
    for (const key of ['passed', 'failed', 'blocked', 'skipped']) {
      if (tests[key] === undefined) continue;
      tiles.push(kpi({ value: tests[key], label: key, variant: `st-${key}` }));
    }
  }

  if (model.pages.length > 0) {
    tiles.push(kpi({ value: model.pages.length, label: 'Pages tested', zeroMuted: false }));
  }
  if (model.network?.totalRequests !== undefined) {
    tiles.push(kpi({
      value: model.network.totalRequests,
      label: 'Requests',
      sub: model.network.totalBytes ? formatBytes(model.network.totalBytes) : null,
      zeroMuted: false,
    }));
  }
  if (model.console?.errors !== undefined) {
    tiles.push(kpi({ value: model.console.errors, label: 'Console errors' }));
  }
  if (model.durationMs !== null) {
    tiles.push(kpi({ value: formatDuration(model.durationMs), label: 'Duration', zeroMuted: false }));
  }

  const scoreOrder = ['overall', 'functional', 'performance', 'accessibility', 'security', 'ux'];
  const gauges = scoreOrder
    .filter((key) => Number.isFinite(model.scores[key]))
    .map((key) => scoreGauge(model.scores[key], key === 'overall' ? 'Overall' : dimensionLabel(key) || key))
    .join('');

  const charts = [];
  const donut = severityDonut(counts);
  charts.push(chartCard({
    title: 'Findings by severity',
    body: donut.body,
    legend: donut.legend,
  }));

  if (model.pages.length > 1) {
    const health = pageHealthBars(model.pages, model.findings);
    charts.push(chartCard({ title: 'Findings by page', body: health.body, legend: health.legend }));
  }

  if (model.performance) {
    const bullets = vitalsBullets(model.performance);
    charts.push(chartCard({
      title: 'Core Web Vitals',
      body: bullets.body,
      legend: bullets.legend,
      note: 'Measured in this run, against Google’s published thresholds.',
    }));
  }

  const body =
    `<div class="kpis reveal">${tiles.join('')}</div>` +
    (gauges
      ? `<div class="scores reveal" style="margin-top:.75rem">${gauges}</div>` +
        (model.overallDerived
          ? '<p class="section-note" style="margin:.75rem 0 0">Overall is derived from the finding counts ' +
            '(100 less 35 per critical, 12 per high, 4 per medium, 1 per low). Every other score was measured.</p>'
          : '')
      : '') +
    (charts.filter(Boolean).length > 0
      ? `<div class="chart-grid reveal" style="margin-top:.75rem">${charts.join('')}</div>`
      : '');

  return { id: 'overview', title: 'Overview', navLabel: 'Overview', count: null, body };
}

/* ── Executive summary ────────────────────────────────────────────────────── */

function executiveSection(model) {
  const verdict = model.verdict;
  const parts = [];

  if (verdict.health) parts.push(`<p>${e(verdict.health)}</p>`);
  else if (model.summary) parts.push(`<p>${e(model.summary)}</p>`);

  if (verdict.risks.length > 0) {
    parts.push(
      '<h4 style="margin-top:1.25rem">Why</h4>' +
      `<ul class="clean">${verdict.risks.map((risk) => `<li>${e(risk)}</li>`).join('')}</ul>`,
    );
  }

  const panels = [];
  if (verdict.recommendedAction) {
    panels.push(
      `<div class="panel"><h4>Recommended action</h4><p>${e(verdict.recommendedAction)}</p></div>`,
    );
  }
  if (verdict.estimatedFixHours) {
    const { low, high } = verdict.estimatedFixHours;
    const range = low === high ? `${low}` : `${low}–${high}`;
    panels.push(
      `<div class="panel"><h4>Estimated fix time</h4><p><strong>${e(range)} hours</strong> of engineering ` +
      'time to clear the blocking findings.</p></div>',
    );
  }
  if (verdict.confidence !== null) {
    const percent = Math.round(verdict.confidence * 100);
    panels.push(
      `<div class="panel"><h4>Confidence</h4><p><strong>${percent}%</strong> — ` +
      `${e(percent >= 80 ? 'the run reproduced what it reports and measured what it claims.'
        : percent >= 60 ? 'most findings were reproduced; a few rest on a single observation.'
          : 'treat this as a first look; several findings need confirming before they are acted on.')}</p></div>`,
    );
  }

  if (parts.length === 0 && panels.length === 0) return { id: 'summary', body: '' };

  const body =
    '<div class="card reveal"><div class="card-body">' +
    parts.join('') +
    (panels.length > 0 ? `<div class="subgrid">${panels.join('')}</div>` : '') +
    (verdict.inferred
      ? '<p class="section-note" style="margin:1.25rem 0 0">This verdict was derived from the finding ' +
        'counts — the run did not state one of its own.</p>'
      : '') +
    '</div></div>';

  return { id: 'summary', title: 'Executive summary', navLabel: 'Summary', count: null, body };
}

/* ── Failing tests (release rollup) ───────────────────────────────────────── */

function failuresSection(model) {
  if (!model.failures || model.failures.length === 0) return { id: 'failures', body: '' };
  const rows = model.failures.map((failure) => (
    '<tr>' +
    `<td><code>${e(failure.test)}</code></td>` +
    `<td>${chip(failure.classification)}</td>` +
    `<td>${e(failure.reason)}</td>` +
    '</tr>'
  ));
  return {
    id: 'failures',
    title: 'Failing tests',
    navLabel: 'Failures',
    count: model.failures.length,
    body: table(['Test', 'Classification', 'Why it failed'], rows),
  };
}

/* ── Engineering summary (release rollup) ─────────────────────────────────── */

function engineeringSection(model) {
  const text = model.summaries?.engineering;
  if (!text) return { id: 'engineering', body: '' };
  return {
    id: 'engineering',
    title: 'Engineering summary',
    navLabel: 'Engineering',
    count: null,
    body: `<div class="card reveal"><div class="card-body"><p>${e(text)}</p></div></div>`,
  };
}

/* ── Coverage ─────────────────────────────────────────────────────────────── */

function coverageSection(model) {
  const blocks = [];
  const scope = model.scope ?? {};

  const intro = [];
  const adapter = ADAPTER_PLAIN[model.browserAdapter];
  const how = [];
  if (adapter) how.push(`opened the application in ${adapter}`);
  if (model.testCases?.total) {
    how.push(`worked through ${plural(model.testCases.total, 'test case')}`);
  }
  if (model.pages.length > 1) how.push(`visited ${plural(model.pages.length, 'page')}`);
  how.push('captured proof for every defect it reports');
  intro.push(
    '<p>This is an <strong>exploratory QA report</strong>. An AI QA engineer ' +
    `${how.slice(0, -1).join(', ')}${how.length > 1 ? ', and ' : ''}${how[how.length - 1]}.</p>`,
  );
  intro.push(
    '<p>Each finding says what happens today, what should happen instead, and how to see it ' +
    'for yourself — so nothing here has to be taken on trust.</p>',
  );
  if (scope.objective) intro.push(`<p>${e(scope.objective)}</p>`);

  blocks.push(`<div class="card reveal"><div class="card-body">${intro.join('')}</div></div>`);

  if (model.authentication) {
    const auth = model.authentication;
    const rows = [
      auth.required !== undefined ? `<tr><td>Sign-in required</td><td>${auth.required ? 'Yes' : 'No'}</td></tr>` : '',
      auth.method ? `<tr><td>Method</td><td>${e(AUTH_METHOD_LABEL[auth.method] ?? auth.method)}</td></tr>` : '',
      auth.detectedBy ? `<tr><td>Detected by</td><td>${e(auth.detectedBy)}</td></tr>` : '',
      auth.sessionSource
        ? `<tr><td>Session</td><td>${e(SESSION_SOURCE_PLAIN[auth.sessionSource] ?? auth.sessionSource)}</td></tr>`
        : '',
      auth.profile ? `<tr><td>Role</td><td>${e(auth.profile)}</td></tr>` : '',
      auth.note ? `<tr><td>Note</td><td>${e(auth.note)}</td></tr>` : '',
    ].filter(Boolean);
    if (rows.length > 0) {
      blocks.push(
        '<h4 style="margin-top:1.5rem">Authentication</h4>' +
        `<div class="table-wrap"><table><tbody>${rows.join('')}</tbody></table></div>`,
      );
    }
  }

  if (scope.covered?.length > 0) {
    blocks.push(
      '<h4 style="margin-top:1.5rem">Exercised in this run</h4>' +
      '<div class="card"><div class="card-body">' +
      `<ul class="clean">${scope.covered.map((item) => `<li>${e(item)}</li>`).join('')}</ul>` +
      '</div></div>',
    );
  }

  if (model.dimensionsRun.length > 0) {
    const rows = model.dimensionsRun.map(
      (dimension) =>
        `<tr><td><strong>${e(dimensionLabel(dimension))}</strong></td>` +
        `<td>${e(DIMENSION_PLAIN[dimension] ?? '')}</td></tr>`,
    );
    blocks.push(
      '<h4 style="margin-top:1.5rem">Areas checked</h4>' +
      table(['Area', 'What that means'], rows),
    );
  }

  if (model.pages.length > 0) {
    const rows = model.pages.map((page) => {
      const findings = model.findings.filter(
        (finding) => finding.page === page.url || (page.findingIds ?? []).includes(finding.id),
      );
      return (
        '<tr>' +
        `<td><strong>${e(page.title || pathOf(page.url))}</strong>` +
        `<div class="muted"><code>${e(page.url)}</code></div></td>` +
        `<td>${statusPill(page.status)}</td>` +
        `<td class="num">${e(page.httpStatus ?? '—')}</td>` +
        `<td class="num">${e(page.loadMs !== undefined ? formatDuration(page.loadMs) : '—')}</td>` +
        `<td class="num">${e(page.requests ?? '—')}</td>` +
        `<td>${findings.length === 0
          ? '<span class="muted">—</span>'
          : findings
            .map((finding) => `<a href="#${e(findingAnchor(finding.id))}"><code>${e(finding.id)}</code></a>`)
            .join(' ')}</td>` +
        '</tr>'
      );
    });
    blocks.push(
      '<h4 style="margin-top:1.5rem">Pages visited</h4>' +
      table(
        ['Page', 'State', { label: 'HTTP', numeric: true }, { label: 'Load', numeric: true },
          { label: 'Requests', numeric: true }, 'Findings'],
        rows,
      ),
    );
  }

  if (model.testCases?.cases?.length > 0) {
    const order = { fail: 0, blocked: 1, skipped: 2, pass: 3 };
    const rows = [...model.testCases.cases]
      .sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4) || compareNatural(a.id, b.id))
      .map((testCase) => {
        const link = testCase.findingId
          ? `<a href="#${e(findingAnchor(testCase.findingId))}"><code>${e(testCase.findingId)}</code></a>`
          : '<span class="muted">—</span>';
        return (
          '<tr>' +
          `<td><code>${e(testCase.id)}</code></td>` +
          `<td>${e(testCase.title)}${testCase.source === 'user-supplied' ? ' ' + chip('supplied') : ''}</td>` +
          `<td>${statusPill(testCase.status)}</td>` +
          `<td>${link}</td>` +
          '</tr>'
        );
      });
    blocks.push(
      '<h4 style="margin-top:1.5rem">Test cases</h4>' +
      table(['ID', 'Case', 'Result', 'Finding'], rows),
    );
  }

  if (model.notCovered.length > 0) {
    blocks.push(
      '<h4 style="margin-top:1.5rem">Not covered in this run</h4>' +
      '<div class="card"><div class="card-body">' +
      `<ul class="clean">${model.notCovered.map((item) => `<li>${e(item)}</li>`).join('')}</ul>` +
      '</div></div>',
    );
  }

  return {
    id: 'coverage',
    title: 'Coverage',
    navLabel: 'Coverage',
    count: model.pages.length || null,
    body: blocks.join(''),
  };
}

/* ── Findings ─────────────────────────────────────────────────────────────── */

function findingsSection(model, { toolbarHtml }) {
  // A release rollup has no findings by design — it has failing tests, which get their
  // own section. Printing "No findings recorded" above that list reads as a
  // contradiction.
  if (model.findings.length === 0 && model.failures.length > 0) return { id: 'findings', body: '' };

  const body =
    toolbarHtml +
    findingList(model.findings, model.registry) +
    '<h4 style="margin-top:1.75rem">What the severities claim</h4>' +
    severityLegend();

  return {
    id: 'findings',
    title: 'Findings',
    navLabel: 'Findings',
    count: model.findings.length,
    body,
  };
}

/* ── Performance ──────────────────────────────────────────────────────────── */

function performanceSection(model) {
  const perf = model.performance;
  if (!perf) return { id: 'performance', body: '' };

  const tiles = Object.keys(VITALS)
    .filter((key) => perf[key] !== undefined && perf[key] !== null)
    .map((key) => vitalTile(key, perf[key]))
    .join('');

  const weight = [
    ['jsBytes', 'JavaScript'], ['cssBytes', 'CSS'], ['imageBytes', 'Images'],
  ]
    .filter(([key]) => Number.isFinite(perf[key]))
    .map(([key, label]) => ({ label, value: perf[key], display: formatBytes(perf[key]) }));

  const charts = [];
  if (weight.length > 0) {
    const bars = horizontalBars(weight, { unit: 'bytes' });
    charts.push(chartCard({
      title: 'Page weight by resource type',
      body: bars.body,
      note: Number.isFinite(perf.totalBytes) ? `Total transferred ${formatBytes(perf.totalBytes)}.` : null,
    }));
  }

  const body =
    (tiles ? `<div class="kpis reveal">${tiles}</div>` : '') +
    (charts.length > 0 ? `<div class="chart-grid reveal" style="margin-top:.75rem">${charts.join('')}</div>` : '') +
    (perf.note ? `<div class="card" style="margin-top:.75rem"><div class="card-body">${e(perf.note)}</div></div>` : '');

  return {
    id: 'performance',
    title: 'Performance',
    navLabel: 'Performance',
    count: null,
    note: 'Measured on this run, in this environment. A development build over a local network is not a '
      + 'prediction of production.',
    body,
  };
}

/* ── API and network ──────────────────────────────────────────────────────── */

function apiSection(model) {
  const network = model.network;
  if (!network) return { id: 'api', body: '' };

  const tiles = [
    network.totalRequests !== undefined
      ? kpi({ value: network.totalRequests, label: 'Requests', zeroMuted: false })
      : '',
    network.failedRequests !== undefined
      ? kpi({ value: network.failedRequests, label: 'Failed', variant: 'st-failed' })
      : '',
    network.slowRequests !== undefined
      ? kpi({
        value: network.slowRequests,
        label: 'Slow',
        sub: network.slowThresholdMs ? `over ${formatDuration(network.slowThresholdMs)}` : null,
        variant: 'st-blocked',
      })
      : '',
    network.duplicateRequests !== undefined
      ? kpi({ value: network.duplicateRequests, label: 'Duplicated', variant: 'st-blocked' })
      : '',
    network.totalBytes !== undefined
      ? kpi({ value: formatBytes(network.totalBytes), label: 'Transferred', zeroMuted: false })
      : '',
  ].filter(Boolean);

  const endpoints = network.endpoints ?? [];
  const charts = [];

  const slowest = endpoints
    .filter((endpoint) => Number.isFinite(endpoint.durationMs))
    .slice()
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 8)
    .map((endpoint) => ({
      label: `${endpoint.method} ${pathOf(endpoint.url)}`,
      value: endpoint.durationMs,
      className: endpoint.issue === 'failed' || Number(endpoint.status) >= 400 ? 'sev-critical'
        : endpoint.issue === 'slow' ? 'sev-high' : null,
    }));
  if (slowest.length > 0) {
    const bars = horizontalBars(slowest, { unit: 'ms' });
    charts.push(chartCard({ title: 'Slowest endpoints', body: bars.body }));
  }

  const heaviest = endpoints
    .filter((endpoint) => Number.isFinite(endpoint.bytes) && endpoint.bytes > 0)
    .slice()
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 8)
    .map((endpoint) => ({
      label: `${endpoint.method} ${pathOf(endpoint.url)}`,
      value: endpoint.bytes,
    }));
  if (heaviest.length > 0) {
    const bars = horizontalBars(heaviest, { unit: 'bytes' });
    charts.push(chartCard({ title: 'Largest payloads', body: bars.body }));
  }

  const duplicates = endpoints
    .filter((endpoint) => Number(endpoint.count) > 1)
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((endpoint) => ({
      label: `${endpoint.method} ${pathOf(endpoint.url)}`,
      value: endpoint.count,
      display: `${endpoint.count}×`,
      className: 'sev-high',
    }));
  if (duplicates.length > 0) {
    const bars = horizontalBars(duplicates, { unit: 'count' });
    charts.push(chartCard({
      title: 'Repeated requests',
      body: bars.body,
      note: 'The same request sent more than once for a single interaction.',
    }));
  }

  const flow = waterfall(endpoints);
  if (flow.body) {
    charts.push(chartCard({
      title: 'Request waterfall',
      body: flow.body,
      note: flow.truncated > 0 ? `Showing the first 24 of ${endpoints.length} requests.` : null,
    }));
  }

  const rows = endpoints.slice(0, 40).map((endpoint) => {
    const statusTone = Number(endpoint.status) >= 500 ? 'sev-critical'
      : Number(endpoint.status) >= 400 ? 'sev-high' : null;
    return (
      '<tr>' +
      `<td><code>${e(endpoint.method)}</code></td>` +
      `<td><code title="${e(endpoint.url)}">${e(truncate(pathOf(endpoint.url), 44))}</code></td>` +
      // One class attribute, not two: a second `class` is ignored by every browser, so
      // the severity variable never resolved and a 500 rendered in body-text grey.
      `<td class="${statusTone ? `num ${statusTone}` : 'num'}"` +
      `${statusTone ? ' style="color:var(--sev-solid);font-weight:650"' : ''}>` +
      `${e(endpoint.status ?? '—')}</td>` +
      `<td class="num">${e(Number.isFinite(endpoint.durationMs) ? formatDuration(endpoint.durationMs) : '—')}</td>` +
      `<td class="num">${e(Number.isFinite(endpoint.bytes) ? formatBytes(endpoint.bytes) : '—')}</td>` +
      `<td class="num">${e(endpoint.count ?? 1)}</td>` +
      `<td>${endpoint.issue ? chip(endpoint.issue) : ''}${
        endpoint.findingId
          ? ` <a href="#${e(findingAnchor(endpoint.findingId))}"><code>${e(endpoint.findingId)}</code></a>`
          : ''
      }</td>` +
      '</tr>'
    );
  });

  const body =
    (tiles.length > 0 ? `<div class="kpis reveal">${tiles.join('')}</div>` : '') +
    (charts.length > 0 ? `<div class="chart-grid reveal" style="margin-top:.75rem">${charts.join('')}</div>` : '') +
    (rows.length > 0
      ? '<h4 style="margin-top:1.5rem">Requests</h4>' +
        table(
          ['Method', 'Endpoint', { label: 'Status', numeric: true }, { label: 'Time', numeric: true },
            { label: 'Size', numeric: true }, { label: 'Count', numeric: true }, 'Issue'],
          rows,
        ) +
        (endpoints.length > 40
          ? `<p class="section-note" style="margin-top:.5rem">Showing 40 of ${endpoints.length} requests, ` +
            'worst first.</p>'
          : '')
      : '');

  return { id: 'api', title: 'API and network', navLabel: 'API', count: endpoints.length || null, body };
}

/* ── Security ─────────────────────────────────────────────────────────────── */

function securitySection(model) {
  const security = model.security;
  if (!security || (security.checked === false && !security.summary)) {
    return { id: 'security', body: '' };
  }
  const rows = (security.checks ?? []).map((check) => {
    const link = check.findingId
      ? `<a href="#${e(findingAnchor(check.findingId))}"><code>${e(check.findingId)}</code></a>`
      : '';
    return (
      '<tr>' +
      `<td><strong>${e(check.check)}</strong></td>` +
      `<td>${statusPill(check.status)}</td>` +
      `<td>${e(check.detail ?? '')} ${link}</td>` +
      '</tr>'
    );
  });

  const failed = (security.checks ?? []).filter((check) => check.status === 'fail').length;
  const body =
    (security.summary
      ? `<div class="card reveal"><div class="card-body">${e(security.summary)}</div></div>`
      : '') +
    (rows.length > 0
      ? `<div style="margin-top:.75rem">${table(['Check', 'Result', 'Detail'], rows)}</div>`
      : '');

  return {
    id: 'security',
    title: 'Security',
    navLabel: 'Security',
    count: failed || null,
    note: 'Client-side observations only. This is not a penetration test, and nothing destructive was attempted.',
    body,
  };
}

/* ── Accessibility ────────────────────────────────────────────────────────── */

function accessibilitySection(model) {
  const a11y = model.accessibility;
  if (!a11y || (a11y.checked === false && !a11y.summary)) return { id: 'accessibility', body: '' };

  const impactRank = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  const rows = [...(a11y.violations ?? [])]
    .sort((a, b) => (impactRank[a.impact] ?? 4) - (impactRank[b.impact] ?? 4) || b.count - a.count)
    .map((violation) => {
      const tone = { critical: 'critical', serious: 'high', moderate: 'medium', minor: 'low' }[violation.impact] ?? 'low';
      return (
        '<tr>' +
        `<td><code>${e(violation.rule)}</code></td>` +
        `<td><span class="badge sev-${tone}">${e(violation.impact)}</span></td>` +
        `<td class="num">${e(violation.count)}</td>` +
        `<td>${e(violation.description ?? '')}` +
        (violation.selector ? `<div class="muted"><code>${e(violation.selector)}</code></div>` : '') +
        (violation.findingId
          ? ` <a href="#${e(findingAnchor(violation.findingId))}"><code>${e(violation.findingId)}</code></a>`
          : '') +
        '</td>' +
        '</tr>'
      );
    });

  const total = (a11y.violations ?? []).reduce((sum, violation) => sum + (violation.count ?? 0), 0);
  const body =
    (a11y.summary ? `<div class="card reveal"><div class="card-body">${e(a11y.summary)}</div></div>` : '') +
    (rows.length > 0
      ? `<div style="margin-top:.75rem">${table(
        ['Rule', 'Impact', { label: 'Instances', numeric: true }, 'What it means'], rows,
      )}</div>`
      : '');

  return {
    id: 'accessibility',
    title: 'Accessibility',
    navLabel: 'Accessibility',
    count: total || null,
    body,
  };
}

/* ── Console ──────────────────────────────────────────────────────────────── */

function consoleSection(model) {
  const consoleData = model.console;
  if (!consoleData) return { id: 'console', body: '' };

  const tiles = [
    consoleData.errors !== undefined ? kpi({ value: consoleData.errors, label: 'Errors', variant: 'st-failed' }) : '',
    consoleData.warnings !== undefined ? kpi({ value: consoleData.warnings, label: 'Warnings', variant: 'st-blocked' }) : '',
    consoleData.unhandledRejections !== undefined
      ? kpi({ value: consoleData.unhandledRejections, label: 'Unhandled promises', variant: 'st-failed' })
      : '',
    consoleData.deprecations !== undefined
      ? kpi({ value: consoleData.deprecations, label: 'Deprecations', variant: 'st-skipped' })
      : '',
  ].filter(Boolean);

  const rows = (consoleData.entries ?? []).slice(0, 30).map((entry) => (
    '<tr>' +
    `<td>${statusPill(entry.level === 'error' ? 'failed' : entry.level === 'warning' ? 'blocked' : 'skipped', entry.level)}</td>` +
    `<td><code>${e(truncate(entry.message, 160))}</code>` +
    (entry.source ? `<div class="muted"><code>${e(entry.source)}</code></div>` : '') +
    '</td>' +
    `<td class="num">${e(entry.count ?? 1)}</td>` +
    `<td>${entry.findingId
      ? `<a href="#${e(findingAnchor(entry.findingId))}"><code>${e(entry.findingId)}</code></a>`
      : ''}</td>` +
    '</tr>'
  ));

  const body =
    (tiles.length > 0 ? `<div class="kpis reveal">${tiles.join('')}</div>` : '') +
    (rows.length > 0
      ? `<div style="margin-top:.75rem">${table(
        ['Level', 'Message', { label: 'Count', numeric: true }, 'Finding'], rows,
      )}</div>`
      : '');

  return { id: 'console', title: 'Console', navLabel: 'Console', count: consoleData.errors ?? null, body };
}

/* ── Screenshots ──────────────────────────────────────────────────────────── */

function screenshotSection(model) {
  const shots = model.registry
    .list()
    .filter((record) => record.kind === 'screenshot' || record.renderAs === 'image' || record.renderAs === 'video');
  if (shots.length === 0) return { id: 'screenshots', body: '' };

  const present = shots.filter((record) => record.exists);
  const absent = shots.filter((record) => !record.exists);

  const body =
    (present.length > 0
      ? `<div class="evidence reveal">${present.map((record) => artifactFigure(record)).join('')}</div>`
      : '') +
    (absent.length > 0
      ? '<h4 style="margin-top:1.5rem">Captured but not found</h4>' +
        `<div class="evidence">${absent.map((record) => artifactFigure(record)).join('')}</div>`
      : '');

  return {
    id: 'screenshots',
    title: 'Screenshots',
    navLabel: 'Screenshots',
    count: present.length,
    note: 'Click any image to open it full size.',
    body,
  };
}

/* ── Timeline ─────────────────────────────────────────────────────────────── */

function timelineSection(model) {
  const body = timelineList(model.timeline);
  return { id: 'timeline', title: 'Execution timeline', navLabel: 'Timeline', count: null, body };
}

/* ── Data validation ──────────────────────────────────────────────────────── */

function dataSection(model) {
  const db = model.dbValidation;
  if (!db) return { id: 'data', body: '' };
  const blocks = [];
  const note = db.summary || (db.inScope ? 'In scope.' : 'Not in scope for this run.');
  blocks.push(`<div class="card reveal"><div class="card-body">${e(note)}</div></div>`);

  if (db.comparisons?.length > 0) {
    const rows = db.comparisons.map((comparison) => (
      '<tr>' +
      `<td>${e(comparison.metric)}</td>` +
      `<td><code>${e(comparison.uiValue)}</code></td>` +
      `<td><code>${e(comparison.sourceValue)}</code></td>` +
      `<td>${statusPill(comparison.match ? 'passed' : 'failed', comparison.match ? 'Match' : 'Mismatch')}</td>` +
      '</tr>'
    ));
    blocks.push(
      `<div style="margin-top:.75rem">${table(
        ['Metric', 'Shown in the UI', 'Source of truth', 'Result'], rows,
      )}</div>`,
    );
  }
  return { id: 'data', title: 'Data validation', navLabel: 'Data', count: null, body: blocks.join('') };
}

/* ── Recommendations ──────────────────────────────────────────────────────── */

function recommendationsSection(model) {
  const blocks = [];

  if (model.fixOrder.length > 0) {
    blocks.push(
      '<h4>Suggested order</h4>' +
      '<div class="card reveal"><div class="card-body">' +
      `<ol class="chain">${model.fixOrder.map((item) => `<li>${e(item)}</li>`).join('')}</ol>` +
      '</div></div>',
    );
  }

  if (model.recommendations.length > 0) {
    const rank = { high: 0, medium: 1, low: 2 };
    const rows = [...model.recommendations]
      .sort((a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3))
      .map((recommendation) => {
        const tone = { high: 'critical', medium: 'medium', low: 'low' }[recommendation.priority] ?? 'low';
        const links = (recommendation.findingIds ?? [])
          .map((id) => `<a href="#${e(findingAnchor(id))}"><code>${e(id)}</code></a>`)
          .join(' ');
        return (
          '<tr>' +
          `<td><strong>${e(recommendation.action)}</strong>` +
          (recommendation.rationale ? `<div class="muted">${e(recommendation.rationale)}</div>` : '') +
          (links ? `<div style="margin-top:.25rem">${links}</div>` : '') +
          '</td>' +
          `<td><span class="badge sev-${tone}">${e(recommendation.priority)}</span></td>` +
          `<td>${recommendation.owner ? chip(recommendation.owner) : ''}</td>` +
          `<td>${recommendation.effort ? chip(recommendation.effort) : ''}</td>` +
          '</tr>'
        );
      });
    blocks.push(
      `<h4 style="margin-top:1.5rem">Actions</h4>${table(['Action', 'Priority', 'Owner', 'Effort'], rows)}`,
    );
  }

  if (model.whatWorksWell.length > 0) {
    blocks.push(
      '<h4 style="margin-top:1.5rem">Verified working</h4>' +
      '<div class="card"><div class="card-body">' +
      `<ul class="clean">${model.whatWorksWell.map((item) => `<li>${e(item)}</li>`).join('')}</ul>` +
      '</div></div>',
    );
  }

  return {
    id: 'recommendations',
    title: 'Recommendations',
    navLabel: 'Recommendations',
    count: model.recommendations.length || null,
    body: blocks.join(''),
  };
}

/* ── Artifacts ────────────────────────────────────────────────────────────── */

function artifactSection(model) {
  const records = model.registry.list().filter((record) => record.declaredPath);
  if (records.length === 0 && model.evidence.length === 0) return { id: 'artifacts', body: '' };

  const stats = model.artifactStats;
  const tiles = [
    kpi({ value: stats.total, label: 'Artifacts', zeroMuted: false }),
    kpi({ value: stats.present, label: 'Present', variant: 'st-passed', zeroMuted: false }),
    kpi({ value: stats.missing, label: 'Missing', variant: 'st-failed' }),
    kpi({ value: formatBytes(stats.bytes), label: 'Total size', zeroMuted: false }),
  ].join('');

  const evidenceRows = model.evidence.map((entry) => {
    const record = model.registry.forEvidence(entry);
    return (
      '<tr>' +
      `<td>${e(evidenceLabel(entry.type))}</td>` +
      `<td>${e(entry.description ?? '')}</td>` +
      `<td>${record?.exists && record.href
        ? `<a href="${e(record.href)}" target="_blank" rel="noopener noreferrer"><code>${e(entry.source)}</code></a>`
        : `<code>${e(entry.source)}</code>`}</td>` +
      `<td>${record?.exists
        ? '<span class="pill st-passed">Present</span>'
        : '<span class="pill st-failed">Missing</span>'}</td>` +
      '</tr>'
    );
  });

  const body =
    `<div class="kpis reveal">${tiles}</div>` +
    (stats.missing > 0
      ? '<p class="section-note" style="margin-top:.75rem">Files listed as missing were referenced by the run ' +
        'but were not present when this report was rendered. The report shows a marker in their place rather ' +
        'than a broken image.</p>'
      : '') +
    (model.evidence.length > 0
      ? `<h4 style="margin-top:1.5rem">Evidence index</h4>${table(['Kind', 'Shows', 'File', 'State'], evidenceRows)}`
      : '') +
    (records.length > 0
      ? `<h4 style="margin-top:1.5rem">Registered artifacts</h4>${artifactTable(records)}`
      : '');

  return {
    id: 'artifacts',
    title: 'Artifacts',
    navLabel: 'Artifacts',
    count: stats.total,
    body,
  };
}

/* ── Appendix ─────────────────────────────────────────────────────────────── */

function appendixSection(model) {
  const producer = model.producer;
  // Named, but never acted on. Two agents handing the renderer the same JSON get
  // byte-identical documents; this line is the only place the difference appears.
  const producedBy = producer
    ? [producer.agent, producer.model, producer.skill].filter(Boolean).join(' · ') +
      (producer.version ? ` v${producer.version}` : '')
    : model.skill
      ? `${model.skill.name} v${model.skill.version}`
      : null;

  const rows = [
    model.contract ? `<tr><td>Contract</td><td><code>${e(model.contract.name)} v${e(model.contract.version)}</code></td></tr>` : '',
    producedBy ? `<tr><td>Produced by</td><td><code>${e(producedBy)}</code></td></tr>` : '',
    `<tr><td>Schema version</td><td><code>${e(model.versions.schemaVersion)}</code></td></tr>`,
    `<tr><td>Theme version</td><td><code>${e(model.versions.themeName)} v${e(model.versions.themeVersion)}</code></td></tr>`,
    `<tr><td>Renderer version</td><td><code>${e(model.versions.rendererVersion)}</code></td></tr>`,
    model.generatedAt ? `<tr><td>Generated</td><td>${e(model.generatedAt)}</td></tr>` : '',
    model.reportVersion ? `<tr><td>Report version</td><td>v${e(model.reportVersion)}</td></tr>` : '',
    model.browserAdapter
      ? `<tr><td>Observed with</td><td>${e(ADAPTER_PLAIN[model.browserAdapter] ?? model.browserAdapter)}</td></tr>`
      : '',
    model.environment ? `<tr><td>Environment</td><td>${e(model.environment)}</td></tr>` : '',
    model.durationMs !== null ? `<tr><td>Run duration</td><td>${e(formatDuration(model.durationMs))}</td></tr>` : '',
    `<tr><td>Classification</td><td><code>${e(model.classification ?? '')}</code></td></tr>`,
  ].filter(Boolean);

  const body =
    `<div class="table-wrap"><table><tbody>${rows.join('')}</tbody></table></div>` +
    '<p class="section-note" style="margin-top:1rem">This report was rendered from a validated JSON artifact. ' +
    'Every number above came from that file, and the file is beside this one in the same folder. ' +
    'The layout, colours, and components come from the renderer — not from whichever agent produced the ' +
    'data — so a report from any agent is the same document.</p>';

  return { id: 'appendix', title: 'Appendix', navLabel: 'Appendix', count: null, body };
}

/* ── Registry ─────────────────────────────────────────────────────────────── */

/**
 * Which sections each audience gets.
 *
 * Not a different report — the *same* report, filtered. An executive rendering that
 * reworded the findings would be a second document to keep in step, and the two would
 * diverge the first time someone edited one of them. Filtering cannot diverge.
 *
 * `full` is the default and the canonical artifact. The other two exist because a
 * fourteen-section report mailed to a CFO gets closed, and a two-section report handed
 * to the engineer fixing it is useless.
 */
export const MODES = Object.freeze({
  full: null, // every section
  executive: ['overview', 'summary', 'coverage', 'recommendations', 'appendix'],
  developer: [
    'overview', 'findings', 'failures', 'performance', 'api', 'security',
    'accessibility', 'console', 'screenshots', 'artifacts', 'appendix',
  ],
  // The embedded rendering keeps every section; only the document wrapper differs.
  artifact: null,
});

/** Filter sections to a mode. An unknown mode is a programming error, not a silent full render. */
export function filterSections(sections, mode = 'full') {
  if (!(mode in MODES)) {
    throw new Error(`unknown rendering mode '${mode}'; expected one of: ${Object.keys(MODES).join(', ')}`);
  }
  const allowed = MODES[mode];
  if (allowed === null) return sections;
  const order = new Map(allowed.map((id, index) => [id, index]));
  return sections
    .filter((section) => order.has(section.id))
    .sort((a, b) => order.get(a.id) - order.get(b.id));
}

/** Every section, in reading order, with the empty ones dropped. */
export function buildSections(model, context) {
  return [
    overviewSection(model),
    executiveSection(model),
    engineeringSection(model),
    coverageSection(model),
    findingsSection(model, context),
    failuresSection(model),
    performanceSection(model),
    apiSection(model),
    securitySection(model),
    accessibilitySection(model),
    consoleSection(model),
    screenshotSection(model),
    dataSection(model),
    timelineSection(model),
    recommendationsSection(model),
    artifactSection(model),
    appendixSection(model),
  ].filter((entry) => Boolean(entry.body));
}

/** Render a list of sections to HTML. */
export function renderSections(sections) {
  return sections.map((entry) => section(entry)).join('');
}

export { ADAPTER_PLAIN, DIMENSION_PLAIN, AUTH_METHOD_LABEL };
