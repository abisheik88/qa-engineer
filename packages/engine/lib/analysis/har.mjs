// HAR (HTTP Archive) parser.
//
// Framework-agnostic: a HAR is a standard JSON format, whoever produced it.
// Extracts request outcomes, flags failures and slow calls, and redacts headers
// and credentialed URLs before anything is exposed. A malformed HAR raises.

import fs from 'node:fs';

import { redactText, redactHeaders } from './redaction.mjs';
import { MalformedArtifact } from './junit.mjs';

/**
 * Parse HAR JSON into a redacted network summary.
 *
 * `{entries, failures, slow, redacted: true}`, where each entry is
 * `{method, url, status, durationMs, requestHeaders, responseHeaders}`. Failures
 * are entries with status >= 400 or status 0 (no response at all).
 */
export function parseHarData(data, { slowMs = 1000, label = '<input>' } = {}) {
  const rawEntries = data?.log?.entries;
  if (!Array.isArray(rawEntries)) {
    throw new MalformedArtifact(`not a HAR document at ${label}`);
  }

  const entries = rawEntries.map((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new MalformedArtifact(`HAR log.entries contains a non-object at ${label}`);
    }
    const request = item.request ?? {};
    const response = item.response ?? {};
    return {
      method: request.method ?? '',
      // Redaction strips any credentials embedded in the URL.
      url: redactText(request.url ?? ''),
      status: toInt(response.status),
      durationMs: toMillis(item?.time, label),
      requestHeaders: redactHeaders(request.headers ?? []),
      responseHeaders: redactHeaders(response.headers ?? []),
    };
  });

  return {
    entries,
    failures: entries.filter((e) => e.status === 0 || e.status >= 400),
    slow: entries.filter((e) => e.durationMs >= slowMs),
    redacted: true,
  };
}

/** Read and parse a HAR file from disk. */
export function parseHar(path, { slowMs = 1000 } = {}) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (error) {
    throw new MalformedArtifact(`could not parse HAR at ${path}: ${error.message}`);
  }
  return parseHarData(data, { slowMs, label: path });
}

/** A status that is absent or unreadable is 0 — "no response", which is a failure. */
function toInt(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}

/**
 * HAR `time` is milliseconds already, rounded to a whole number.
 *
 * A value that is present but not a number raises rather than becoming 0: the
 * same rule as the JUnit parser, and for the same reason — a fabricated duration
 * makes a malformed document look like a clean measurement.
 */
function toMillis(raw, label) {
  if (raw === undefined || raw === null || raw === '') return 0;
  const number = Number(raw);
  if (!Number.isFinite(number)) {
    throw new MalformedArtifact(`entry time='${raw}' is not a number at ${label}`);
  }
  return roundHalfToEven(number);
}

/** Python's rounding rule, so a `.5` boundary lands on the same integer. */
function roundHalfToEven(value) {
  const floor = Math.floor(value);
  const remainder = value - floor;
  if (remainder > 0.5) return floor + 1;
  if (remainder < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}
