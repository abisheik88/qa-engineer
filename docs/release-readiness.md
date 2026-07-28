# Release Readiness Report

Status of QA Engineer Pack `0.9.0` against a public-preview release. This
report is derived from the [capability matrix](capability-matrix.md) and the CI
gates; it does not restate capability claims, it assesses readiness.

**Bottom line: not yet releasable as 1.0, and honestly labelled as such.** The
engine is real and deterministically verified, but the release gate (Milestone
10 behavioral benchmarking) has not run, the documentation site and npm release
flow are unbuilt, and only Playwright is a live framework. A `0.9.x`
**public preview** is a reasonable next step once the blockers below are
accepted as known.

## Release checklist

What must be true to tag a release. Items are checked against the current tree.

| # | Gate | State |
| --- | --- | --- |
| 1 | All CI jobs green (lint, editorconfig, links, skills, analysis, installer, structure) | ✅ passing locally; installer + matrix jobs newly added |
| 2 | `npm test` runs and passes | ✅ installer smoke test (6 cases) |
| 3 | 47 Python tests pass | ✅ `python3 shared/analysis/lib/run_tests.py` |
| 4 | Capability matrix consistent with framework matrix and skills on disk | ✅ `npm run validate:matrix` |
| 5 | No broken package.json scripts | ✅ `docs:build` removed; `test` fixed |
| 6 | Every capability claim traceable to a test/contract | ✅ via the capability matrix evidence index |
| 7 | A runnable example that actually runs | ✅ `examples/getting-started` (2 tests pass live) |
| 8 | Deterministic behavioral gate in CI (golden + adversarial cases) | ✅ `tests/evals/run_evals.py` (`npm run validate:evals`) |
| 9 | Live-agent eval runner + regression gate | ✅ `tests/evals/run_live.py` (replay + command providers, committed baseline, drift detection); `npm run eval:live` gates CI |
| 10 | Published cross-model accuracy against real hosted agents | ⚠ operational — the runner and `command` provider are ready; executing against paid agents needs API access (maintainer/scheduled step) |
| 11 | Documentation site published | ❌ Milestone 9 remaining |
| 12 | Versioned npm release + provenance | ❌ Milestone 9 remaining |

Items 1–9 are met. Item 10 is operational (mechanism built; needs API access to run against real agents). Items 11–12 are the distribution blockers (see below).

## Production checklist

"Production" in this repo means *implemented and deterministically verified*, not
*behaviorally benchmarked*. What currently clears that bar:

- ✅ **Playwright** execution, generation, and analysis — real runtime + tests.
- ✅ **Diagnostic engine** (`qa-debug`, `qa-fix`, `qa-report`) — `qa_diagnostics` tests + contracts + self-containment check.
- ✅ **Analysis core** (`qa_analysis`) — redaction, taxonomy, parsers, diff guard, contract validator, all unit-tested.
- ✅ **QA knowledge base** — 19 domains, structure lint-enforced.

Everything else is **Beta** or **Experimental** by design — see the
[capability matrix](capability-matrix.md). No capability is claimed at 1.0
maturity, because 1.0 is gated on Milestone 10.

## Known limitations

- **Only Playwright runs live.** Selenium, Cypress, and WebdriverIO are
  adapter-complete (Beta): they detect and normalize results, but `qa-run` and
  `qa-generate` gate live execution and generation to Playwright. Non-Playwright
  generated code is convention-driven and unverified.
- **Trace forensics are Playwright-only.** Other frameworks normalize through
  JUnit plus their own screenshots/videos/logs; deep trace analysis is not
  available for them.
- **The installer ships `install` / `verify` / `doctor` only.** There is no
  `update` or `uninstall` command yet; re-running `install --force` regenerates,
  and uninstall is manual (remove lockfile-listed paths).
- **No documentation site** and **no published npm package** yet (Milestone 9).
- **Behavioral proof is deterministic + replayed, not yet live against paid
  agents.** Both the deterministic gate
  ([`run_evals.py`](../tests/evals/run_evals.py)) and the live-agent runner
  ([`run_live.py`](../tests/evals/run_live.py), replay provider + regression gate)
  are in CI. The runner also has a `command` provider that drives any real agent
  CLI — but running it against **paid hosted agents** (for a published accuracy
  number and cross-model drift) needs API access and is a maintainer/scheduled
  step, not something CI does on every PR.
- **Agent support tiers are aspirational.** No agent has passed a *live* CI
  evaluation (the live-agent runner is not built yet), so every tier in
  [COMPATIBILITY.md](../COMPATIBILITY.md) is a target, not a verified result.

## Experimental features

- **`qa-explore`** — live-URL, multi-dimension product QA. Newest command
  ([RFC-0001](rfcs/RFC-0001-qa-explore.md)), broadest scope, least track record;
  its optional database validation is the least-proven part. Declared
  `maturity: experimental` in its own frontmatter.
- **Non-Playwright generation** (Selenium/Cypress/WebdriverIO via `qa-generate`)
  — convention-driven, no curated templates, no tests; treat output as unverified.

## Breaking changes

None. No versioned release has been tagged, so there is nothing to break yet.
Once released, the contract rules apply: removing or renaming a field in any
`qa-artifacts/` output contract is a breaking change requiring a major-version
bump and a migration note ([ADR-0003](architecture/ADR-0003-versioning-strategy.md)).

## Migration notes

None required — there is no prior released version to migrate from. The first
release will establish the baseline that later migration notes reference.

## Support policy

- **Pre-release (`0.x`).** No stability or support guarantees. Skills, contracts,
  and the CLI surface may change without a deprecation cycle until `1.0`.
- **Contracts** are the most stable surface even pre-1.0: additive changes only
  within a contract major version; removals wait for a major bump.
- **Bug reports** are triaged ahead of features, especially compatibility reports
  (agent fails to discover/activate a skill) — see [COMPATIBILITY.md](../COMPATIBILITY.md).
- **Security** issues follow [SECURITY.md](../SECURITY.md) (private disclosure).

## Remaining blockers before public preview

Ordered by how much they gate a credible preview:

1. **Published accuracy against real hosted agents has not been produced.** Both
   eval layers now run in CI — the deterministic gate and the live-agent runner
   (replay + regression). The `command` provider drives any real agent CLI, so the
   mechanism for an empirical accuracy number and cross-model drift exists; what
   remains is *executing* it against paid agents (API access) and publishing the
   results. *Blocks a published-benchmark claim, not a preview.*
2. **Documentation site + versioned npm release (M9 remaining).** Users can
   install from a checkout today, but there is no published package or hosted
   docs. *Blocks distribution.*
3. **Framework parity expectations.** The pack must keep messaging that only
   Playwright is live; the capability matrix and this report now do so. *Managed,
   not blocking, as long as the honest labelling holds.*
4. **Installer lifecycle gaps** (`update` / `uninstall`). *Minor; workaround
   documented.*

None of these are correctness bugs in what ships; they are gaps between scope and
what a 1.0 would require. A `0.9.x` public preview that states them plainly is
defensible; a 1.0 is not, until at least blockers 1 and 2 are closed.
