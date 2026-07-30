# Capability Matrix

This is the **single canonical source** for what QA Engineer Pack can do and how
far each capability is proven. Every other document — the [README](../README.md),
[ROADMAP](../ROADMAP.md), [COMPATIBILITY](../COMPATIBILITY.md), the
[framework matrix](compatibility/framework-matrix.md), and each skill's own
documentation — derives its capability claims from this table and must not
maintain a competing one. When a capability changes, this file and the tests that
prove it change in the same pull request.

> **Scope of this document.** This matrix covers *what the pack does* (commands
> and frameworks). *Which AI agents load the skills* is a separate axis — see
> [COMPATIBILITY.md](../COMPATIBILITY.md) for agent support tiers.

## How to read the support levels

Every listed command and adapter is **implemented** — it exists in `skills/` or
`shared/`, passes the structural validators, and ships a committed output
contract where the workflow produces one. "Implemented" is table stakes. The
**support level** below says how deeply that implementation is *proven*, not
whether it exists:

| Level | Meaning | Bar to claim it |
| --- | --- | --- |
| **Production** | Works end to end today and is verified by automated tests and/or a real runtime. | Passing deterministic tests **and** (a real execution path **or** a schema-validated contract exercised in CI). |
| **Beta** | Implemented with a committed contract and worked examples, but proof is structural/contract-level rather than behavioral; or a documented capability gate applies. | Contract committed, examples present, validators green. |
| **Experimental** | Present and usable, but newest and broadest in scope with the least track record. Expect rough edges. | Contract + examples present; flagged for extra caution. |
| **Planning** | A documented approach only. No implementation. | An ADR, RFC, or adapter note describing the intended design. |

> **One honest caveat that applies to every "Production" row.** "Production" here
> means *implemented and deterministically verified* — it does **not** mean
> behaviorally benchmarked. Measured accuracy across real broken-app scenarios is
> the job of **Milestone 10** (the release gate), which has **not** run yet. The
> whole pack is `0.9.0` and **pre-release**. Read "Production" as "the strongest
> deterministic proof we can offer before M10," not "1.0-blessed."

## Command capability matrix

The twelve user-facing commands and the platforms beneath them. Evidence links
point at the test or contract that backs the level.

| Capability | Command | What it does today | Level | Evidence |
| --- | --- | --- | --- | --- |
| Intent routing | `qa` | Classifies a request and dispatches to the right skill. | Beta | Skill validated by `validate-skills`; no runtime contract (it is a dispatcher). |
| Project understanding | `qa-init` | Detects framework/CI/conventions; writes `.qa/context.md` and validates it with the bundled parser before reporting completion. | Beta | [`context.schema.json`](../packages/engine/lib/analysis/schemas/context.schema.json) + `the engine's context parser`, exercised against the real template and a generated file in CI. |
| Test execution | `qa-run` | **Executes Playwright** suites and BDD scenarios; **plans only** for other frameworks. Counts come from the bundled normalizer, never from reading the reporter by hand. Failure evidence (screenshot, video, trace) is a floor on every command, and a red run hands itself to `/qa-debug` automatically ([ADR-0018](architecture/ADR-0018-failure-handoff.md)). | **Production** (Playwright) · Planning (others) | [`execution-result.schema.json`](../skills/qa-run/contracts/execution-result.schema.json) with its runtime invariants + Playwright analyzers + Python tests. |
| Test generation | `qa-generate` | **Bootstraps/extends Playwright** non-destructively; detect-only for others. | **Production** (Playwright) · Planning (others) | [`generation-result.schema.json`](../skills/qa-generate/contracts/generation-result.schema.json) + Playwright templates. |
| Failure triage | `qa-debug` | Evidence-backed classification, timeline, owner, ranked fixes. | **Production** | [`debug-result.schema.json`](../skills/qa-debug/contracts/debug-result.schema.json) + `diagnostics` tests + bundle self-containment check. |
| Repair planning | `qa-fix` | Produces a safe repair **plan** and writes no code at all. Any diff — drafted or supplied — is reviewed by the diff guard, and a `fail` verdict cannot be reported `repairable`. | **Production** | [`fix-result.schema.json`](../skills/qa-fix/contracts/fix-result.schema.json) with its runtime invariant + diff-guard tests. |
| Reporting | `qa-report` | Aggregates results into summaries + a release-readiness verdict. | **Production** | [`report-result.schema.json`](../skills/qa-report/contracts/report-result.schema.json). |
| Quality review | `qa-review` | Reviews automation quality against the knowledge base and recommends improvements. Edits nothing. | Beta | [`review-result.schema.json`](../skills/qa-review/contracts/review-result.schema.json) + examples. |
| Flaky detection | `qa-flaky` | Detects/quantifies flakiness; proposes quarantine (never auto-applies). | Beta | [`flaky-result.schema.json`](../skills/qa-flaky/contracts/flaky-result.schema.json) + examples. |
| API testing | `qa-api` | Assesses REST, GraphQL, and WebSocket behavior. | Beta | [`api-result.schema.json`](../skills/qa-api/contracts/api-result.schema.json) + examples. |
| Page audit | `qa-audit` | Accessibility, performance, security, and visual audits. | Beta | [`audit-result.schema.json`](../skills/qa-audit/contracts/audit-result.schema.json) + examples. |
| Live product QA | `qa-explore` | Live-URL, multi-dimension QA with an evidence report and screenshots. | **Experimental** | [`explore-result.schema.json`](../skills/qa-explore/contracts/explore-result.schema.json) + 1 golden and 6 adversarial eval cases. Reporting and API analysis are deterministic (`artifacts verify`, `analysis network`, `report-bundle`); **performance, security, and accessibility remain model judgement with no analyzer behind them**. Newest command ([RFC-0001](rfcs/RFC-0001-qa-explore.md)), broadest scope, least track record; no live-application run has been measured. |

Supporting platforms that the commands share:

| Platform | Role | Level | Evidence |
| --- | --- | --- | --- |
| Deterministic analysis core (`analysis`) | Redaction, evidence model, taxonomy, JUnit/HAR parsers, contract validator, context parser, diff guard — reachable from skills through `python3 -m qa-engine analysis`. | **Production** | engine unit tests in `packages/engine/test/`. |
| Diagnostic engine (`diagnostics`) | Root cause, timeline, prioritization, repair planning; one engine, five skills — reachable through `python3 -m qa-engine diagnostics`, inputs and outputs validated against the internal seam contracts. | **Production** | engine unit tests in `packages/engine/test/`, plus an installed-bundle execution test. |
| Framework analyzers | Playwright report + trace analyzers (`qa-engine playwright`), bundled into `qa-run` and `qa-debug`; thin JUnit adapters for the other three. | **Production** (Playwright) · Beta (others) | `packages/engine/test/` and the cross-framework test. |
| Contract invariants | Cross-field rules enforced by the shipped schemas: `passed` implies exit code 0 and no failures; `ready` implies zero failures; a failed diff-guard review cannot be `repairable`. | **Production** | `packages/engine/test/test_parity.py`; validator parity corpus in `tests/parity/`. |
| QA knowledge base | 19 domain documents, uniform seven-section structure, lint-enforced. | **Production** | `check-knowledge` lint (19 documents) in CI. |
| Installer CLI (`qa` / `install` / `verify` / `doctor` / `self-test` / `repair` / `update` / `uninstall`) | Interactive onboard, detection/recommendations, copy-based install, lockfile, thin wrappers, transactional uninstall; no code execution at install. | Beta | Smoke, bundle, parity, and uninstall tests in `packages/installer/test/`; no behavioral eval yet. |

The whole pack is verified by **82 engine tests** and **30 Node tests**, plus the
Node validators (`validate-skills`, `sync-shared --check`, `check-keywords`,
`check-knowledge`, `check-doc-claims`, `check-docs-commands`) and the release
packaging gate. See [Evidence index](#evidence-index).

## Framework matrix

Where each automation framework stands. The per-capability detail and the known
gaps live in the [framework matrix](compatibility/framework-matrix.md), which uses
these same levels; this table is the summary of record.

| Framework | Detection | Live execution | Live generation | Analysis / normalization | Diagnostics & reporting | Level |
| --- | --- | --- | --- | --- | --- | --- |
| **Playwright** | Yes | Yes | Yes | Full (trace, report, HAR, JUnit) | Full | **Production** |
| **Selenium** | Yes | Planning (gated) | Planning (gated) | JUnit-normalized | Full | **Beta** |
| **Cypress** | Yes | Planning (gated) | Planning (gated) | JUnit-normalized | Full | **Beta** |
| **WebdriverIO** | Yes | Planning (gated) | Planning (gated) | JUnit-normalized | Full | **Beta** |
| Robot Framework | Planning | — | — | — | — | **Planning** |
| Appium (mobile) | Planning | — | — | — | — | **Planning** |

Two honest facts sit behind this table:

1. **Only Playwright executes and generates live today.** Selenium, Cypress, and
   WebdriverIO are *adapter-complete*: they detect projects and normalize results
   identically to Playwright through the shared core, and the cross-framework test
   proves that normalization. But `qa-run` and `qa-generate` deliberately gate
   *live* execution and generation to Playwright. Flipping that gate is an
   adapter-only change ([ADR-0013](architecture/ADR-0013-framework-boundary.md))
   — until it flips, the honest word for those three frameworks is **Beta**, not
   "supported" without qualification.
2. **Analysis depth varies.** Only Playwright has a rich trace and native HAR; the
   other three normalize through JUnit plus their own screenshots/videos/logs.
   Trace forensics is Playwright-only.

Diagnostics and reporting are Full for all four because they consume the
*normalized* result — once a framework normalizes, it debugs and reports
identically to Playwright.

### Evidence for the framework levels

- **Playwright** — `shared/frameworks/playwright/lib/` (trace + report analyzers,
  ~128 lines) with a dedicated test suite.
- **Selenium** — `shared/frameworks/selenium/lib/` (thin JUnit adapter) with a
  dedicated adapter test **and** coverage in the cross-framework test.
- **Cypress, WebdriverIO** — `shared/frameworks/{cypress,webdriverio}/lib/` (thin
  JUnit adapters) covered by the **cross-framework test**
  (`packages/engine/test/test_compat.py`), which asserts all four frameworks
  produce an identical normalized shape and taxonomy. They have no dedicated
  per-adapter test file beyond the shared one — hence Beta, alongside Selenium,
  rather than Production.

## Agent compatibility

Which AI agents can load these skills is tracked separately, with its own tiers,
in [COMPATIBILITY.md](../COMPATIBILITY.md). Nothing in that document changes the
capability levels here.

## Evidence index

| Claim | Proven by | Run it |
| --- | --- | --- |
| 82 engine tests pass | `packages/engine/test/`, `packages/engine/test/`, `packages/engine/test/` | `node --test packages/engine/test/*.test.mjs` |
| All four frameworks normalize identically | `packages/engine/test/test_compat.py` | (included above) |
| 12 user-facing skills valid; description budget respected | `scripts/validate-skills.mjs` | `npm run validate:skills` |
| Shared knowledge copies are in sync | `scripts/sync-shared.mjs --check` | `npm run validate:sync` |
| 19 knowledge domains are well-formed | `scripts/check-knowledge.mjs` | `npm run validate:knowledge` |
| Bundled tooling **runs** in an installed skill, not just imports | `npm test` | `python3 npm test` |
| The installed engine and context validator run from the bundle alone | `packages/installer/test/bundle.test.mjs` | `npm test` |
| Installer installs, verifies, reports, and uninstalls transactionally | `packages/installer/test/` | `npm test` |
| Every shipped contract stays inside the validator-enforced subset | `packages/engine/test/corpus/validator-cases.json` | `npm test` + `node --test packages/engine/test/*.test.mjs` |
| A contract rejects a hallucinated-green result at runtime | `packages/engine/test/test_parity.py` | `node --test packages/engine/test/*.test.mjs` |
| `.qa/context.md` is parsed and validated deterministically | `packages/engine/test/test_context.py` | `npm run validate:context` |
| The diff guard catches fake-green techniques and passes legitimate repairs | `packages/engine/test/test_analysis.py` + `tests/fixtures/*.diff` | `node --test packages/engine/test/*.test.mjs` |
| Documentation claims match skill behavior | `scripts/check-doc-claims.mjs` | `npm run validate:doc-claims` |
| Every documented CLI command exists and runs | `scripts/check-docs-commands.mjs` | `npm run validate:docs-commands` |
| Every capability claim matches this matrix | `scripts/check-capability-matrix.mjs` | `npm run validate:matrix` |
| The published tarball carries everything the installer bundles | `scripts/release/validate-release.mjs` | `npm run validate:release` |
| Skill outputs reject hallucinated-green and unsafe results (deterministic behavioral gate) | `tests/evals/run-evals.mjs` (golden + adversarial cases) | `npm run validate:evals` |
| A (replayed or real) agent's output passes the same gate, with regression detection | `tests/evals/run-live.mjs` + `baselines/reference.json` | `npm run eval:live` |

## Change policy

Adding, promoting, or demoting a capability is a single pull request that updates
**this file**, the [framework matrix](compatibility/framework-matrix.md), and the
test that proves the new level — together. The
[capability-matrix consistency check](../scripts/check-capability-matrix.mjs) in
CI fails if the framework levels here and in the framework matrix disagree, so the
matrix can never quietly overstate support.
