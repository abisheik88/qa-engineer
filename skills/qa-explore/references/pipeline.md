# Explore pipeline

Phase choreography for a full-spectrum `/qa-explore` run. Load this at the start of every run.

## Phase order

```text
0 Intake → 1 Session → 2 Functional → 3 API → 4 Performance
→ 5 Security → 6 UI/UX → 7 Optional DB → 8 Report → (iterate)
```

Run phases in order. Skip Phase 7 unless the user provided data-store access. Do not skip Functional when attached cases exist.

## Phase 0 — Intake

- Require a URL; ask once if missing.
- Parse attachments into a checklist (see test-case-intake).
- Record known-bug hypotheses separately from discovery findings.
- Allocate `run-id` (short opaque id) and create `qa-artifacts/explore-<run-id>/`.

## Phase 1 — Session

- Pick a browser adapter; navigate; screenshot the first paint.
- On login wall: stop, ask user to authenticate, wait for confirmation, re-check title/URL.
- Baseline: console errors + `performance.getEntriesByType('resource')` summary counts.

## Phase 2 — Functional

Per surface or per attached case:

1. Snapshot / read page structure.
2. Interact (prefer role/label refs over coordinates).
3. DOM-verify the expected state.
4. On mismatch or bug: capture evidence, assign a draft finding.
5. Continue; do not abandon the whole run for one failure.

Attached cases take priority over free exploration. After cases, cover navigation, empty/loading/error states, primary filters, and critical CTAs.

## Phase 3 — API audit

- Dump resource entries for same-origin API-like URLs.
- Replay exact URLs/methods in-page.
- Classify: duplicate, failing, missing-params, irrelevant, over-fetch, cold-vs-warm.
- File findings with network evidence excerpts (redacted).

## Phase 4 — Performance

- Payload ranking (decoded body size), long tasks if available, cold vs warm of the heaviest endpoint.
- Report conditions (viewport, cache state). Gate narrative on regression when a baseline exists; otherwise report absolute numbers as informational.

## Phase 5 — Security (client)

- Token in `localStorage` / readable storage; secrets in bundles or console; PII in query strings; leaked error internals; missing security headers when observable; `target=_blank` without `rel="noopener"`; optional single read-only IDOR probe.
- Flag deeper server review as a recommendation, not a guessed finding.

## Phase 6 — UI / UX

- Consistency (spacing, casing, alignment), missing feedback, dead affordances, mobile (e.g. 375px) breakage.
- Optional persona: if the user named a role, score 4–5 jobs-to-be-done.

## Phase 7 — Optional DB

- Capture UI values + `Date.toISOString()`.
- Query with the access path the user provided (never invent credentials).
- Match within a stated freshness window; label data vs presentation bugs.

## Phase 8 — Report

- Stable IDs, severity counts, evidence index, findings, perf table, security summary, optional DB table, what-works-well, fix order.
- Emit MD + HTML + JSON; validate JSON.

## Stuck-rule

After three failed attempts on the same navigation or control, record a blocker finding (or session note) and move on or stop the run if progress is impossible.
