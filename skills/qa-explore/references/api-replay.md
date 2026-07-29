<!-- synced-from: shared/domains/api-replay.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# API Replay

Live API audit during a browser explore session: use the app's own network traffic as the source of truth, then replay exact URLs. Consumed by the explore skill. Complements the REST domain (which covers API *test* quality).

## Count with the parser, judge with your eyes

**Do not count requests, time them, or spot duplicates by reading a network panel.**
Capture a HAR and let the engine do it:

```bash
node <SKILL_DIR>/scripts/qa-tool.mjs analysis network <capture.har> \
  [--slow-ms 1000] [--large-bytes 524288]
```

What comes back is the report contract's `network` block, ready to drop into the result
and validate: `totalRequests`, `failedRequests`, `slowRequests`, `duplicateRequests`,
`totalBytes`, and one entry per endpoint carrying its method, URL, status, duration,
size, call count, start offset, and an `issue` flag.

The flags are assigned by stated rules, worst first:

| Flag | Rule |
| --- | --- |
| `failed` | status 0, 4xx, or 5xx |
| `slow` | duration at or over the threshold (1000 ms by default) |
| `polling` | three or more identical calls at an even cadence — a timer, not a burst |
| `duplicate` | the same method and URL called more than once |
| `n-plus-one` | four or more distinct ids on one path shape inside two seconds |
| `large-payload` | response at or over the size threshold (512 KB by default) |
| `uncached` | a 200 for a static asset with neither `Cache-Control` nor `ETag` |

URLs and headers are redacted on the way through, so a token in a query string never
reaches the report.

**What is still yours.** The parser says *what happened*; only you can say whether it
matters. A duplicated analytics beacon and a duplicated payment request are identical in
a HAR and wildly different findings. Read the flags, then write findings for the ones
that affect this product — and set each finding's `affectedApis` to the endpoints the
block already named, so the report links them.

If no HAR is available, fall back to `performance.getEntriesByType('resource')` and say
in the report that the counts were observed rather than parsed.

## Best practices

- **Best practice:** prefer `performance.getEntriesByType('resource')` (or an equivalent HAR) over agent network monitors that miss XHR/fetch.
- **Best practice:** replay the application's exact URLs and methods via in-page fetch (using the page's existing auth), not guessed GET probes against POST endpoints.
- **Best practice:** run `analysis network` on a HAR for the counts and flags; classify each flagged call as relevant or not, rather than counting by hand.
- **Recommendation:** capture UI values with an ISO timestamp when comparing to API or DB responses; match within a stated freshness window.
- **Best practice:** redact Authorization headers, cookies, tokens, and PII from every excerpt written to artifacts.

## Common failures

- Probing with the wrong HTTP method and concluding "endpoint missing".
- Attributing a filter bug to the UI when the filter never appears in any request query string.
- Treating a cold-path spike as a permanent slow endpoint without a warm replay.
- Printing response bodies that contain secrets or full user directories into the report.

## Detection signals

- Same endpoint called N times with identical payloads on one surface load.
- Zero-byte or 4xx/5xx responses on user-visible widgets.
- Heavy payloads far larger than what the UI renders (over-fetch / PII smell).
- Error bodies that leak stack traces, storage keys, or framework versions.
- Cold vs warm duration ratios that show cache works but first paint still hurts.

## Repair guidance

- Recommend fixing the client (stop duplicate calls, propagate filters) or the server (validation messages, payload shape) based on which side owns the defect.
- For authorization smells (another resource id returns 200 unexpectedly), report as a finding; do not escalate to exploitation.
- Never store raw auth tokens in artifacts; quote only redacted shapes.

## Framework notes

- Replay is performed in the live page context so cookies and storage stay where they live. Shell-side curl with extracted tokens is an **anti-pattern**.
- When only a HAR is available (no live page), analyze the HAR with the pack's redacting HAR analyzer and note that live replay was skipped.

## Anti-patterns

- **Anti-pattern:** extracting bearer tokens to the shell to "make debugging easier".
- **Anti-pattern:** destructive or mutating probes during an explore audit.
- **Anti-pattern:** declaring an API "slow" from a single unconditioned sample.

## Future extension

- GraphQL operation-name ranking; WebSocket frame sampling; contract diff against OpenAPI when the project provides a spec.
