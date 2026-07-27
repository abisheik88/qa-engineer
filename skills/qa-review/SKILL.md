---
name: qa-review
description: >-
  Reviews a test codebase's quality and gives it a score. Judges
  structure, maintainability, duplication, naming, and test design
  against the pack's QA knowledge base, then recommends improvements and
  edits nothing. Use when reviewing automation health or tests before
  merge.
license: MIT
metadata:
  version: "0.1.0"
  maturity: beta
  audience: user
---

# QA Review

## Purpose

Review an automation codebase the way a senior QA engineer reviews a pull request: judge it against known good practice, score it, and recommend specific improvements — all grounded in the pack's [knowledge base](references/anti-patterns.md), not personal taste. This skill reads and judges; it changes nothing.

Do not use it to run tests (`/qa-run`), generate them (`/qa-generate`), or repair a specific failure (`/qa-fix`). It assesses the health of test code as it stands.

## Inputs

- The user's request, which follows in the conversation: the codebase, directory, or diff to review.
- The test code itself, read directly.
- `.qa/context.md` for the framework and conventions, so the review judges against the project's own stack.

## Context loading

| When | Load |
| --- | --- |
| Judging anti-patterns across the suite | [references/anti-patterns.md](references/anti-patterns.md) |
| Reviewing page-object structure | [references/page-objects.md](references/page-objects.md) |
| Reviewing assertion quality | [references/assertion-patterns.md](references/assertion-patterns.md) |
| Reviewing setup and shared state | [references/fixtures.md](references/fixtures.md) |
| Shaping the report | [references/evidence-and-reporting.md](references/evidence-and-reporting.md) |

## Procedure

1. **Survey.** Read the codebase and `.qa/context.md`; identify the framework and layout.
2. **Assess each dimension** against the knowledge base: architecture, maintainability, duplication, naming, page objects, fixtures, assertions, and test design. Cite the specific file and line for each judgement.
3. **Score.** Rate each dimension (strong/adequate/needs-work/poor) and derive an overall verdict and a 0–100 quality score from the ratings, weighting the anti-patterns that most damage a suite.
4. **Recommend.** For each weakness, recommend the specific improvement and name the domain that backs it. Rank by impact.
5. **Report.** Emit the review result and present the review. Propose no code changes — recommend, and point to `/qa-fix` or `/qa-generate` where a change would follow.

## Guardrails

- **No code changes.** This skill reviews; it never edits. Recommendations are advice.
- **Judge against knowledge, not taste.** Every finding cites a domain rule and the code that violates it; no unsupported opinion.
- **Respect the project's conventions.** Where the project's convention differs from a preference, note the trade-off; do not mark a consistent local convention as wrong.
- **Cite evidence.** Every dimension rating references the code that justifies it; never echo secrets.

## Output

A review result under `qa-artifacts/`, conforming to [contracts/review-result.schema.json](contracts/review-result.schema.json): the overall verdict and quality score, per-dimension ratings with notes and the backing domain, evidence, and ranked recommendations. Validate against the schema before completion, and present the review in prose alongside it.
