# Release Audit — Finding Verification

Phase 1 of the release hardening sprint. Every finding from the production audit
was re-checked against the repository at `0.9.0` **before** any code changed.
Each row records the verdict and the command or file that produced it. Findings
marked *False* were not acted on.

Reproduce any row by running the command in the Evidence column from the
repository root.

## Verdict summary

| # | Finding | Verdict |
| --- | --- | --- |
| F1 | Repository has no commits; CI/release workflows have never run | **Confirmed** |
| F2 | Deterministic engines are bundled with no documented invocation | **Confirmed** |
| F3 | `qa-run` asks the model to normalize machine-readable reporter output | **Confirmed** |
| F4 | Framework analyzers are unreachable and unpackaged | **Confirmed** |
| F5a | Contract invariants exist only in eval fixtures | **Confirmed** |
| F5b | Python validator silently ignores unknown keywords | **Confirmed** |
| F5c | The two validators diverge despite a comment claiming parity | **Confirmed** |
| F6 | Behavioral proof is circular (both eval layers score authored JSON) | **Confirmed** (characterization; no code defect) |
| F7 | README and capability matrix overstate `qa-fix` and `qa-review` | **Confirmed** |
| F8 | "All twelve commands ship an output contract" is false for two | **Confirmed** |
| F9 | `.qa/context.md` cannot be deterministically validated | **Confirmed** |
| F10 | `shared/ci/` and `shared/stacks/` are empty under "Complete" milestones | **Confirmed** |
| F11 | `npx qa` does not install this package | **Confirmed** |
| F12 | `npm pack` ships `__pycache__/*.pyc` | **Confirmed** |
| F13 | Knowledge duplicated into skills; `qa-example` installs into consumers | **Partially true** |
| F14 | No `uninstall`, though `fs-safe.mjs` documents one | **Confirmed** |
| F15 | Agent detection invents Cursor when nothing is detected | **Confirmed** |
| F16 | Diff guard: false positive on locator repair; three fake-green bypasses | **Confirmed** |
| F17 | Stated runtime support (Python 3.8+, Node 18+) is untested | **Partially true** |

## Evidence

### F1 — No commits (Confirmed)

```console
$ git log --oneline -5
fatal: your current branch 'main' does not have any commits yet
$ git ls-files | wc -l
0
$ git remote -v          # empty
```

534 files untracked, no remote, no tags. Every governance artifact
(`CODEOWNERS`, PR template, commit convention, `.github/workflows/*`) describes a
process that has never executed. All local gates *do* pass — verified by running
each `npm run validate:*` script, `npm test`, `python3 shared/analysis/lib/run_tests.py`,
and `python3 tests/evals/run_evals.py`.

### F2 — Deterministic engines have no invocation contract (Confirmed)

```console
$ grep -rn "python3 \|PYTHONPATH\|python -m" skills/ | wc -l
0
$ ls shared/diagnostics/lib/qa_diagnostics/          # no cli.py
```

Six skills instruct the agent to run "the bundled `qa_diagnostics` package
(`engine.diagnose`), materialized into `scripts/lib/`" with no command line, no
`PYTHONPATH`, and no input shape. `qa_diagnostics` had no CLI; only `qa_analysis`
shipped one. The schemas that define the engine's inputs
(`shared/diagnostics/schemas/internal/`) were referenced by no skill.

### F3 — `qa-run` normalizes by model (Confirmed)

`skills/qa-run/SKILL.md` step 9 read: "normalize the machine-readable reporter
into the result." The skill had no `## Tooling` section and bundled no engine,
while `qa_analysis.junit.parse_junit` and `playwright_analysis.parse_report` exist
and are unit-tested. This directly contradicts
[deterministic-execution-boundary.md](../architecture/deterministic-execution-boundary.md),
which lists "Normalize raw runner JSON by hand into `execution-result` without the
adapter" under *What the LLM must not do*.

### F4 — Framework analyzers unreachable (Confirmed)

```console
$ grep -rn "playwright_analysis\|analyze_trace" skills/ | wc -l
0
$ npm pack --dry-run --json | grep -c "shared/frameworks"
0
```

`BUNDLE_MANIFEST` listed only `qa_analysis` and `qa_diagnostics`, so the Playwright
trace/report analyzers — cited as the evidence for Playwright = Production and for
"trace forensics" — reached no consumer by any path.

### F5 — Invariants and validator gaps (Confirmed)

```console
$ grep -rhoE '"(if|then|allOf|anyOf|dependentRequired)"' skills/*/contracts/*.json | wc -l
0
```

`{"classification":"passed","execution":{"exitCode":1},"tests":{"failed":1}}` was a
**schema-valid** execution result. The `anyOf` implication that rejects it existed
only in `tests/evals/qa-run/hallucinated-green.case.json`.
`shared/analysis/lib/qa_analysis/contracts.py` ignored unrecognized keywords
(F5b), while `packages/installer/lib/core/schema-validate.mjs` reported them —
and the two supported different keyword sets (`format` in Python only;
`maxLength`/`maxItems` in JS only) despite the JS comment asserting "a document
that passes one passes the other" (F5c). No test compared them.

### F6 — Circular behavioral proof (Confirmed, characterization)

`run_evals.py` scores `case.output` literals committed beside the assertions that
judge them. CI's live layer runs `--provider replay` over hand-authored
`tests/evals/captures/reference/*.json` with an all-`1.0` baseline. Both gates are
sound *scorer* tests; neither has observed an agent. This is a measurement gap
requiring hosted-agent access, not a code defect — the remedy applied here is
documentation honesty, not new code.

### F7 — Overstated command capability (Confirmed)

| Doc | Claim | Skill |
| --- | --- | --- |
| `README.md` | `/qa-fix` "Repairs tests and heals locators, writing fixes to source" | "changes no code… never edits a file" |
| `README.md`, `docs/capability-matrix.md` | `/qa-review` "applies improvements on request" | "No code changes. This skill reviews; it never edits." |

Only `qa-generate` writes files. `scripts/check-capability-matrix.mjs` compares two
documents to each other and checks that each listed command has a `SKILL.md`; it
never compares a claim to skill behavior, so this drift was invisible.

### F8 — Contract coverage claim (Confirmed)

`skills/qa/` and `skills/qa-init/` have no `contracts/` directory, so the README
sentence "each … ships a machine-readable output contract" was false for two of
twelve. `qa-init`'s cited schema was also absent from the npm tarball.

### F9 — Context contract unvalidatable (Confirmed)

`skills/qa-init/templates/context.md` emits YAML frontmatter; the contract is JSON
Schema; the toolkit is standard-library-only, so no YAML parser existed and nothing
in the repository read `.qa/context.md`. CI validated a hand-written
`valid-context.json` fixture instead.

### F10 — Empty knowledge layers (Confirmed)

`shared/ci/` and `shared/stacks/` contain only a README that says "Authored in
Milestone 3"; M3–M8 are all marked **Complete** in `ROADMAP.md`.

### F11 — `npx qa` (Confirmed)

51 occurrences of `npx qa …` across the docs versus 1 correct package-qualified
form. `npx` resolves a **package** name, so the documented command fetches an
unrelated registry package named `qa`. The package also exposed no bin matching
its own name, so even `npx qa-automation-pack` could not resolve a default binary.

### F12 — `__pycache__` in the tarball (Confirmed)

```console
$ npm pack --dry-run --json | grep -c "__pycache__"
18
```

`.gitignore` lists `__pycache__/`, but a directory named in `files[]` is included
wholesale.

### F13 — Duplication (Partially true)

11 copies of `evidence-and-reporting.md` under `skills/` are **by design**: copy-based
sync with a CI drift gate ([ADR-0002](../architecture/ADR-0002-agent-skill-standard.md)),
required because a skill must be self-contained. Not a defect; not changed. The
`qa-example` observation is accurate (it installs into consumer projects with no
opt-out) but it is a deliberate, documented install self-check with
`audience: model`; it is left in place and no capability claim depends on it.

### F14 — No uninstall (Confirmed)

`packages/installer/lib/commands/` had no `uninstall.mjs`, while
`fs-safe.mjs` opens: "Every install, update, or uninstall runs through a
Transaction."

### F15 — Invented agent detection (Confirmed)

`packages/installer/lib/agents/registry.mjs:133` returned `getAgent('cursor')` as
the no-detection fallback. Installing into a directory with no agent markers wrote
a lockfile claiming `{"id":"cursor","name":"Cursor","tier":2}` as a detected agent.

### F16 — Diff guard (Confirmed)

Reproduced with `python3 -m qa_analysis.cli diff-guard`:

| Scenario | Before |
| --- | --- |
| Same assertion, stronger role-based locator + `await` | `removed-assertion` **high**, `safe:false` (false positive) |
| `expect(total).toBe(42)` → `toBeDefined()` | flagged, but as generic `removed-assertion` |
| `if (process.env.CI) { return; }` above the assertion | `safe:true` (missed) |
| `testIgnore: ['**/payment.spec.ts']` added to config | `safe:true` (missed) |
| `"test": "playwright test"` → `"playwright test \|\| true"` | `safe:true` (missed) |

`MASS_DELETION_THRESHOLD = 15` also missed small whole-file deletions, and the
`removed-wait` branch was unreachable (guarded by `not _ASSERTION` while its own
pattern matches `expect(`).

### F17 — Runtime support claims (Partially true)

The Python claim is **sound but untested**: all 31 shipped `.py` files parse under
`ast.parse(..., feature_version=(3, 8))` and use no post-3.8 stdlib API. The audit's
concern about breakage is therefore lower than rated, but nothing enforced it. The
Node claim is untested for real: CI runs Node 20 only against a stated floor of
18.18.

## Findings not acted on

- **F6** — needs hosted-agent API access to close; addressed by wording only.
- **F13** — knowledge duplication is the intended architecture (self-contained
  skills + drift gate). No change.
- **F17 (Python half)** — the claim verified as accurate; a regression gate was
  added rather than a code change.
