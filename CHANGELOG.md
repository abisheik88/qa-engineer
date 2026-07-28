# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) as specified in [ADR-0003](docs/architecture/ADR-0003-versioning-strategy.md). Unreleased changes accumulate at the top; each release moves them under its own version heading.

## [Unreleased]

Nothing yet.

## [0.9.2] — 2026-07-28

### The HTML report is rendered, not typed

The first live `/qa-explore` run produced a valid artifact and a lossy report. The
`explore-result` contract requires `actual`, `expected`, `repro`, and `fixDirection`
on every finding; the hand-written HTML collapsed all four into one sentence — three
findings had no body text at all — and omitted the attribution footer entirely. Both
failures had one cause: the page was typed by the model rather than rendered from the
artifact.

- **Added** `qa_analysis.report_html` and the `report-html` subcommand, which render
  `explore-result` and `report-result` as one self-contained HTML document. Each
  finding is a card stating, in this order: the defect, **current behaviour**,
  **expected behaviour**, numbered reproduction steps, fix direction, and every
  evidence entry — screenshots as images, everything else as a captioned excerpt.
  Severity ordering, summary tiles, the test-case table with each failure linked to
  the finding it raised, the evidence index, data-validation comparisons, fix order,
  and the footer come with it. No stylesheet, script, font, or remote asset: the
  report opens from an email attachment offline.
- **Changed** `/qa-explore` to write and validate the JSON first and render the HTML
  from it, with a `## Tooling` section and the bundled launcher. `/qa-report` renders
  its HTML the same way. The instruction that permitted "a short md→html snippet" is
  gone.
- **Added** `qa_analysis` to `/qa-explore`'s bundle in both bundlers, so the renderer
  is present where the skill runs.
- **Added** `command` to the `explore-result` evidence type enum. The new Tooling
  section tells the agent to run a tool and cite it, and without this the citation
  would not have validated — caught by `check-doc-claims`, not by review.
- **Added** 26 renderer tests that read the contract's own `required` list, so adding
  a required finding field fails the suite until the renderer renders it. The bundle
  smoke test now renders a report from inside the bundle rather than importing the
  module. Both verified by deleting `expected` from the renderer and confirming they
  go red.
- **Fixed** the footer instruction in `evidence-and-reporting`, which still used the
  POSIX-only `QA_LIB`/`PYTHONPATH=` recipe that the launcher replaced everywhere
  else — the one command the report skills were told to run was the one that would
  have failed on Windows.

## [0.9.1] — 2026-07-28

### Renamed: the product is QA Engineer Pack

`0.9.0` shipped with the package named `qa-engineer` and the product still called
QA Automation Pack. Completing the rename so the two agree.

- **Changed** the product name to **QA Engineer Pack** in 31 files — the README
  title, the attribution footer (via `branding.json`, so every rendered report
  follows from one edit), the `doctor` header, `install` output, agent wrapper
  text, the npm description, every guide, and both engineering-principles
  documents.
- **Added** two name-consistency rules to `check-branding`, because a rename that
  touches only the README is exactly what happened here: the H1 said QA Engineer
  Pack while 44 occurrences of the old name remained, including the footer that
  appears on every report a user shares. The gate now fails if the README title
  and `branding.projectName` disagree, or if a previous product name survives
  anywhere outside the historical records. Both directions verified by
  reintroducing the drift.
- **Unchanged:** the npm package, the CLI, and every command name. Installation is
  still `npx qa-engineer`, so nothing a `0.9.0` user typed stops working.

Historical records — the release audits, the readiness assessment, and earlier
changelog entries — keep the name the project had when they were written. They
describe a release that shipped under that name, and editing them would make an
audit trail describe something that never existed.

## [0.9.0] — 2026-07-28

First public release: a preview. Everything below shipped in this version.

**What this release is.** Twelve QA skills any Agent Skills–compatible AI
assistant can read, a deterministic Python engine that produces the facts those
skills report, and output contracts that reject a result contradicting its own
numbers. Playwright runs live; Selenium, Cypress, and WebdriverIO are detected and
their results understood, but not executed.

**What it is not.** Behaviourally benchmarked across AI models. Both evaluation
layers score committed artifacts, and the four real agent-produced captures are
one model in one session. The harness supports real agents and cross-model drift;
running it needs API access. Stated here rather than discovered later —
[docs/release/v1-excellence-audit.md](docs/release/v1-excellence-audit.md) declines
to claim an accuracy number, and [the preview checklist](docs/release/v0.9-release-checklist.md)
lists every known limitation.

Verified before release: 235 automated tests, 20 repository gates, a clean-room
install from the real tarball, and the runnable example executed end to end with a
genuine Playwright browser.

### Preview-testing readiness

Three changes for a private preview, each closing a gap a tester would have hit.

**Fixed: the documented tool invocation was POSIX-only.** Every skill told the
agent to run

```bash
QA_LIB="$(ls -d .agents/skills/qa-run/scripts/lib … | head -1)"
PYTHONPATH="$QA_LIB" python3 -m qa_analysis.cli junit report.xml
```

Command substitution, `ls -d | head -1`, and the `VAR=value command` prefix are
all POSIX-only, so on Windows PowerShell every deterministic call failed. A
failed call does not stop a skill — it falls back to its manual path and marks
the result degraded. Windows users would therefore have got the *guessing*
behaviour this project exists to replace, while believing the tooling ran.

- **Added** `shared/tooling/qa_tool.py`, bundled into every skill as
  `<skill>/scripts/qa_tool.py`. It resolves its own `lib/` directory, so the
  shell does no work:

  ```bash
  python3 .agents/skills/qa-run/scripts/qa_tool.py analysis junit report.xml
  ```

  Identical in bash, zsh, PowerShell, and cmd.exe. The only platform difference
  left is `python` instead of `python3` where the latter is not on PATH.
- **Changed** all eight bundling skills and the shared invocation contract to the
  portable form; `check-doc-claims` now **fails** on a `QA_LIB`/`PYTHONPATH=`
  recipe, so it cannot come back.
- **Changed** `bundle_python.py --check` to execute the launcher with no
  `PYTHONPATH` set, which is the condition that matters.

**Added: an honest message when no supported framework is found.** A Jest, Vitest,
or pytest project previously installed all thirteen skills with no comment, and
`/qa-run` then stopped and recommended `/qa-init` — which the user had already
run. That loop reads as a broken install. Install now says which commands work in
this project and which need an end-to-end framework, and names the unit-test case
explicitly.

**Added** [docs/preview-tester-guide.md](docs/preview-tester-guide.md) — a
20-minute script for preview testers, including how to try to catch the assistant
lying, and what feedback is worth sending back.

**Changed** `doctor` to render failing *optional* checks as warnings rather than
errors. A healthy install previously greeted new users with two red lines ("not a
git repository", "no assistant markers") directly above hints calling them
optional.

**Added** an operating-system table to [COMPATIBILITY.md](COMPATIBILITY.md), which
had never stated one: Linux verified in CI, macOS and Windows expected but not
verified end to end. "Expected", not "supported", until someone runs it.

### Renamed: the package and CLI are now `qa-engineer`

Installing the pack should read like hiring one, so the published package and the
command users type are now `qa-engineer`:

```bash
npx qa-engineer --yes --project .
```

- **Changed** the npm package name from `qa-automation-pack` to `qa-engineer`, and
  the installer workspace to `@qa-engineer/installer`.
- **Added** a `qa-engineer` bin. `npx <package>` runs the bin matching the package
  name, so this is what makes the documented command resolve; `qa` and `qa-pack`
  are kept, so nothing that already worked stops working.
- **Changed** `PACK_NAME`, so `qa-lock.json` now records `"pack": {"name": "qa-engineer"}`.
  Existing installs keep working — `verify` compares file hashes, not the pack name —
  and the next `install`, `update`, or `repair` rewrites the lockfile.
- **Changed** every documented command, local-checkout path, and repository URL to
  the new identity, and `check-docs-commands` now flags the old name as stale so a
  leftover cannot creep back.
- **Unchanged:** the product is still called **QA Engineer Pack** in prose, in the
  README title, and in the report attribution footer. Renaming the product is a
  separate decision from renaming the package, and this change does not make it.

**On capitalisation.** npm rejects capital letters in new package names
(`validate-npm-package-name` reports `validForNewPackages=false` for `qa-Engineer`),
so the published name is lowercase `qa-engineer` and `npx qa-Engineer` would not
resolve. Verified rather than assumed.

Historical records — the release audits and earlier changelog entries — keep the
name in use when they were written, and the docs gate exempts them. Rewriting them
would make an audit trail say something that did not happen.

### Release hardening sprint — correctness, consistency, and trust

No new QA capabilities, frameworks, or AI providers. This sprint verified an
independent production audit against the repository and fixed only what was
confirmed; the finding-by-finding verdicts and evidence are in
[docs/release/audit-verification.md](docs/release/audit-verification.md), and the
post-fix re-audit is in [docs/release/final-release-audit.md](docs/release/final-release-audit.md).

**Fixed — the bundled engine could not run.** `qa_diagnostics` validates every
diagnosis against its internal schemas, but those schemas were never bundled, so
`engine.diagnose()` raised `FileNotFoundError` in every installed project.
`bundle_python.py --check` only *imported* the packages, so CI never noticed.

- **Fixed** bundling to carry package data (internal schemas, the context
  contract); `--check` now **executes** the engine and CLI from the bundle.
- **Fixed** the published CLI reporting version `0.0.0` — and writing it into
  every lockfile — because `packages/installer/package.json` was not in the npm
  `files` allowlist. Version resolution now tries both manifests and fails
  loudly (`0.0.0-unknown`) rather than plausibly.
- **Fixed** the npm tarball omitting `shared/frameworks/**` (including the
  Playwright trace/report analyzers cited as evidence for Playwright
  "Production") and shipping 18 `__pycache__/*.pyc` build artifacts.

**Added — deterministic tooling is now reachable.** Six skills told an agent to
"run the bundled `qa_diagnostics` package" with no command, no `PYTHONPATH`, and
no input shape; `qa_diagnostics` had no CLI at all.

- **Added** [`qa_diagnostics.cli`](shared/diagnostics/lib/qa_diagnostics/cli.py)
  (`diagnose`, `plan-repairs`, `summarize`, `report`) with inputs and outputs
  validated against the internal seam contracts, and a CLI for the Playwright
  adapter (`python -m playwright_analysis report|trace`).
- **Added** [deterministic-tooling.md](shared/execution/deterministic-tooling.md) —
  one invocation contract, synced into all eight bundling skills, so every
  deterministic call is identical across skills.
- **Changed** every bundling skill's `## Tooling` section to a concrete command;
  **added** one to `qa-run` and `qa-init`, which had none.
- **Changed** `qa-run` step 9: reporter output is normalized by the bundled
  parser and copied verbatim. Reading the reporter and writing the numbers by
  hand was forbidden by
  [deterministic-execution-boundary.md](docs/architecture/deterministic-execution-boundary.md)
  and was nevertheless what the skill instructed.

**Added — invariants moved from test fixtures into the shipped contracts.** The
rule that rejects a hallucinated-green result existed only in an eval case; the
schema accepted `classification: passed` alongside a non-zero exit code.

- **Added** cross-field invariants (`allOf` + `if`/`then`) to
  `qa-run/execution-result`, `qa-report/report-result`, and `qa-fix/fix-result`.
- **Added** `allOf`/`if`/`then`/`else` support to both validators; the Python
  validator now **reports** unsupported keywords instead of silently ignoring
  them, and both share one RFC 3339 `date-time` rule.
- **Added** [tests/parity/validator-cases.json](tests/parity/validator-cases.json) —
  44 cases run through both validators, with a CI gate that fails if the two
  keyword sets or verdicts drift apart.

**Added — `.qa/context.md` can be validated.** The contract was JSON Schema, the
artifact is YAML frontmatter, and nothing in the repository parsed it; CI checked
a hand-written JSON fixture instead.

- **Added** [`qa_analysis.context`](shared/analysis/lib/qa_analysis/context.py):
  a deterministic parser for the documented YAML subset, plus
  `qa_analysis.cli context`. `qa-init` now validates what it writes before
  reporting completion.

**Changed — the diff guard tells repairs and sabotage apart.** It flagged a
legitimate locator heal as `high` (training users to override it) while missing
three standard ways to fake a green suite.

- **Changed** assertion analysis to compare *strength*: an equal-or-stronger
  replacement keeping the same expected values is `assertion-modified` (`low`);
  a weaker one, or one that drops the expected value, is `weakened-assertion`
  (`high`).
- **Added** detection for conditional/early returns in tests, suite exclusion
  (`testIgnore`, `excludeSpecPattern`), always-succeeding test commands
  (`|| true`, `--passWithNoTests`, `continue-on-error`), swallowed failures, soft
  assertions replacing hard ones, and outright test-file deletion.
- **Fixed** the `removed-wait` rule, which was unreachable.

**Added — `qa uninstall`**, with the same transactional guarantees as install,
update, and repair: it removes exactly the lockfile's files, backs up each one,
refuses to discard local edits without `--force`, cleans up its own bytecode, and
prunes empty directories.

**Changed — documentation now matches implementation, mechanically.**

- **Fixed** the README describing `/qa-fix` as "writing fixes to source" and
  `/qa-review` as applying improvements; both skills state they never edit.
  Only `/qa-generate` writes to your source, and the README now says so plainly.
- **Fixed** the claim that all twelve commands ship an output contract (ten do).
- **Added** `check-doc-claims.mjs` (documentation vs. skill behavior) and
  `check-docs-commands.mjs` (every documented command exists, is spelled the way
  users type it, and runs). The latter caught `uninstall` shipping undocumented.
- **Fixed** 51 occurrences of `npx qa`, which resolves an unrelated registry
  package; **added** a `qa-automation-pack` bin so the documented command works.
- **Changed** `shared/ci/` and `shared/stacks/` to state plainly that they are
  unauthored, and recorded them in the roadmap as open M3 scope.
- **Changed** agent detection to report `Unknown agent (shared Agent Skills path)`
  instead of naming Cursor when nothing was detected; the lockfile now records
  whether each host was actually detected.

**Added — CI covers the stated support range.** Python 3.9 + 3.12 matrix with a
`check-python-floor.py` gate that parses every shipped module at the declared 3.8
floor; Node 18 + 20 + 22 matrix against `engines.node >=18.18.0`; a release gate
that fails if the tarball omits anything the installer bundles.

### Milestone 10.5 — Architecture hardening and mechanical enforcement

No new user-facing QA features or frameworks. This milestone converts architectural
principles into executable guarantees.

- **Added** [ENGINEERING_PRINCIPLES.md](docs/architecture/ENGINEERING_PRINCIPLES.md),
  [deterministic-execution-boundary.md](docs/architecture/deterministic-execution-boundary.md),
  and [ADR-0014](docs/architecture/ADR-0014-evaluation-platform.md) (evaluation platform).
- **Added** canonical [framework registry](shared/frameworks/registry.json); installer
  detection and CI derive from it (`check-framework-registry.mjs`).
- **Added** internal diagnosis/analysis/execution schemas and seam validation in
  `qa_diagnostics`; seam regression tests under `tests/seams/`.
- **Added** architecture fitness, spec⇄code sync, and release validation scripts;
  safety adversarial eval cases under `tests/evals/safety/`.
- **Changed** CI to run the new validators and seam tests (still no npm publish).

### Milestone 9.5 — World-class installation and onboarding

No new QA capabilities or framework expansion. This milestone made installation
feel like a product CLI.

- **Added** interactive onboarding (`npx qa-automation-pack` / `qa onboard`) with environment
  detection, capability recommendations, install progress, post-install
  validation, and a guided first-run; `qa self-test`, `qa repair`, and
  `qa update`; expanded human-first `qa doctor` with repair hints and Python
  import checks; [quickstart](docs/installation/quickstart.md); GitHub
  `release.yml` scaffold (`npm pack` on tag; publish disabled until ready).
- **Changed** the documented user path to `npx qa-automation-pack` / `npm run qa` (internal
  `node packages/installer/bin/qa.mjs` is no longer the primary install docs).
- **Added** `@clack/prompts` as the installer UX dependency (analyzers remain
  dependency-free).

### Milestone 8.5 — Release readiness and truth alignment

No new features, skills, frameworks, or analyzers. This milestone made every
capability claim demonstrably true and the documentation internally consistent.

- **Added** the canonical [capability matrix](docs/capability-matrix.md)
  (Production / Beta / Experimental / Planning) as the single source every doc
  derives capability claims from; a runnable, contract-validated Playwright
  [example](examples/getting-started/README.md) (support → install → generate →
  run → debug → report); an installer smoke test (`npm test`); a
  `check-capability-matrix` CI check; and the
  [release readiness report](docs/release-readiness.md).
- **Changed** framework support to the honest taxonomy: Playwright is Production,
  Selenium/Cypress/WebdriverIO are Beta (adapter-complete, live use gated),
  `qa-explore` is Experimental. Downgraded `qa-generate`'s implied live
  Selenium/Cypress/WebdriverIO generation to Beta/unverified, matching `qa-run`'s
  gating. Corrected the architecture overview, extension points, execution
  lifecycle, and skill-interaction docs to describe the current (mostly shipped)
  state.
- **Fixed** contradictions and dead references: the M9 status (README said
  "Planned" while the installer had shipped), the broken `npm test` and
  `docs:build` scripts, non-existent `qa-frameworks`/`qa-toolbox`/`packages/cli`/
  `packages/docs-gen`/`docs-site` references, aspirational agent-tier wording, and
  pre-existing Markdown lint failures.

### Added

- Full-spectrum product QA ([RFC-0001](docs/rfcs/RFC-0001-qa-explore.md)):
  - Twelfth user-facing skill [`qa-explore`](skills/qa-explore/README.md): live URL intake, attached test-case execution, functional / API replay / performance / client security / UI-UX dimensions, optional DB validation, and evidence-backed MD/HTML/JSON reports with screenshots per finding.
  - Domains [`exploratory-qa`](shared/domains/exploratory-qa.md) and [`api-replay`](shared/domains/api-replay.md); explore-result contract and worked examples.
  - Installer CLI (`qa install` / `qa verify` / `qa doctor`) and multi-agent installation guides under [docs/installation/](docs/installation/README.md).

- QA knowledge platform and multi-framework completion (Milestone 8):
  - The [QA engineering knowledge base](shared/domains/README.md): 17 authored domain documents (locator strategies, waiting strategies, assertion patterns, page objects, fixtures, test data, flakiness, retry, authentication, REST, GraphQL, WebSocket, accessibility, performance, security, visual testing, anti-patterns), each a single authoritative document with a uniform seven-section structure and every claim labeled by force (best practice, recommendation, framework requirement, known limitation, anti-pattern, trade-off). A `check-knowledge.mjs` lint enforces the structure and link-freeness in CI.
  - Four new user-facing skills, each reusing the platforms and knowledge base with schema-validated contracts and worked examples: [qa-review](skills/qa-review/README.md) (quality review and score), [qa-flaky](skills/qa-flaky/README.md) (flake identification and mitigation, never auto-quarantining), [qa-api](skills/qa-api/README.md) (REST/GraphQL/WebSocket assessment), and [qa-audit](skills/qa-audit/README.md) (accessibility, performance, security, and visual audits). The eleven-command surface was complete at M8 close; `qa-explore` later expanded it to twelve.
  - The [Cypress](shared/frameworks/cypress/README.md) and [WebdriverIO](shared/frameworks/webdriverio/README.md) adapters — detection, execution/generation planning, artifact mapping, conventions, and thin analysis libs — completing the four-framework matrix. A cross-framework test proves Playwright, Selenium, Cypress, and WebdriverIO produce identical contracts through the shared core (47 Python tests total).
  - The [framework compatibility matrix](docs/compatibility/framework-matrix.md); the [domain template](templates/domain-template.md); ADR-0012 (knowledge base as one document per domain) and ADR-0013 (the framework adapter boundary is permanent).
  - CI extended with the knowledge-base lint and the four new skills' bundle checks.

- QA diagnostic platform (Milestone 7):
  - The shared [diagnostic engine](shared/diagnostics/README.md) under `shared/diagnostics/`: 11 specification modules (diagnostic contract, diagnostic engine, investigation workflow, root-cause analysis, timeline builder, finding prioritization, recommendation ranking, repair strategy, report aggregation, knowledge integration) plus the tested `qa_diagnostics` Python package (root_cause, prioritization, repair, timeline, engine) that reuses the analysis toolkit. Failure reasoning exists once; the three skills present it differently.
  - [`qa-debug`](skills/qa-debug/README.md): investigates a failure into an evidence-backed root cause with a reconstructed timeline, prioritization, owner, and ranked recommendations — proposing no code changes. Four worked examples (product bug, authentication, locator break, network timeout).
  - [`qa-fix`](skills/qa-fix/README.md): turns a diagnosis into a safe repair *plan* — proposed changes as prose, affected files, risk, required permission, rollback, and diff-guard review — never editing code.
  - [`qa-report`](skills/qa-report/README.md): aggregates execution, generation, and diagnosis results into executive, engineering, test, failure, coverage, and risk summaries with a deterministic release-readiness verdict, in Markdown, HTML-ready, and JSON.
  - Three schema-validated contracts (debug-result, fix-result, report-result); the `authorization` and `flaky` additions to the failure taxonomy; and `scripts/bundle_python.py`, which materializes the analysis and diagnostics engines into each diagnostic skill's `scripts/lib/` (a git-ignored build artifact) with a `--check` mode CI runs to prove each skill bundles and imports self-contained.
  - ADR-0011 (one diagnostic engine, three skills).
  - CI extended: the analysis Python job now runs the diagnostics tests (46 total), and a bundling check verifies self-containment.

- Deterministic analysis platform and multi-framework foundation (Milestone 6):
  - The shared [analysis platform](shared/analysis/README.md) under `shared/analysis/`: ten specification modules (analyzer contract, artifact discovery and validation, evidence model, finding classification, failure taxonomy, confidence model, redaction policy, recommendation guidelines) plus a tested, standard-library-only Python core (`shared/analysis/lib/qa_analysis/`): credential/PII redaction, the evidence and finding model, the failure-taxonomy classifier, artifact discovery with integrity classification, framework-agnostic JUnit and HAR parsers, a JSON-Schema-subset contract validator, and the diff guard.
  - The [Playwright analyzers](shared/frameworks/playwright/README.md) — trace and JSON-report parsers — as the framework adapter, reusing the core.
  - The [Selenium reference adapter](shared/frameworks/selenium/README.md) — the pack's second framework — with detection, execution and generation planning, artifact mapping, conventions, and a thin analysis adapter that reuses the shared JUnit parser.
  - The machine-validatable [`.qa/context.md` schema](shared/analysis/schemas/context.schema.json).
  - A cross-framework compatibility test proving Playwright and Selenium produce identical contracts through the shared core, and 29 Python unit tests covering redaction, parsing, discovery, contract validation, the diff guard, the taxonomy, and the evidence model.
  - The diff guard: deterministic detection of unsafe test changes (removed assertions and waits, added skips, forced passes, timeout inflation, suspicious locator changes, mass deletions, empty bodies, unsafe retries), each flag explaining why it is unsafe.
  - ADR-0009 (a deterministic, framework-agnostic analysis platform, in code) and ADR-0010 (the multi-framework foundation, proven by Selenium).
  - CI extended with a Python job (unit tests, contract validation, redaction and diff-guard checks) and broadened JSON-Schema validation; `.editorconfig` gained a Python profile.

- Intelligent automation generation (Milestone 5):
  - The shared [generation platform](shared/generation/README.md) under `shared/generation/`: repository analysis of existing automation, framework selection (with detect-only Robot Framework and Appium), the mode decision (extend vs bootstrap) and generation strategies, project bootstrap, suite extension, template selection, code-style matching, and naming conventions.
  - The [Playwright generation reference](shared/frameworks/playwright/playwright-generation.md) and a curated set of production-quality Playwright code templates (config, page objects, fixtures, API helper, test data, utilities, example test, environment, README) carried by the skill and adapted to each project.
  - The [generation result contract](skills/qa-generate/contracts/generation-result.schema.json): a record of files generated, modified (with permission), and skipped (with reason), plus the discovery evidence behind every decision.
  - The [`qa-generate`](skills/qa-generate/README.md) skill with two modes — bootstrap a new framework, or extend an existing suite — that always inspects first, reuses before creating, never overwrites without permission, and matches the project's conventions.
  - ADR-0008 (generation is discovery-first, non-destructive, and convention-matching, with a template-category contract for frameworks to plug into).
  - `validate-skills` corrected so the one-level-deep link rule applies only to `references/`, letting skills link into nested `templates/` and `scripts/` directories.

- Execution engine (Milestone 4):
  - The shared [execution platform](shared/execution/README.md) under `shared/execution/`: the framework-[adapter contract](shared/execution/execution-contract.md), framework detection and adapter selection, the [execution strategies](shared/execution/execution-strategy.md) (smoke, regression, changed, single spec, targeted, tag-based, directory-based, failed-only, retry), the command builder, the browser lifecycle (startup, timeout, retry, cleanup, cancellation), the common artifact model, report normalization, and environment detection.
  - The [Playwright reference adapter](shared/frameworks/playwright/README.md) — the only framework that executes this milestone — covering project discovery, command building and result normalization, and artifact mapping; Selenium, Cypress, and WebdriverIO are detected and planned but reported `blocked`.
  - The [normalized execution result contract](skills/qa-run/contracts/execution-result.schema.json): a framework-independent record (status, counts, per-test outcomes, artifacts, environment) that the analysis layer will consume without knowing which framework produced it.
  - [`qa-run`](skills/qa-run/README.md) upgraded from planner to executor: it plans, executes Playwright through the agent's shell with evidence collection, and emits both the plan and the normalized result; it stops and explains rather than guessing when required information is missing.
  - ADR-0006 (framework-agnostic execution through adapters, agent as runtime) and ADR-0007 (the normalized result is the interface between execution and analysis).
  - CI extended to validate every JSON Schema and the new execution architecture; `validate-skills` hardened to forbid links that escape a skill directory from within reference files.

- QA core engine (Milestone 3):
  - The three core skills, built on the Milestone 2 platform: [`qa`](skills/qa/README.md), the router that classifies intent and dispatches by name without doing work itself; [`qa-init`](skills/qa-init/README.md), which analyzes a repository and writes its profile to `.qa/context.md`; and [`qa-run`](skills/qa-run/README.md), the orchestration engine that plans a run — strategy, scope, evidence plan, and result contract — without executing it yet.
  - The [project context contract](docs/architecture/context-contract.md): the canonical structure of `.qa/context.md`, the pack's shared state, read first by every skill.
  - The [execution lifecycle](docs/architecture/execution-lifecycle.md): the fixed phase model every execution skill follows, with defined seams for deterministic tooling to fill later.
  - [Engineering principles](docs/engineering-principles.md), the project's constitution for architectural decisions.
  - The [skill-interaction](docs/architecture/skill-interactions.md) and [extension-point](docs/architecture/extension-points.md) maps documenting how skills communicate and how future capability plugs in.
  - The [evaluation framework design](tests/evals/README.md): the structure and scoring model for automated skill regression testing (design only; the runner is implemented later).
  - `qa-run`'s execution-plan output contract, and the shared `evidence-and-reporting` knowledge module synced into `qa-init` and `qa-run`.
  - ADR-0004 (project context captured once and read by every skill) and ADR-0005 (execution skills follow a fixed lifecycle and emit conformant contracts).
- Skill development platform (Milestone 2):
  - The skill platform documentation set under `docs/skills/`: canonical skill anatomy, the normative `SKILL.md` specification, the authoring guide (create, test, review, version, deprecate, compose; model-only versus user-facing), the output contract standard with envelope and JSON Schema strategy, and per-dimension quality checklists.
  - The shared knowledge engine: section architecture under `shared/` (domains, frameworks, stacks, ci) with planned catalogs, the knowledge module format, and marker-based copy sync with a CI drift gate.
  - Templates for every recurring artifact: a complete skill scaffold, knowledge module, output contract schema, worked example, RFC, and release notes.
  - Repository tooling under `scripts/`: `validate-skills.mjs` (layout, frontmatter, sections, prohibitions, links, contracts, budgets), `sync-shared.mjs` (`--check`/`--write`/`--add`), and `check-keywords.mjs` (description collision analysis) — all wired into CI as a skill-platform job.
  - The `qa-example` reference skill: a complete, validated implementation of the platform that doubles as an installation self-check, with contract, references (local and synced), and a worked example.
  - Local development experience: VS Code recommended extensions, workspace settings, and editor snippets; a development workflow guide covering the validation loop, live skill testing, and debugging.
  - Style guide expansion in the documentation standards: voice and tone, verbosity rules, admonition and example conventions.
- Repository foundation (Milestone 1):
  - Community health files: README, contributing guide, code of conduct (Contributor Covenant 2.1), security policy, compatibility matrix, and public roadmap.
  - Architecture Decision Record system with the three founding decisions: repository structure (ADR-0001), adoption of the open Agent Skills standard with a no-compiler invariant (ADR-0002), and the versioning strategy (ADR-0003).
  - Finalized architecture overview under `docs/architecture/overview.md`.
  - Contributor standards: coding standards, commit message convention, branch naming convention, documentation standards, review checklist, issue lifecycle, and the versioning and release process.
  - GitHub issue forms (bug report, feature request, skill proposal, documentation issue), pull request template, CODEOWNERS, Dependabot configuration, and a funding placeholder.
  - Continuous integration: Markdown linting, EditorConfig compliance, offline internal link checking, and repository structure validation; a scheduled external link health check that files issues on breakage.
  - Reserved, documented directories for future milestones: `skills/`, `shared/`, `packages/`, `scripts/`, `templates/`, `tests/`, `examples/`.
  - Repository metadata: `.gitignore`, `.editorconfig`, `.gitattributes`, and Markdown lint configuration.

### Changed

- Roadmap re-scoped (Milestone 8): QA feature work is complete with the knowledge platform and multi-framework completion; the remaining milestones are M9 (developer experience and distribution — installer, agent integrations, docs site, releases, examples) and M10 (behavioral evaluation and benchmarking, the release gate).
- The failure taxonomy split `authentication` into `authentication` (401) and `authorization` (403) and added `flaky`; the analysis test and the failure-taxonomy doc were updated to match. This is an additive, backward-compatible extension of the taxonomy.
- Roadmap re-scoped (Milestone 6): the deterministic analysis platform and the multi-framework foundation are now this milestone (complete); the diagnostic skills (`qa-debug`, `qa-fix`, `qa-report`) become Milestone 7; the remaining skill catalog and framework completion, installer, evaluation harness, and distribution follow as Milestones 8 through 11.
- Roadmap re-scoped (Milestone 5): intelligent automation generation became its own milestone; analyzers and multi-framework support moved to a later milestone.
- Roadmap re-scoped (Milestone 4): the execution engine became its own milestone; deterministic analyzers and additional framework adapters moved to a later milestone.
- `qa-run`'s M3 local planning reference was extracted into the shared execution platform, so strategy, command-building, and evidence planning are now reusable by every future execution skill instead of living inside `qa-run`.
- Roadmap re-scoped (Milestone 3) to a finer-grained plan: the QA core engine became its own milestone; deterministic tooling and execution moved to Milestone 4.
- Roadmap re-scoped (Milestone 2): the skill development platform became its own milestone, separating platform infrastructure from the canonical skills built on it.
