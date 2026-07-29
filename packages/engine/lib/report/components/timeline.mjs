// The execution timeline: what the run did, in order, and how long each phase took.
//
// This answers a question every reader of an automated QA report eventually asks —
// "what did this thing actually do?" — and it answers a sharper one for whoever has
// to trust the result: a run that spent four seconds on "security" did not check
// security, and the timeline is where that becomes visible instead of inferable.

import { e, formatDuration, icon } from './primitives.mjs';

const PHASE_LABEL = Object.freeze({
  launch: 'Browser launched',
  authentication: 'Authentication',
  navigation: 'Navigation',
  functional: 'Functional testing',
  api: 'API analysis',
  performance: 'Performance measurement',
  security: 'Security checks',
  accessibility: 'Accessibility checks',
  ui: 'UI and layout',
  data: 'Data validation',
  analysis: 'Analysis',
  reporting: 'Report generation',
});

export function phaseLabel(phase) {
  return PHASE_LABEL[phase] ?? phase ?? '';
}

/** The timeline as an ordered list, with a rail and a state dot per phase. */
export function timelineList(entries) {
  if (!entries || entries.length === 0) return '';
  const total = entries.reduce((sum, entry) => sum + (Number(entry.durationMs) || 0), 0);

  const items = entries
    .map((entry) => {
      const status = entry.status ?? 'ok';
      const duration = Number(entry.durationMs);
      const share =
        total > 0 && Number.isFinite(duration)
          ? ` · ${Math.round((duration / total) * 100)}% of the run`
          : '';
      return (
        `<li class="tl-${e(status)}">` +
        '<div class="tl-head">' +
        `<span class="tl-label">${e(entry.label || phaseLabel(entry.phase))}</span>` +
        (Number.isFinite(duration)
          ? `<span class="tl-dur">${e(formatDuration(duration))}${e(share)}</span>`
          : '') +
        '</div>' +
        (entry.detail ? `<div class="tl-detail">${e(entry.detail)}</div>` : '') +
        '</li>'
      );
    })
    .join('');

  return (
    '<div class="card"><div class="card-body">' +
    `<ol class="timeline">${items}</ol>` +
    (total > 0
      ? `<p class="muted" style="margin-top:1rem;font-size:.8125rem">${icon('file', 14)} ` +
        `Total measured time ${e(formatDuration(total))}.</p>`
      : '') +
    '</div></div>'
  );
}
