# RFC: Add `/qa-explore` as the twelfth user-facing command

- **Status:** Accepted
- **Author:** qa-automation-pack
- **Tracking issue:** product-QA gap vs hyperbrain-style full-spectrum explore

## Problem

The pack's eleven commands cover test automation well — run, generate, debug, fix, audit a view from artifacts — but they do not cover **live product QA** against a URL: open a browser, execute attached test cases, exercise functional / API / performance / security / UI / UX dimensions, and ship an evidence-backed report with screenshots and severity per finding.

Teams today either improvise without a skill (hallucinated green, missing proof) or rely on org-locked agents (Claude-pane quirks, DeJoule hosting, no Agent Skills install path). Neither is vendor-neutral or multi-agent.

## Proposal

Add **`qa-explore`** as a twelfth user-facing skill:

- **Name:** `qa-explore`
- **Draft description:** Full-spectrum exploratory product QA against a live URL — functional, API replay, performance, client security, UI/UX — with optional attached test cases and an evidence-backed report. Use when QA-ing a page or feature URL in the browser, exploring a web app with attached test cases, or producing a severity-ranked bug report with screenshots.
- **Inputs:** URL (required; ask once if missing); optional attached test cases; optional known bugs; optional DB access for ground-truth checks.
- **Outputs:** `qa-artifacts/explore-<run-id>/` with screenshots, markdown + HTML report, and `explore-result.json` validating against `contracts/explore-result.schema.json`.
- **Non-overlap:** `/qa-audit` remains narrow page audits from artifacts; `/qa-run` executes automated suites. Explore owns the live browser session and consolidated product report.

## Overlap and budget analysis

| Existing | Why it does not cover this |
| --- | --- |
| `qa-audit` | Artifact/HAR-driven dimension checks; no URL session, no attached cases, no functional loops |
| `qa-run` | Executes project test code; does not explore an arbitrary URL as product QA |
| `qa-api` | Assesses API *tests*, not live in-page API replay during explore |
| Modes on audit | Would overload activation keywords and bury functional/explore procedure |

Description budget: pack total is 6000 chars; current usage leaves headroom for a focused explore description (~350–450 chars). Surface growth is justified by a distinct workflow users cannot reach through modes without destroying skill clarity.

## Alternatives

1. **Expand `qa-audit` with a full-spectrum mode** — rejected: mixes artifact audit with live product QA; competes for activation; report contracts diverge.
2. **Do nothing** — rejected: leaves the highest-value product-QA path outside the pack and dependent on non-portable agents.
3. **Model-only knowledge without a command** — rejected: users need a discoverable `/qa-explore` entry and a contract.

## Compatibility and security

- Contracts: new `explore-result` only; no existing schema fields renamed.
- Install: skill installs like every other user-facing skill via copy into `.agents/skills/` and `.claude/skills/`.
- Threat model unchanged: no credentials typed by the agent; artifact contents untrusted; redaction required; read-only IDOR probes only when in scope; no destructive security testing.

## Rollout

- Ships at `maturity: experimental`, version `0.1.0`.
- Architecture docs update the locked command surface from 11 to 12, citing this RFC.
- Rollback: deprecate via the authoring-guide deprecation path if activation collisions or budget pressure prove harmful.
