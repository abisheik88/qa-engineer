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
      // Three facts a report needs that a summary of failures cannot supply: how big
      // the response was, when it started relative to the others, and whether the
      // server said anything about caching. All three are read straight from the HAR
      // — none is inferred — and all three are absent from many HARs, which is why
      // each has an explicit "unknown" rather than a plausible zero.
      bytes: bodyBytes(response),
      startedAt: typeof item.startedDateTime === 'string' ? item.startedDateTime : null,
      cacheControl: headerValue(response.headers, 'cache-control'),
      etag: headerValue(response.headers, 'etag'),
      resourceType: typeof item._resourceType === 'string' ? item._resourceType : null,
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

/**
 * Response body size in bytes, or null when the HAR does not say.
 *
 * `content.size` is the decoded size and `bodySize` the bytes on the wire; either is
 * `-1` when the producer did not record it. Null rather than 0, because "we do not
 * know how big this was" and "this response was empty" are different findings and a
 * report that conflates them invents a fact.
 */
function bodyBytes(response) {
  for (const candidate of [response?.content?.size, response?.bodySize]) {
    const number = Number(candidate);
    if (Number.isFinite(number) && number >= 0) return Math.trunc(number);
  }
  return null;
}

/** A header's value, case-insensitively, or null. */
function headerValue(headers, name) {
  if (!Array.isArray(headers)) return null;
  const wanted = name.toLowerCase();
  const found = headers.find((header) => String(header?.name ?? '').toLowerCase() === wanted);
  return found ? String(found.value ?? '') : null;
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
