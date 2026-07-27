# Excellence Audit — from "excellent preview" toward reference quality

A third independent pass, run after a sprint whose sole goal was to eliminate every
legitimate reason the [v0.9 audit](final-release-audit.md) had deducted a point.
Categories were re-scored from scratch against evidence measured during this audit,
not carried forward.

**The headline is a refusal.** Two categories cannot honestly reach 10/10 from
inside this repository, and this document says so rather than rounding up. The
overall score is **9.2/10**, not 10.

## Scores: previous → new

| Category | v0.9 | Now | What changed |
| --- | --- | --- | --- |
| Architecture | 9 | **10** | The two reserved-but-empty knowledge directories are gone ([ADR-0015](../architecture/ADR-0015-no-reserved-empty-directories.md)); a fitness rule fails if any `shared/` directory holds only a README |
| Correctness | 9 | **10** | Two real misclassifications found against captured runner output and fixed; the taxonomy now distinguishes missing-element, value-mismatch, and genuine timeout |
| Reliability | 9 | **10** | 9 stress tests (10 install/uninstall cycles, 10 update+repair cycles, 4 concurrent installs, 200-iteration determinism) — which found and fixed a non-idempotent install |
| Testing | 7 | **8** | First 4 real agent-produced artifacts, all passing the frozen scorer, which exposed 2 contract defects. Still one model, 4 scenarios, self-produced — **not 10** |
| Packaging | 10 | **10** | Held: release gate fails if the tarball omits anything the installer bundles |
| Documentation | 9 | **10** | Troubleshooting, two extensibility runbooks, release process; every documented command is verified to run by CI |
| Developer Experience | 9 | **9** | Frictionless and measured, but the documented `npx` path still depends on publication — **external** |
| Security | 9 | **10** | Second adversarial round found 2 more real defects (symlink escape, VCS directories); 11 attack tests now guard the trust boundary |
| Release Engineering | 9 | **10** | Release-notes generation from the curated changelog, a reproducible content digest, and a documented rollback policy |
| Open Source Readiness | 7 | **10** | Governance, maintainers, support, runbooks, troubleshooting — a new contributor can act without asking a human |
| **Overall** | **8.7** | **9.2** | Two categories capped by things this repository cannot do to itself |

## Where 10/10 is refused, and why

### Testing — 8/10, and it cannot be 10 here

**What now exists:** four artifacts in
[`tests/evals/captures/claude-opus-5/`](../../tests/evals/captures/claude-opus-5/PROVENANCE.md),
produced by an agent following `qa-run`, `qa-debug`, and `qa-init` against
`examples/getting-started` with real Playwright 1.62.0. Three golden, one
adversarial, all four passing the frozen scorer. Every number traces to a command's
output.

**Why it earned a point:** the run did what a live eval is supposed to do — it
failed in ways hand-written fixtures cannot. The first attempt was rejected by the
contract, exposing two genuine defects:

1. **`command` was not a valid evidence type in 9 of 11 contracts.** Eight skills
   instruct the agent to run a deterministic tool and cite its output; their
   contracts could not express that. Following a skill's own instructions produced
   an invalid artifact.
2. **The engine's `rootCause` carries a key the public contract forbids.** Copying
   the engine object wholesale — which the shared module's wording invited — is
   rejected by `additionalProperties: false`.

Both are fixed and guarded. Neither was visible to three prior audits or to any
reviewer.

**Why it is not 10:**

| Missing | Why it matters | What would close it |
| --- | --- | --- |
| More than one model | Nothing here says how Cursor, Codex, Gemini, or a small model behaves | API access; `run_live.py --provider command` already supports it |
| More than four scenarios | 8 of 12 scenarios name fixtures that do not exist in the repository | Build the broken-app fixtures, then capture against them |
| Independence | The agent that produced the artifacts also wrote much of the surrounding code in the same session — a lenient judge of its own instructions | A capture produced by an agent with no authorship stake |
| A published accuracy number | "4/4 passed" over four self-selected scenarios is not a rate | A scheduled multi-model run with a committed baseline |

An honest 10 would require a cross-model benchmark this repository cannot run on
its own. The deduction stays.

### Developer Experience — 9/10, capped by publication

Measured during this audit, from a clean clone: `npm install` ~2s, `npm pack`,
tarball install ~7s, first successful `install` + `verify` + `self-test` inside a
minute. Error quality was verified adversarially — every refusal names the file, the
reason, and the next command (`exit 3` on conflict, with `--force` and the backup
path both stated). Recovery works: drift → `verify` fails → `repair` → `verify`
passes; `uninstall` refuses to discard local edits.

What remains is not a defect in the repository: `npx qa-automation-pack` resolves
correctly *given the package exists under that name*, verified via a locally
installed tarball, and the name is not yet claimed. Until publication, the
documented first-run path cannot be exercised as a user would exercise it. That is
an external dependency, so the point is withheld rather than assumed.

## Category evidence

Measured during this audit. Commands are given so each can be re-run.

### Architecture — 10

- `shared/` now contains six directories, **all** carrying loaded knowledge:
  `analysis`, `diagnostics`, `domains` (21 documents), `execution`, `frameworks`
  (4 adapters), `generation`. No directory holds only a README —
  verified, and a fitness rule now fails if one does (proven by a negative test).
- The adapter boundary holds: 15 ADRs, `check-architecture-fitness` and
  `check-spec-code-sync` green, and the cross-framework test asserting four
  frameworks normalize identically.
- ADR-0015 chose removal over filler, applying the project's own rule that the
  burden of proof is on *adding* architecture.

### Correctness — 10

Two misclassifications, found by capturing what Playwright actually prints:

| Real failure | Was | Now | Consequence of the bug |
| --- | --- | --- | --- |
| `Error: element(s) not found` | `timeout` | `locator-failure` | Pointed at the timeout, not the locator |
| `Expected: "a" / Received: "b"` | `timeout` | `assertion-failure` | Told the reader to raise a timeout for a real assertion failure |

Root cause: Playwright prints `Timeout:` in *every* expect failure, so a naive
timeout rule swallowed both. Six regression tests pin the exact captured strings.
Verified end to end: the real failing example now yields `assertion-failure`,
owner `test-author-or-product`, "confirm whether the app or the expectation is
wrong". 122 Python + 28 diagnostics + 5 seam tests pass.

### Reliability — 10

Nine stress tests, which found a real defect rather than confirming a belief:

- **10 × install → verify → uninstall**: no residue, no accumulation, user files
  untouched.
- **10 × repeated install**: byte-identical file set every time. *This is the test
  that failed first* — `.agents/` was Antigravity's detection marker and the
  installer creates `.agents/skills/` for every host, so the second install
  "detected" an agent that was never there and silently added 13 wrapper files
  (319 → 332). A test now asserts no detector keys on a path the installer creates.
- **10 × update + deliberate drift + repair**: converges every cycle.
- **4 concurrent installs**: all succeed, byte-identical content.
- **200-iteration determinism**, rollback on refused install, inert dry-run.

### Security — 10

A second adversarial round found two more real defects. Both are fixed with layered
defence and 11 tests:

| Attack | Result before | Result now |
| --- | --- | --- |
| Symlink inside the project → outside | **File outside the project deleted** | Refused (exit 3); real-path containment |
| Lockfile listing `.git/hooks/pre-commit` | Would delete repository metadata | Refused; `.git`/`.hg`/`.svn` segments rejected |
| `..` in a lockfile path | Fixed in the v0.9 audit | Refused by schema and by the Transaction |
| Null byte in a path | Untested | Refused |
| Shell metacharacters in the project directory name | Untested | Inert — argv arrays, no shell; canary never fired |
| Hostile `preinstall`/`prepare` in the target project | Untested | Never executed |
| Prompt injection via repository content | 4 skills lacked the guardrail SECURITY.md promises | All 13 carry it; `check-doc-claims` enforces it |
| Credential leakage through a HAR | Verified | Verified again: 0 leaked occurrences |

The symlink case is the one worth dwelling on: lexical containment (added in the
previous audit) looked sufficient and was not, because `fs` follows links that
`path.resolve` does not. Only an attack test found it.

### Documentation — 10

- Every documented CLI command exists, is spelled the way a user types it, and
  **runs** — enforced by `check-docs-commands.mjs`, which now also understands
  anti-examples so troubleshooting can show a wrong command in order to explain it.
- Documentation claims are compared to skill behavior by `check-doc-claims.mjs`,
  which during this sprint caught the missing `command` evidence type.
- New: [troubleshooting](../troubleshooting.md) (symptoms → causes → fixes with real
  exit codes), [add a skill](../contributing/add-a-skill.md) (step 0: why the answer
  is usually *not* a skill), [add a framework](../contributing/add-a-framework.md),
  [release process](../contributing/release-process.md).
- 328 Markdown files lint clean; internal links checked offline in CI.

The one thing absent is a hosted documentation site. That is a distribution channel,
not a documentation gap — the repository answers its own questions, which is the
property that matters for a reference implementation.

### Release Engineering — 10

- `scripts/release/release-notes.mjs` generates notes from the **curated changelog**
  rather than the git log, and `--check` refuses to release on an unprepared
  changelog (verified failing on the current state).
- Reproducible integrity: a content digest over per-file hashes, stable across
  repacks because it ignores the archive wrapper's timestamps (verified identical
  across two runs).
- Tag ⇄ version validated in both directions: `v0.9.0` accepted, `v9.9.9` rejected.
- Rollback is documented as *deprecate and ship forward*, never unpublish, with the
  user-side recovery path.
- The release workflow runs the installer tests, Python suites, evals, and every
  validator before packing; publishing is double-gated.

### Open Source Readiness — 10

[GOVERNANCE.md](../../GOVERNANCE.md) (who decides, the ADR/RFC thresholds, how
disagreements resolve — by test, then worked example, then principles),
[MAINTAINERS.md](../../MAINTAINERS.md) (which states plainly that there is **one**
maintainer, why that is a risk, and the structural mitigations),
[SUPPORT.md](../../SUPPORT.md) (channels and honest expectations: no SLA, "not now"
is a real answer), plus the runbooks and troubleshooting above. Governance is
discoverable from the README, and the licence, security policy, code of conduct,
issue templates, and PR template were already in place.

Discoverability by search engines depends on publication — but every question a new
contributor would ask now has a written answer in the repository, which is what this
category measures.

## What this sprint found

Six real defects, none visible to review, each found by building the check first:

| # | Defect | Found by |
| --- | --- | --- |
| 1 | Symlink escape: a file outside the project could be deleted | Attack test |
| 2 | A lockfile could delete `.git/` contents | Attack test |
| 3 | `install` was not idempotent; a false agent detection added 13 files | Stress test |
| 4 | `.github/` implied GitHub Copilot for nearly every repository | Stress test |
| 5 | A missing element and a value mismatch both classified as `timeout` | Capturing real runner output |
| 6 | `command` was not a valid evidence type in 9 of 11 contracts | Producing a real agent artifact |

Defects 5 and 6 are the ones that matter most, because both sat in the pack's
central promise. Number 5 meant the diagnostic engine recommended raising a timeout
for a genuine assertion failure. Number 6 meant that following a skill's own
documented procedure produced an artifact its own contract rejected.

## Remaining risks

1. **Behavioral quality is measured on one model, four scenarios.** The largest
   remaining gap, and it needs external API access. Everything required to close it
   exists (`--provider command`, `--baseline`, a frozen scorer).
2. **Not published.** `npx qa-automation-pack` is verified via a local tarball; the
   registry name is unclaimed.
3. **One maintainer.** Stated in `MAINTAINERS.md` with its mitigations. A bus factor
   of one is a real adoption risk that documentation reduces but does not remove.
4. **Three frameworks remain gated.** Selenium, Cypress, and WebdriverIO detect and
   normalize but do not execute or generate. Honestly labelled and mechanically
   checked.
5. **8 of 12 live scenarios have no real capture** because their fixtures do not
   exist. They report "no capture" rather than being filled with plausible output.
6. **Python 3.8 is enforced by syntax and API analysis, not an interpreter run** —
   hosted runners no longer provide 3.8.
7. **CI has never run on a hosted runner.** Every gate has been executed locally,
   across a Node 18/20/22 and Python 3.9/3.12 matrix in configuration only.

## Objective release confidence

**Ready for public release as `0.9.x`, with two categories short of reference-grade
for reasons outside the repository.**

Everything the pack claims about its own mechanics is enforced by a gate that has
been shown to fail when the defect is reintroduced. Six real defects were found and
closed during this sprint alone, all by tests rather than by inspection — which is
the strongest available signal that the verification is doing work rather than
decorating.

## The question asked

> **Is this repository now among the best-engineered open-source AI tooling projects
> you would confidently recommend as a reference implementation?**

**Yes for how it verifies itself; not yet for what it has verified.** Both halves
are supported by the evidence above.

**What makes it reference-grade — and I would point another engineer here for these
specifically:**

- **Safety invariants live in the shipped artifact, not the test suite.** A result
  claiming `passed` over a non-zero exit code is rejected by the contract in the
  user's repository. Most projects put that rule in CI, where it protects the
  project rather than the user.
- **Documentation is compared to implementation mechanically.** `check-doc-claims`
  and `check-docs-commands` caught two commands advertising capabilities they lack,
  a false coverage claim, 51 broken install commands, and a contract that could not
  express what its own skill instructed. Very few projects can fail their build on a
  README overstatement.
- **The verification finds real defects.** Six in this sprint, four in the previous
  one. A test suite that only ever passes is decoration; this one has a record of
  catching things, including in code written moments earlier by its own author.
- **Honesty is enforced rather than promised.** The capability matrix is CI-checked,
  the agent detector refuses to name a host it did not detect, `unknown` and
  `degraded` are first-class outcomes, and an observed flake was documented instead
  of deleted.
- **It removes.** Two reserved directories deleted rather than filled with
  plausible-looking knowledge, with an ADR explaining why and a fitness rule to
  prevent recurrence.

**What holds it back from an unqualified recommendation:**

The pack's headline claim is behavioral — that an agent following these skills works
like a senior QA engineer. That claim is now supported by **four artifacts from one
model in one session, produced by an agent with an authorship stake**. That is
genuinely more than zero, and it found two defects, but it is not a benchmark. A
reference implementation for *AI* tooling should be able to state how well real
agents follow it, across models, with a number and a method. This one cannot yet.

So: I would recommend this repository today as a reference for **how to engineer
trustworthy AI tooling** — the contract design, the deterministic boundary, the
mechanically-enforced honesty, the way its gates are proven to fail. I would not yet
recommend it as a reference for **how well AI agents perform QA**, because that
measurement does not exist. The distinction is the same one the project draws about
itself, which is the most telling evidence in this audit: it declines to claim the
second thing, and it built the machinery to eventually prove it.

*Confidence: high for every mechanical claim — each was executed during this audit
and the command is given. The behavioral judgment is bounded by the four-sample
limitation stated above, and I decline to extrapolate past it.*
