# Final Release Audit

A second, independent pass over `qa-automation-pack` after the release hardening
sprint. Where the [first pass](audit-verification.md) recorded verdicts on an
external audit's findings, this one re-derives the state of the repository from
scratch: every conclusion below was produced by running something, and the
command is given so it can be re-run.

Two rules governed the sprint and this audit:

- **Evidence wins.** A finding was fixed only if it reproduced. Two did not
  reproduce as defects and were deliberately left alone — knowledge duplication
  into skills (the intended copy-sync architecture) and the Python 3.8 floor
  (verified accurate, so gated rather than changed). Both are recorded in the
  [first pass](audit-verification.md#findings-not-acted-on).
- **Every fix ships with a gate.** A fix that only changes today's bytes is not a
  fix; each one is held in place by a test or a CI check, and each of those gates
  was adversarially verified by reintroducing the defect (see
  [Do the gates work?](#do-the-gates-work)).

## Verdict

| Dimension | Before | After | Basis |
| --- | --- | --- | --- |
| Deterministic core reachable from skills | **Broken** | **Working** | The bundled engine raised `FileNotFoundError` on every diagnosis; it now runs, and 8 skills carry concrete invocations |
| Contract enforcement of safety invariants | **Absent at runtime** | **Enforced** | `passed` + exit code 1 was schema-valid; now rejected by the shipped contract |
| Packaging correctness | **Broken** | **Correct** | Published CLI reported `0.0.0`; framework analyzers absent from the tarball |
| Documentation ⇄ implementation | **Drifted** | **Consistent, gated** | Two commands advertised write capability they do not have |
| Installer lifecycle | **Incomplete** | **Complete** | No uninstall existed despite being documented in code comments |
| Diff guard signal quality | **Noisy and porous** | **Sharp** | Flagged real repairs `high`; missed three standard fake-green techniques |
| Behavioral proof against real agents | **Not measured** | **Still not measured** | Unchanged and unchangeable here — needs hosted-agent access |

**Release confidence: high for a `0.9.x` preview; not yet 1.0.**

Everything the pack claims about its *own* mechanics is now either enforced or
labelled. What remains before 1.0 is not architecture and not correctness — it is
one measurement the repository cannot perform on its own (a real agent's accuracy)
and one decision that is the maintainers' to make (publishing under a confirmed
identity). Those are stated plainly in [Remaining](#remaining-open) rather than
worked around.

## What the second pass verified

Run from the repository root. All results below are from the current tree.

```console
$ git rev-list --count HEAD                       # was: "no commits yet"
1
$ python3 shared/analysis/lib/run_tests.py        # was: 47
Ran 116 tests — OK
$ PYTHONPATH=shared/analysis/lib:shared/diagnostics/lib \
    python3 -m unittest discover -s shared/diagnostics/lib/tests
Ran 28 tests — OK
$ PYTHONPATH=shared/analysis/lib:shared/diagnostics/lib \
    python3 -m unittest discover -s tests/seams
Ran 5 tests — OK
$ npm test                                        # was: 14
tests 30 — pass 30 — fail 0
$ python3 tests/evals/run_evals.py
21/21 cases passed (7 golden, 14 adversarial)
$ python3 tests/evals/run_live.py --baseline tests/evals/baselines/reference.json
12/12 scenarios passed — no regressions vs baseline
$ python3 scripts/check-python-floor.py
python floor OK: 37 file(s) parse under 3.8 with no post-floor stdlib APIs
$ python3 scripts/bundle_python.py --check
ok (8 skills bundle **and run** their tooling)
$ node scripts/release/validate-release.mjs
release validation OK (qa-automation-pack@0.9.0)
```

Eleven Node validators pass (`validate:skills`, `sync`, `keywords`, `knowledge`,
`matrix`, `registry`, `architecture`, `spec-sync`, `doc-claims`, `docs-commands`,
`release`), as do `markdownlint-cli2` (319 files) and `editorconfig-checker`.

### The lifecycle, from the real published artifact

Not simulated from the checkout — built with `npm pack`, installed from the
tarball, and driven through `npx`:

```console
$ npx qa-automation-pack --version
0.9.0                                    # was: 0.0.0
$ npx qa-automation-pack install --yes --project .
$ npx qa-automation-pack verify --project .      # PASS
$ npx qa-automation-pack self-test --project .   # PASS (engine check is hard-fail)
$ PYTHONPATH=.agents/skills/qa-debug/scripts/lib python3 -c "..."
classification: locator-failure          # the bundled engine runs in a consumer repo
$ npx qa-automation-pack uninstall --project .   # 322 files removed, 99 dirs pruned
```

## Findings resolved

Each row names the gate that now holds the fix. "Was" describes the state at
audit time.

| # | Finding | Resolution | Gate |
| --- | --- | --- | --- |
| F1 | No commits; CI/release workflows had never run | First commit created (538 files); release workflow simulated step-for-step; version/tag consistency verified in both the matching and mismatching case | `validate-release` (tag ⇄ version) |
| F2 | Bundled engines had no invocation contract | `qa_diagnostics.cli` added (`diagnose`/`plan-repairs`/`summarize`/`report`), inputs and outputs held to the seam contracts; one shared invocation recipe synced into all 8 bundling skills | `check-doc-claims` requires a concrete `PYTHONPATH=… python3 -m` per bundling skill |
| F3 | `qa-run` asked the model to normalize reporter output | Step 9 now runs the bundled normalizer and copies its numbers verbatim; `qa-run` bundles `qa_analysis` + `playwright_analysis` | Contract invariants reject a result whose claim and numbers disagree |
| F4 | Framework analyzers unreachable and unpackaged | Playwright analyzers bundled into `qa-run`/`qa-debug` with their own CLI; all four adapters ship in the tarball | `validate-release` fails if the tarball omits anything the installer bundles |
| F5a | Safety invariants lived only in eval fixtures | `allOf`+`if`/`then` invariants added to three contracts | `test_parity.py` invariant suite; `check-spec-code-sync` requires each to carry a title |
| F5b | Python validator silently ignored unknown keywords | Unsupported keywords are now errors | Parity corpus case + `check-spec-code-sync` |
| F5c | The twin validators diverged despite claiming parity | Same subset, same RFC 3339 rule, both directions tested | 44-case corpus run by **both**; keyword sets compared byte-for-byte |
| F7 | README/matrix advertised write capability two skills lack | Corrected; README now states plainly that only `/qa-generate` writes to source | `check-doc-claims` |
| F8 | "All twelve ship a contract" was false for two | Corrected to ten, naming why the other two differ | `check-doc-claims` |
| F9 | `.qa/context.md` could not be validated | Deterministic frontmatter parser + `qa_analysis.cli context`; `qa-init` validates what it writes | 24 parser tests; CI validates a real file **and** asserts the placeholder template is rejected |
| F10 | Two knowledge dirs empty under "Complete" milestones | Both marked *not authored* in place, in `shared/README.md`, in the capability matrix, and as open M3 scope in the roadmap | — (documentation state) |
| F11 | `npx qa` fetched an unrelated package | 51 occurrences corrected; a name-matching bin added so the documented form resolves | `check-docs-commands` |
| F12 | Tarball shipped 18 `__pycache__` artifacts | Excluded; test files excluded too | `validate-release` |
| F14 | No uninstall despite being documented in code | `qa uninstall` added: lockfile-scoped, backed up, drift-refusing, byproduct-cleaning, directory-pruning | 8 uninstall tests incl. a full round trip |
| F15 | Detection invented "Cursor" when nothing was found | Reports `Unknown agent (shared Agent Skills path)`; the lockfile records whether each host was truly detected | Lock schema carries `detected`; install path asserted |
| F16 | Diff guard flagged real repairs, missed fake-green | Strength-based assertion comparison; six new detectors; dead rule fixed | 10 committed diff fixtures, 18 diff-guard tests |
| F17 | Stated runtime floors untested | Python 3.9 + 3.12 matrix with a 3.8 syntax/API gate; Node 18 + 20 + 22 matrix | `check-python-floor.py`; CI matrices |

### Defects found during the sprint that the original audit missed

Two, both found by writing the gate before trusting the code:

1. **The bundled diagnostic engine could not run at all.** `engine.diagnose()`
   validates every diagnosis against internal schemas that were never bundled, so
   it raised `FileNotFoundError` in every installed project. CI missed it because
   `bundle_python.py --check` only *imported* the packages. `--check` now
   executes the engine and its CLI from a temporary bundle.
2. **The published CLI reported version `0.0.0`** — and wrote it into every
   lockfile — because `packages/installer/package.json` was outside the npm
   `files` allowlist. Invisible from a checkout; visible immediately from the
   tarball.

A third, smaller one: `qa_diagnostics`' documented input validation was not
actually wired (the CLI test caught it), and `editorconfig-checker` failed on a
tab-indented workspace file, which would have broken the first CI run.

## Do the gates work?

A gate that cannot fail proves nothing, so each was tested by reintroducing the
defect and confirming a non-zero exit, then restoring with `git checkout`.

| Reintroduced defect | Gate | Result |
| --- | --- | --- |
| `/qa-review` described as applying improvements | `check-doc-claims` | ✅ exit 1, names the contradicting SKILL.md |
| Hallucinated-green invariant removed from the contract | `test_parity.py` | ✅ 2 failures |
| `uniqueItems` added to one validator only | `check-spec-code-sync` | ✅ exit 1; parity test: 5 failures |
| Internal schemas dropped from the bundle | `bundle_python.py --check` | ✅ exit 1 on the 5 engine-bundling skills |
| `shared/frameworks` removed from `files[]` | `validate-release` | ✅ exit 1, names the omitted module |
| All `uninstall` documentation removed | `check-docs-commands` | ✅ exit 1 |

One honest limitation surfaced by this exercise: `check-docs-commands` verifies a
command is documented *somewhere* and runs — deleting one of two mentions does not
fail it. That is the intended scope, not a silent gap.

## Deterministic boundary: still intact

The sprint's central risk was eroding the boundary in
[deterministic-execution-boundary.md](../architecture/deterministic-execution-boundary.md)
while making tools easier to reach. It moved the other way:

- Facts the LLM previously produced by hand — normalized counts, per-test
  outcomes, the release verdict, the context profile — now come from tools with
  documented commands and validated shapes.
- No skill gained an ability; `qa-run`, `qa-init`, `qa-fix`, `qa-report`,
  `qa-flaky`, `qa-api`, `qa-audit`, and `qa-debug` do exactly what they did, with
  the deterministic step actually invocable.
- The `qa-fix` boundary hardened: a `fail` diff-guard verdict can no longer
  coexist with a `repairable` disposition, because the contract rejects it.
- No new framework, provider, capability, or abstraction was introduced. The one
  new module (`qa_analysis.context`) closes a contract that already existed;
  the one new command (`uninstall`) completes a lifecycle already described in
  the code.

`check-architecture-fitness` and `check-spec-code-sync` pass unchanged.

## Remaining open

Stated as gaps, not risks-with-mitigations, because none of them is closed:

1. **No real agent has been measured.** Both eval layers score committed JSON:
   `run_evals.py` scores hand-authored case outputs, and the CI "live" layer
   replays hand-authored captures with an all-`1.0` baseline. This is a working
   scorer and harness with **zero** real samples. Closing it needs hosted-agent
   API access and `run_live.py --provider command`; nothing in this repository can
   substitute. Treat published accuracy claims as unavailable until then.
2. **Not published, and identity unconfirmed.** `npx qa-automation-pack` now
   resolves correctly *given* the package exists under that name; the name is not
   claimed and nothing is on npm. Publishing is a maintainer decision. No tag was
   created here for the same reason — tag/version consistency was verified by
   simulation instead.
3. **Three frameworks remain gated.** Selenium, Cypress, and WebdriverIO detect
   and normalize but do not execute or generate. The labelling is honest and
   mechanically checked; the gate has not flipped.
4. **`shared/ci/` and `shared/stacks/` are unauthored.** Now labelled everywhere
   they are referenced, and recorded as open M3 scope.
5. **Python 3.8 is not executed in CI.** Hosted runners no longer provide it. The
   floor is enforced by parsing every module at `feature_version=(3, 8)` and
   grepping for post-3.8 stdlib APIs — real coverage, but not a test run.
6. **Agent activation accuracy is unproven.** Twelve keyword-rich descriptions
   compete for context; nothing tests that the right skill activates.
7. **The runnable example is not exercised in CI** (browser download cost), so it
   can rot silently.

## Release gate status

| Item | Class | Status |
| --- | --- | --- |
| Deterministic eval harness gating CI | Critical | ✅ |
| Live-agent runner + regression gate in CI | Critical | ✅ (replay provider) |
| Bundled deterministic tooling runs in a consumer project | Critical | ✅ new |
| Safety invariants enforced by shipped contracts | Critical | ✅ new |
| Tarball carries everything the installer bundles | Critical | ✅ new |
| Documentation claims match implementation, mechanically | Critical | ✅ new |
| Published under a confirmed repo/npm identity | Critical | ❌ open (2) |
| Published accuracy + cross-model drift vs real agents | Required | ❌ open (1) |
| Installer `update`/`uninstall` | Required | ✅ |
| CI runtime matrix matches stated support | Required | ✅ |
| Every "live/Production" claim backed or relabelled | Critical | ✅ |
| `GOVERNANCE.md`, `MAINTAINERS.md`, `SUPPORT.md` | Required | ❌ open |
| "Add a framework" / "add a skill" runbooks | Required | ❌ open |
| Agent-activation smoke for Tier-1 agents | Recommended | ❌ open (6) |
| Nightly run of the runnable example | Recommended | ❌ open (7) |

Two Critical items remain, both non-engineering: publish under a real identity,
and measure a real agent. A `0.9.x` preview is defensible today on the strength of
the evidence above; 1.0 is not, and this document does not claim otherwise.

*Confidence: high for every mechanical claim (each was executed, and the command
is shown). The behavioral question — how well a real agent follows these skills —
remains unmeasured, and no amount of repository work answers it.*
