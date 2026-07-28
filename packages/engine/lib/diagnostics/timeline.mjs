// Deterministic timeline reconstruction.
//
// Reconstructs the ordered sequence of a run — start, browser launch, navigation,
// requests and responses, console errors, assertions, failure, cleanup — from the
// execution result and the analysis findings. It records only stages for which there
// is evidence; it never invents an event to fill the shape. Reusable by qa-debug and
// qa-report.

// Canonical phase order, used to sort events that share (or lack) a timestamp.
export const PHASE_ORDER = [
  'execution-start', 'browser-launch', 'navigation', 'request', 'response',
  'console-error', 'assertion', 'failure', 'cleanup', 'execution-finish',
];
const PHASE_INDEX = new Map(PHASE_ORDER.map((phase, index) => [phase, index]));

// Evidence type -> the timeline phase it contributes.
const EVIDENCE_PHASE = {
  network: 'response',
  console: 'console-error',
  trace: 'navigation',
  junit: 'assertion',
  report: 'assertion',
};

/**
 * Build an ordered timeline: `[{order, phase, detail, source, timestamp?}]`.
 *
 * Deterministic: same inputs, same timeline. Only evidenced stages appear.
 */
export function buildTimeline(executionResult, findings = null) {
  const events = [];
  const execution = (executionResult ?? {}).execution ?? {};

  const started = execution.startedAt;
  if (started || (executionResult !== null && executionResult !== undefined && truthy(executionResult))) {
    events.push(event('execution-start', 'Run started', 'execution-result', started ?? null));
  }

  // Contribute a stage per evidence entry we actually have.
  for (const finding of findings ?? []) {
    for (const item of finding.evidence ?? []) {
      const phase = EVIDENCE_PHASE[item.type];
      if (phase) {
        events.push(event(phase, item.description ?? '', item.source ?? 'analysis', null));
      }
    }
  }

  // A failure stage per failed test recorded in the result.
  for (const test of (executionResult ?? {}).executed ?? []) {
    if (test.status === 'failed') {
      events.push(event('failure', `Test failed: ${test.title ?? ''}`,
        test.file ?? 'execution-result', null));
    }
  }

  const finished = execution.finishedAt;
  if (finished) {
    events.push(event('cleanup', 'Run cleaned up', 'execution-result', null));
    events.push(event('execution-finish', 'Run finished', 'execution-result', finished));
  }

  // Deterministic order: by canonical phase first (it encodes the logical
  // sequence), then by timestamp within a phase, then by insertion order. Phase
  // order is primary because per-event wall-clock times are often unavailable.
  const decorated = events.map((entry, seq) => ({ entry, seq }));
  decorated.sort((a, b) => {
    const phaseDelta = (PHASE_INDEX.get(a.entry.phase) ?? 99) - (PHASE_INDEX.get(b.entry.phase) ?? 99);
    if (phaseDelta !== 0) return phaseDelta;
    const left = a.entry.timestamp || '';
    const right = b.entry.timestamp || '';
    if (left !== right) return left < right ? -1 : 1;
    return a.seq - b.seq;
  });

  // Key order matters: these events are serialized and compared byte-for-byte
  // against the Python implementation, which builds phase/detail/source/timestamp
  // and then appends `order`. Assigning `order` before `timestamp` would produce
  // the same data in a different JSON shape.
  return decorated.map(({ entry }, order) => {
    const result = { phase: entry.phase, detail: entry.detail, source: entry.source };
    if (entry.timestamp !== null && entry.timestamp !== undefined) result.timestamp = entry.timestamp;
    result.order = order;
    return result;
  });
}

function event(phase, detail, source, timestamp) {
  return { phase, detail, source, timestamp };
}

/**
 * Python's `if started or execution_result:` treats an empty dict as falsey, so a
 * bare `{}` produces no start event while `{"tests": {...}}` does. JavaScript
 * considers every object truthy, so the emptiness has to be asked about directly.
 */
function truthy(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(value);
}
