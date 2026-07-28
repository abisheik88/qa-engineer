# Analysis Toolkit (`analysis`)

The Python implementation of the [analysis platform](../README.md). Standard library only, deterministic, framework-agnostic. Framework adapters ([Playwright](../../shared/frameworks/playwright/README.md), [Selenium](../../shared/frameworks/selenium/README.md)) depend on this package for the evidence model, taxonomy, redaction, and contract validation.

## Layout

```text
lib/
├── the analysis modules/         the core package
│   ├── redaction.py     credential, secret, token, and PII masking
│   ├── evidence.py      the Finding / Evidence / Artifact model
│   ├── taxonomy.py      the failure classifier
│   ├── discovery.py     artifact discovery and integrity classification
│   ├── junit.py         JUnit XML parser (framework-agnostic)
│   ├── har.py           HAR parser with header redaction
│   ├── contracts.py     JSON-Schema-subset contract validator
│   ├── context.py       `.qa/context.md` frontmatter parser (documented subset)
│   ├── diff_guard.py    unsafe-change detection
│   └── cli.py           `python -m qa-engine analysis <command>`
├── tests/               unit tests and fixtures
└── run_tests.py         test runner (adds framework libs to the path)
```

## Running

```sh
# All analysis tests, including the framework adapters
node --test packages/engine/test/*.test.mjs

# The CLI (run from this directory)
python3 -m qa-engine analysis junit <path>
python3 -m qa-engine analysis har <path> [--slow-ms N]
python3 -m qa-engine analysis discover [--root DIR] [--path P ...]
python3 -m qa-engine analysis diff-guard <diff-file>
python3 -m qa-engine analysis validate <instance.json> <schema.json>
python3 -m qa-engine analysis classify "<error message>" [--http-status N]
python3 -m qa-engine analysis redact <file>
python3 -m qa-engine analysis context [--root DIR] [--path .qa/context.md]
```

Skills invoke these through one shared recipe — see
[deterministic-tooling.md](../../shared/execution/deterministic-tooling.md), which is the
single documented invocation contract every skill's Tooling section points at.

## The diff guard's two jobs

`diff_guard` is judged on both of these, and the second is why it compares
assertion *strength* rather than presence:

1. **Catch every way a suite is made to lie** — removed or weakened assertions,
   skips and `only`/`fixme` markers, forced passes, early returns inside a test,
   excluded specs, `|| true` on the test command, swallowed failures, timeout and
   retry inflation, deleted test files, mass deletions.
2. **Not flag a legitimate repair as unsafe** — healing a stale locator rewrites
   an assertion line by necessity. An assertion replaced by one at least as
   strong, keeping the same expected values, is `assertion-modified` (`low`),
   not `removed-assertion` (`high`). A guard that flags every real repair
   trains its users to ignore it.

Severity is the contract: `high` means the change is unsafe and blocks a repair
claim; `medium` and `low` mean confirm and explain. Every fixture in
`tests/fixtures/*.diff` pins one of these behaviours.

## Requirements and conventions

- **Python 3.8+, standard library only.** No third-party dependencies, ever — this package is bundled into skills that run in users' repositories.
- **Deterministic.** Same input, same output. No network, no model inference, no time-dependent conclusions.
- **Redact at the boundary.** Any artifact text is redacted before it appears in output ([redaction policy](../../shared/analysis/redaction-policy.md)).
- **Raise, do not guess.** A malformed artifact raises `MalformedArtifact`; it is never parsed past into a fabricated result.

When a diagnostic skill is built (a later milestone), this package is bundled into that skill's `scripts/lib/`, and framework adapters travel with their framework — the source of truth stays here.
