// The Markdown rendering.
//
// Markdown is the format a finding gets pasted into a Jira ticket, a pull request, or
// a Slack thread from, so it is written for *excerpting* rather than for reading end to
// end: each finding is a self-contained block with its own heading, and no finding
// depends on a table three sections above it to make sense.
//
// It is rendered from the same model as the HTML, which is the only reason the two can
// be trusted to agree. Producing the prose separately is exactly how the first live run
// ended up with a Markdown report that said things the JSON did not.

import { footerMarkdown } from '../../analysis/branding.mjs';
import { buildModel } from '../core/model.mjs';
import { SEVERITY, SEVERITY_ORDER } from '../theme/tokens.mjs';
import { dimensionLabel, STATUS_LABEL } from '../components/findings.mjs';
import { formatDuration, formatBytes } from '../components/primitives.mjs';

/** Escape the characters that would restructure a table cell or a heading. */
function cell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function table(headers, rows) {
  if (rows.length === 0) return '';
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
    '',
  ].join('\n');
}

function findingBlock(finding, model) {
  const severity = SEVERITY[finding.severity]?.label ?? finding.severity;
  const lines = [
    `### ${finding.id} · ${severity} — ${finding.title}`,
    '',
    `**Area** ${dimensionLabel(finding.dimension)} · ` +
      `**Status** ${STATUS_LABEL[finding.status] ?? finding.status}` +
      (finding.page ? ` · **Page** ${finding.page}` : ''),
    '',
    `**Current behaviour** — ${finding.actual}`,
    '',
    `**Expected behaviour** — ${finding.expected}`,
    '',
  ];

  if (finding.businessImpact) lines.push(`**Business impact** — ${finding.businessImpact}`, '');

  lines.push('**Reproduction**', '');
  if (Array.isArray(finding.steps) && finding.steps.length > 0) {
    finding.steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
  } else {
    lines.push(finding.repro);
  }
  lines.push('');

  if (finding.rootCause?.summary) {
    lines.push(`**Root cause** — ${finding.rootCause.summary}`, '');
    for (const step of finding.rootCause.chain ?? []) lines.push(`- ${step}`);
    if (finding.rootCause.chain?.length) lines.push('');
  }

  lines.push(`**Suggested fix** — ${finding.fixDirection}`, '');

  if (finding.regressionRisk?.level) {
    lines.push(
      `**Regression risk** — ${finding.regressionRisk.level}` +
        (finding.regressionRisk.note ? `: ${finding.regressionRisk.note}` : ''),
      '',
    );
    for (const item of finding.regressionRisk.retest ?? []) lines.push(`- Re-test: ${item}`);
    if (finding.regressionRisk.retest?.length) lines.push('');
  }

  if (finding.developerNotes) lines.push(`**Developer notes** — ${finding.developerNotes}`, '');

  if (finding.metrics?.length) {
    lines.push(
      table(
        ['Measurement', 'Observed', 'Budget'],
        finding.metrics.map((metric) => [metric.label, metric.value, metric.budget ?? '—']),
      ),
    );
  }

  // Evidence goes through the registry so a missing file is *stated* in Markdown too,
  // rather than becoming a dead image reference in a ticket.
  const evidence = (finding.evidence ?? [])
    .map((entry) => ({ entry, record: model.registry.forEvidence(entry) }))
    .filter((pair) => pair.record);
  if (evidence.length > 0) {
    lines.push('**Evidence**', '');
    for (const { entry, record } of evidence) {
      if (!record.exists) {
        lines.push(`- *Artifact missing* — \`${record.declaredPath}\` (${record.missingReason})`);
        continue;
      }
      if (record.renderAs === 'image') {
        lines.push(`![${record.label ?? entry.type}](${record.href})`, '');
      } else {
        lines.push(`- [${record.label ?? entry.type}](${record.href})`);
      }
      if (entry.excerpt) lines.push('', '```', entry.excerpt, '```', '');
    }
    lines.push('');
  }

  return lines.join('\n');
}

/** Render the whole report as Markdown. */
export function renderMarkdown(result, options = {}) {
  const model = buildModel(result, options);
  const out = [];

  out.push(`# ${model.subject} — QA Report`, '');
  out.push(
    table(
      ['Field', 'Value'],
      [
        ['URL', model.url ?? '—'],
        ['Generated', model.generatedAt ?? '—'],
        model.environment ? ['Environment', model.environment] : null,
        ['Verdict', `**${model.verdict.label}** — ${model.verdict.blurb}`],
        ['Findings', String(model.totalFindings)],
        model.durationMs !== null ? ['Duration', formatDuration(model.durationMs)] : null,
        model.reportVersion ? ['Report version', `v${model.reportVersion}`] : null,
        ['Tester', 'AI-assisted QA (qa-explore)'],
      ].filter(Boolean),
    ),
  );

  out.push('## Summary', '', model.summary, '');

  if (model.verdict.risks.length > 0) {
    out.push('### Why', '');
    for (const risk of model.verdict.risks) out.push(`- ${risk}`);
    out.push('');
  }
  if (model.verdict.recommendedAction) {
    out.push(`**Recommended action** — ${model.verdict.recommendedAction}`, '');
  }
  if (model.verdict.estimatedFixHours) {
    const { low, high } = model.verdict.estimatedFixHours;
    out.push(`**Estimated fix time** — ${low === high ? low : `${low}–${high}`} hours`, '');
  }

  out.push(
    '## Findings by severity',
    '',
    table(
      SEVERITY_ORDER.map((key) => SEVERITY[key].label),
      [SEVERITY_ORDER.map((key) => String(model.severityCounts[key] ?? 0))],
    ),
  );

  if (model.scope?.objective) out.push('## Scope', '', model.scope.objective, '');
  if (model.scope?.covered?.length) {
    out.push('**Exercised**', '');
    for (const item of model.scope.covered) out.push(`- ${item}`);
    out.push('');
  }
  if (model.notCovered.length > 0) {
    out.push('**Not covered in this run**', '');
    for (const item of model.notCovered) out.push(`- ${item}`);
    out.push('');
  }

  if (model.pages.length > 0) {
    out.push(
      '## Pages',
      '',
      table(
        ['Page', 'State', 'HTTP', 'Load', 'Requests'],
        model.pages.map((page) => [
          page.title || page.url,
          page.status,
          page.httpStatus ?? '—',
          page.loadMs !== undefined ? formatDuration(page.loadMs) : '—',
          page.requests ?? '—',
        ]),
      ),
    );
  }

  out.push('## Findings', '');
  if (model.findings.length === 0) {
    out.push('_No findings recorded._', '');
  } else {
    const sorted = [...model.findings].sort(
      (a, b) =>
        (SEVERITY[a.severity] ?? SEVERITY.low).rank - (SEVERITY[b.severity] ?? SEVERITY.low).rank ||
        String(a.id).localeCompare(String(b.id), 'en', { numeric: true }),
    );
    for (const finding of sorted) out.push(findingBlock(finding, model), '');
  }

  if (model.performance) {
    const rows = Object.entries(model.performance)
      .filter(([, value]) => value !== null && value !== undefined && typeof value !== 'string')
      .map(([key, value]) => [key, key.endsWith('Bytes') ? formatBytes(value) : String(value)]);
    if (rows.length > 0) out.push('## Performance', '', table(['Metric', 'Value'], rows));
  }

  if (model.network?.endpoints?.length) {
    out.push(
      '## API and network',
      '',
      table(
        ['Method', 'Endpoint', 'Status', 'Time', 'Size', 'Count', 'Issue'],
        model.network.endpoints.slice(0, 40).map((endpoint) => [
          endpoint.method,
          endpoint.url,
          endpoint.status ?? '—',
          Number.isFinite(endpoint.durationMs) ? formatDuration(endpoint.durationMs) : '—',
          Number.isFinite(endpoint.bytes) ? formatBytes(endpoint.bytes) : '—',
          endpoint.count ?? 1,
          endpoint.issue ?? '',
        ]),
      ),
    );
  }

  if (model.security?.checks?.length) {
    out.push(
      '## Security',
      '',
      table(
        ['Check', 'Result', 'Detail'],
        model.security.checks.map((check) => [check.check, check.status, check.detail ?? '']),
      ),
    );
  }

  if (model.accessibility?.violations?.length) {
    out.push(
      '## Accessibility',
      '',
      table(
        ['Rule', 'Impact', 'Instances', 'Description'],
        model.accessibility.violations.map((violation) => [
          violation.rule, violation.impact, violation.count, violation.description ?? '',
        ]),
      ),
    );
  }

  if (model.testCases?.cases?.length) {
    out.push(
      '## Test case coverage',
      '',
      table(
        ['ID', 'Case', 'Result', 'Finding'],
        model.testCases.cases.map((testCase) => [
          testCase.id, testCase.title, testCase.status, testCase.findingId ?? '—',
        ]),
      ),
    );
  }

  if (model.dbValidation?.comparisons?.length) {
    out.push(
      '## Data validation',
      '',
      table(
        ['Metric', 'UI', 'Source of truth', 'Result'],
        model.dbValidation.comparisons.map((comparison) => [
          comparison.metric, comparison.uiValue, comparison.sourceValue,
          comparison.match ? 'Match' : 'Mismatch',
        ]),
      ),
    );
  }

  if (model.whatWorksWell.length > 0) {
    out.push('## What works well', '');
    for (const item of model.whatWorksWell) out.push(`- ${item}`);
    out.push('');
  }

  if (model.fixOrder.length > 0) {
    out.push('## Suggested fix order', '');
    model.fixOrder.forEach((item, index) => out.push(`${index + 1}. ${item}`));
    out.push('');
  }

  if (model.recommendations.length > 0) {
    out.push(
      '## Recommendations',
      '',
      table(
        ['Action', 'Priority', 'Owner', 'Effort'],
        model.recommendations.map((recommendation) => [
          recommendation.action,
          recommendation.priority,
          recommendation.owner ?? '—',
          recommendation.effort ?? '—',
        ]),
      ),
    );
  }

  const stats = model.artifactStats;
  if (stats.total > 0) {
    out.push(
      '## Artifacts',
      '',
      `${stats.present} of ${stats.total} present (${formatBytes(stats.bytes)}).` +
        (stats.missing > 0 ? ` **${stats.missing} missing.**` : ''),
      '',
      table(
        ['Kind', 'File', 'State'],
        model.registry
          .list()
          .filter((record) => record.declaredPath)
          .map((record) => [record.kind, record.declaredPath, record.exists ? 'Present' : 'Missing']),
      ),
    );
  }

  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n\n${footerMarkdown()}`;
}
