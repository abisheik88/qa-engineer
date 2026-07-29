// Turning a HAR into the report's `network` block.
//
// ## Why this exists
//
// `qa-explore` claimed an API dimension and backed it with forty-eight lines of prose
// telling the model what to look for. The model then counted requests by eye, decided
// which were slow, and judged which were duplicates — three things a model is bad at
// and a parser is perfect at. The pack's founding rule is that deterministic code owns
// facts and the model owns explanation; for this dimension the model owned both.
//
// So the counting moves here. What comes out is the `network` block of the report
// contract, ready to validate: totals, per-endpoint timings and sizes, and a flag on
// each endpoint saying what is wrong with it. The model's job becomes what it is
// actually good at — deciding whether a duplicate request *matters* to this product,
// and writing the finding.
//
// ## Facts, and inferences that are labelled as such
//
// Two different kinds of claim come out of a HAR, and conflating them is how a report
// starts asserting things it cannot support:
//
//   fact       count, status, duration, byte size, start offset, header presence.
//              Read directly. If the HAR does not record it, the answer is null, never
//              a plausible zero.
//   inference  duplicate, polling, n+1, uncached. Derived by a stated rule, over a
//              stated threshold, and every one is reported with the evidence that
//              triggered it so a reader can disagree.
//
// Nothing here decides severity. A duplicated analytics beacon and a duplicated payment
// request are the same shape in a HAR and wildly different findings, and only something
// that understands the product can tell them apart.

import { parseHar, parseHarData } from './har.mjs';

/** Defaults, all overridable, all reported back in the output so a reader sees them. */
export const DEFAULTS = Object.freeze({
  slowMs: 1000,
  // 512 KB. Below this a payload is rarely the thing worth reporting; above it, on a
  // mobile connection, it is.
  largeBytes: 512 * 1024,
  // Three or more identical requests at a regular cadence reads as polling rather than
  // as a burst of duplicates. Two is a double-submit; ten evenly spaced is a timer.
  pollingMinimum: 3,
  // Requests to the same path shape within this window look like one screen's worth of
  // work, which is what makes an N+1 visible rather than just "a busy session".
  nPlusOneWindowMs: 2000,
  nPlusOneMinimum: 4,
});

/** The path portion of a URL, without query or fragment. */
function pathOf(url) {
  const text = String(url ?? '');
  const withoutScheme = text.includes('://') ? text.slice(text.indexOf('://') + 3) : text;
  const slash = withoutScheme.indexOf('/');
  const rest = slash === -1 ? '/' : withoutScheme.slice(slash);
  return rest.split('?')[0].split('#')[0] || '/';
}

/**
 * A path with its identifier segments replaced, so `/users/41` and `/users/42` collapse.
 *
 * This is what makes an N+1 detectable. The rule is deliberately narrow — numeric
 * segments, UUIDs, and long hex strings — because a looser one collapses genuinely
 * different endpoints and reports an N+1 that is not there.
 */
export function templatePath(url) {
  return pathOf(url)
    .split('/')
    .map((segment) => {
      if (/^\d+$/.test(segment)) return ':id';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return ':uuid';
      if (/^[0-9a-f]{16,}$/i.test(segment)) return ':hash';
      return segment;
    })
    .join('/');
}

/** Milliseconds from the first request, or null when the HAR has no timestamps. */
function startOffsets(entries) {
  const times = entries.map((entry) => {
    const parsed = entry.startedAt ? Date.parse(entry.startedAt) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
  });
  const known = times.filter((value) => value !== null);
  if (known.length === 0) return times.map(() => null);
  const origin = Math.min(...known);
  return times.map((value) => (value === null ? null : value - origin));
}

/**
 * Is this response cacheable and uncached?
 *
 * Only asked of static assets, and only when the server said nothing at all. A 200 for
 * a script with neither `Cache-Control` nor `ETag` is a real finding; the same absence
 * on a JSON API response usually is not, because that response is often meant to be
 * fresh every time. Guessing on the second produces noise that trains a reader to
 * ignore the whole section.
 */
function looksUncached(entry) {
  if (entry.status !== 200) return false;
  if (entry.cacheControl || entry.etag) return false;
  const path = pathOf(entry.url).toLowerCase();
  return /\.(js|mjs|css|png|jpe?g|gif|webp|avif|svg|woff2?|ttf|eot|ico)$/.test(path);
}

/** Evenly spaced repeats read as a timer rather than as a burst. */
function looksLikePolling(offsets, minimum) {
  const known = offsets.filter((value) => value !== null).sort((a, b) => a - b);
  if (known.length < minimum) return false;
  const gaps = known.slice(1).map((value, index) => value - known[index]);
  if (gaps.length < 2) return false;
  const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  if (mean < 250) return false; // a burst, not a poll
  // Within 35% of the mean gap, every time: a scheduler, not a user.
  return gaps.every((gap) => Math.abs(gap - mean) <= mean * 0.35);
}

/**
 * Build the contract's `network` block from parsed HAR entries.
 *
 * Exported separately from the file-reading path so a caller that already has entries —
 * a browser adapter capturing them live, say — can use the same analysis without
 * writing a HAR to disk first.
 */
export function analyzeEntries(entries, options = {}) {
  const config = { ...DEFAULTS, ...options };
  const offsets = startOffsets(entries);
  const enriched = entries.map((entry, index) => ({ ...entry, startedMs: offsets[index] }));

  // Group by what actually identifies a call: the method and the full URL. Two GETs of
  // the same path with different query strings are different requests, and collapsing
  // them would report a duplicate that is not one.
  const groups = new Map();
  for (const entry of enriched) {
    const key = `${entry.method} ${entry.url}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  // N+1: many calls to one path *shape* inside a short window.
  const byTemplate = new Map();
  for (const entry of enriched) {
    const key = `${entry.method} ${templatePath(entry.url)}`;
    if (!byTemplate.has(key)) byTemplate.set(key, []);
    byTemplate.get(key).push(entry);
  }
  const nPlusOne = new Set();
  for (const [key, group] of byTemplate) {
    if (group.length < config.nPlusOneMinimum) continue;
    // Distinct URLs, or it is a duplicate rather than an N+1.
    if (new Set(group.map((entry) => entry.url)).size < config.nPlusOneMinimum) continue;
    const known = group.map((entry) => entry.startedMs).filter((value) => value !== null);
    if (known.length > 1 && Math.max(...known) - Math.min(...known) > config.nPlusOneWindowMs) continue;
    nPlusOne.add(key);
  }

  const endpoints = [];
  for (const [, group] of groups) {
    const first = group[0];
    const durations = group.map((entry) => entry.durationMs).filter((value) => Number.isFinite(value));
    const sizes = group.map((entry) => entry.bytes).filter((value) => value !== null);
    const worstStatus = group.reduce(
      (worst, entry) => (statusRank(entry.status) > statusRank(worst) ? entry.status : worst),
      first.status,
    );
    const slowest = durations.length > 0 ? Math.max(...durations) : 0;
    const bytes = sizes.length > 0 ? Math.max(...sizes) : null;
    const templateKey = `${first.method} ${templatePath(first.url)}`;

    // One flag per endpoint, worst first: a failing request that is also slow is
    // reported as failing, because that is what the reader must act on.
    let issue;
    if (worstStatus === 0 || worstStatus >= 400) issue = 'failed';
    else if (slowest >= config.slowMs) issue = 'slow';
    else if (looksLikePolling(group.map((entry) => entry.startedMs), config.pollingMinimum)) issue = 'polling';
    else if (group.length > 1) issue = 'duplicate';
    else if (nPlusOne.has(templateKey)) issue = 'n-plus-one';
    else if (bytes !== null && bytes >= config.largeBytes) issue = 'large-payload';
    else if (looksUncached(first)) issue = 'uncached';

    endpoints.push({
      method: first.method,
      url: first.url,
      ...(Number.isFinite(worstStatus) ? { status: worstStatus } : {}),
      durationMs: slowest,
      ...(bytes !== null ? { bytes } : {}),
      count: group.length,
      ...(first.startedMs !== null ? { startedMs: first.startedMs } : {}),
      ...(issue ? { issue } : {}),
    });
  }

  // Worst first, then slowest: the order a reader wants without sorting anything.
  endpoints.sort(
    (a, b) => issueRank(a.issue) - issueRank(b.issue) || (b.durationMs ?? 0) - (a.durationMs ?? 0),
  );

  const totalBytes = enriched.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0);
  const anySizes = enriched.some((entry) => entry.bytes !== null);

  return {
    totalRequests: enriched.length,
    failedRequests: enriched.filter((entry) => entry.status === 0 || entry.status >= 400).length,
    slowRequests: enriched.filter((entry) => entry.durationMs >= config.slowMs).length,
    // Requests beyond the first for each identical call — the count of *wasted* calls,
    // not the count of endpoints that were repeated.
    duplicateRequests: [...groups.values()].reduce((sum, group) => sum + (group.length - 1), 0),
    ...(anySizes ? { totalBytes } : {}),
    slowThresholdMs: config.slowMs,
    endpoints,
  };
}

function statusRank(status) {
  if (status === 0) return 3;
  if (status >= 500) return 2;
  if (status >= 400) return 1;
  return 0;
}

const ISSUE_ORDER = ['failed', 'slow', 'n-plus-one', 'duplicate', 'polling', 'large-payload', 'uncached'];
function issueRank(issue) {
  const index = ISSUE_ORDER.indexOf(issue);
  return index === -1 ? ISSUE_ORDER.length : index;
}

/** Analyze a HAR file on disk. Returns the contract's `network` block. */
export function analyzeHar(path, options = {}) {
  const parsed = parseHar(path, { slowMs: options.slowMs ?? DEFAULTS.slowMs });
  return analyzeEntries(parsed.entries, options);
}

/** Analyze already-parsed HAR JSON, for a caller holding the document in memory. */
export function analyzeHarData(data, options = {}) {
  const parsed = parseHarData(data, { slowMs: options.slowMs ?? DEFAULTS.slowMs });
  return analyzeEntries(parsed.entries, options);
}
