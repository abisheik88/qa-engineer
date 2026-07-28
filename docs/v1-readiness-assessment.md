# v1.0 Readiness Assessment

A point-in-time architectural review of QA Automation Pack `0.9.0`, evaluating it
against one bar: **could this become the reference implementation for AI-powered
QA engineering?** It is a maintainer's assessment, not a capability claim — the
authoritative capability record is the [capability matrix](capability-matrix.md),
and the shipping-readiness record is [release-readiness.md](release-readiness.md).

Written from the perspective of a principal architect / open-source maintainer.
The governing rule of this review is the project's own: **the burden of proof is
now on adding architecture.** Almost every recommendation below is to *finish*,
*prove*, *publish*, or *simplify* — not to build.

> **Update (release-engineering pass).** Since this review was first written, the
> **deterministic behavioral eval harness** ([`tests/evals/run_evals.py`](../tests/evals/run_evals.py))
> has been built and made **mandatory in CI**: golden cases assert correct
> behavior and adversarial cases prove the scorer rejects the pack's headline
> failure modes (a run reported `passed` with a non-zero exit code; a "fix" that
> removes an assertion; a report that says `ready` with failing tests). R1 is now
> largely closed. Grades and risks below are annotated where this changed them.
>
> **Update 2 (Milestone 11).** The **live-agent layer** is now built too
> ([`tests/evals/run_live.py`](../tests/evals/run_live.py)): a provider-agnostic
> runner (`replay` for CI/reproducibility, `command` for any real agent CLI), a
> scenarios dataset (golden + temptation), a committed baseline, and **regression
> detection** — all gating CI via the replay provider. R1b is now largely closed;
> what remains is *executing* it against paid hosted agents (API access) to
> publish an accuracy number and cross-model drift — an operational step, not a
> code gap.

---

## Executive assessment

| Dimension | Grade | One-line justification |
| --- | --- | --- |
| Architecture maturity | **A−** | Layers, seams, and the adapter boundary are coherent and proven across 4 frameworks; little is likely to churn. |
| Engineering quality | **A−** | Deterministic-first, contract-gated, single-sourced, tested Python core, honest matrix — unusually disciplined. |
| Maintainability | **A** | Single-source knowledge + sync drift gate, small fixed surface, no runtime deps, 13 crisp ADRs. |
| Scalability (intended axes) | **A−** | Scales on domains and frameworks by design; deliberately *capped* on skills (a strength, not a limit). |
| Community readiness | **C+** | Excellent templates and contributor docs; missing governance/maintainers/support, an "add a framework" runbook, and a runnable eval harness contributors can use. |
| Behavioral / product readiness | **C** (was D) | Deterministic behavioral gate now in CI (golden + adversarial, catches hallucinated-green); live-agent accuracy measurement still pending. |
| Distribution readiness | **D** | Not published; repository/npm identity unconfirmed; installer has no upgrade path. |
| **Overall (v1.0)** | **Not ready** | World-class *scaffold*; the *proof* and *distribution* are missing. A `0.9.x` preview is defensible today; 1.0 is not. |

**Headline:** This is one of the best-architected AI-skill repositories you will
find — honest, deterministic, and disciplined. A *reference implementation* must
be demonstrably correct; the **deterministic** half of that proof now exists (an
eval gate in CI that rejects hallucinated-green and unsafe outputs), and the
remaining half — **measuring what a real agent produces** — is a finishing
problem, not an architecture one. Everything left is finishing work.

---

## Top 20 strengths (strongest engineering decisions)

1. **Standard-native skills, zero transform** ([ADR-0002](architecture/ADR-0002-agent-skill-standard.md)). Source == runtime artifact; no compiler, no drift. Removes an entire class of build/version bugs and contributor friction.
2. **Deterministic-first** ([ADR-0009](architecture/ADR-0009-analysis-platform.md)). Anything parseable is parsed by tested code, not model guesswork. This is the foundation of trust.
3. **Evidence-or-it-didn't-happen output contracts.** Every workflow skill ends in a schema-validated artifact. This is the concrete, testable answer to "hallucinated green" — the industry's #1 AI-QA failure.
4. **The diff guard.** Deterministic detection of unsafe "fixes" (removed assertions, added skips, inflated timeouts). It attacks the exact way agents fake success. Few competitors have anything like it.
5. **Single-sourced knowledge with copy-sync + CI drift gate.** One source of truth per concept, materialized into skills, drift-failed in CI. Eliminates the prompt-duplication rot that kills prompt libraries.
6. **Permanent adapter boundary** ([ADR-0013](architecture/ADR-0013-framework-boundary.md)), proven by a cross-framework test asserting four frameworks produce identical contracts. The extensibility claim is *tested*, not asserted.
7. **Small, fixed command surface (12) with a hard description budget.** Context is treated as a finite shared resource; growth requires an RFC. This is the discipline most skill packs lack.
8. **One diagnostic engine, three skills** ([ADR-0011](architecture/ADR-0011-diagnostic-platform.md)). Reasoning lives once; skills differ only in presentation. Low duplication, high coherence.
9. **Standard-library-only Python, zero runtime deps.** Runs on any 3.8+ interpreter; near-zero supply-chain surface. A gift to security-conscious adopters.
10. **Honest, CI-enforced capability matrix.** Truth is an *engineering property* here, checked by `check-capability-matrix`. Rare and trust-building.
11. **Security by default** ([SECURITY.md](../SECURITY.md)). No install-time code execution, redaction by default, artifacts-as-untrusted-data. The right posture for a tool that ingests CI output.
12. **Installer integrity model.** Copy + per-file-hash lockfile; refuses to overwrite un-owned files; zero runtime deps. Safe to vendor and verify in CI.
13. **ADR discipline.** 13 distinct, well-scoped decision records — the rationale is reviewable, which is exactly what a reference implementation needs.
14. **Contract versioning policy** ([ADR-0003](architecture/ADR-0003-versioning-strategy.md)). Additive-only within a major; field removal is breaking. The public API has rules.
15. **Normalized execution result as the execution↔analysis seam** ([ADR-0007](architecture/ADR-0007-normalized-result.md)). Nothing downstream branches on framework — the reason adapters stay thin.
16. **Project understood once** ([ADR-0004](architecture/ADR-0004-project-context.md)). `.qa/context.md` written by `qa-init`, read by all — no repeated detection, no divergent assumptions.
17. **Mandated execution lifecycle** ([ADR-0005](architecture/ADR-0005-execution-lifecycle.md)). Every execution skill accounts for the same phases and never skips evidence — predictable behavior across skills.
18. **Knowledge base as one doc per domain with force-labeled claims + lint** ([ADR-0012](architecture/ADR-0012-knowledge-base.md)). Every claim is tagged (best-practice/anti-pattern/trade-off); structure is enforced.
19. **A runnable, contract-validated example.** `examples/getting-started` actually runs (2 tests pass) and its documented output validates against the real contract — verification, not narration.
20. **CI breadth.** Twelve checks across lint, editorconfig, links, skill spec, sync drift, knowledge lint, matrix consistency, Python tests, bundle self-containment, installer smoke, **the deterministic behavioral eval gate**, and structure. The scaffold — and now the headline behavior — are guarded.

---

## Top 20 risks (evidence · impact · likelihood · mitigation · priority)

**R1 — Behavioral evals were entirely unbuilt. → Largely mitigated.**
*Original evidence:* `tests/evals/` was nine README stubs; no runner, fixtures, or cases. *Now:* the deterministic scorer ([`run_evals.py`](../tests/evals/run_evals.py)) runs in CI with golden + adversarial cases for the six core skills, and the adversarial cases prove it rejects hallucinated-green and unsafe outputs. *Remaining:* the live-agent layer (measuring what a real agent *produces*) — tracked as R1b. *Priority:* **Closed** for the deterministic gate; **Critical** for the live layer (R1b). *Confidence:* high.

**R1b — Live-agent measurement: runner built; real-agent runs are operational. → Largely mitigated (M11).**
*Evidence:* [`run_live.py`](../tests/evals/run_live.py) runs scenarios through a provider (`replay`/`command`) into the frozen scorer, with a committed baseline and regression gate, all in CI via replay. *Remaining:* running the `command` provider against *paid hosted agents* to publish an accuracy number. *Impact:* the end-to-end number isn't published yet. *Likelihood of harm:* low (the mechanism exists and the deterministic + replay gates catch the worst failures). *Mitigation:* schedule real-agent runs with API access. *Priority:* **Required for a published-benchmark 1.0** (not blocking a preview). *Confidence:* high.

**R2 — Model drift: mechanism now in place.**
*Evidence:* skills are prompts; behavior depends on the agent/model. *Now:* the deterministic gate rejects drifted-bad outputs, and `run_live.py` supports **cross-model drift** directly — baseline one model, run another with `--baseline` and any regression is reported. *Remaining:* run it on real models on a schedule. *Impact:* silent quality regression across models. *Likelihood:* low-medium (down from high). *Mitigation:* scheduled cross-model runs on model bumps. *Priority:* **Medium.** *Confidence:* high.

**R3 — Distribution identity unconfirmed / not published.**
*Evidence:* `package.json` points at `github.com/qa-engineer/qa-engineer`; no tag, no npm publish; `npx qa-engineer` would fail. *Impact:* dead badges/links and broken install for "thousands of developers." *Likelihood:* certain if released as-is. *Mitigation:* confirm the org/repo is claimed, publish with provenance, or fix all URLs. *Priority:* **Critical.** *Confidence:* high.

**R4 — Framework claims outrun reality.**
*Evidence:* only Playwright runs live; Selenium/Cypress/WebdriverIO are Beta (gated), and the gate has been "the sole remaining step" across milestones. *Impact:* "multi-framework" reads as done but three of four don't execute; trust erodes if the gate never flips. *Likelihood:* medium-high. *Mitigation:* flip one framework to live *or* keep the honest Beta labelling and set an explicit criterion. *Priority:* **High.** *Confidence:* high.

**R5 — Auto-activation accuracy is unproven.**
*Evidence:* 12 keyword-rich descriptions (budget 3926/6000) compete in agent context; no test that the right skill activates. *Impact:* the primary invocation channel may misroute; users blame the pack. *Likelihood:* medium. *Mitigation:* activation cases in the eval harness for the top agents. *Priority:* **High.** *Confidence:* medium.

**R6 — Contributor quality bar: now partial.**
*Evidence:* contributors can now run `npm run validate:evals` and CI gates on it, so a change that breaks a golden case or lets an adversarial output through fails. *Remaining:* make "every new/changed skill ships with eval cases" an explicit, documented merge requirement (the gate exists; the *policy* is not yet written down). *Impact:* quality decay as contributions arrive. *Likelihood:* medium (down from high). *Mitigation:* add the policy to the contribution guide + a "skill author guide" (Priority 5). *Priority:* **Medium.** *Confidence:* high.

**R7 — Contracts are the public API but untested by real consumers.**
*Evidence:* contracts are versioned but no external tool consumes them yet. *Impact:* v1 lock-in of a shape that hasn't met reality; expensive to change post-1.0. *Likelihood:* medium. *Mitigation:* one reference consumer (a CI reporter or dashboard) before freezing at 1.0. *Priority:* **High.** *Confidence:* medium.

**R8 — Governance, maintainers, and support are undocumented.**
*Evidence:* no `GOVERNANCE.md`, `MAINTAINERS.md`, or `SUPPORT.md` (only CODEOWNERS + FUNDING). *Impact:* the community can't tell who decides, who maintains, or what support to expect. *Likelihood:* certain at scale. *Mitigation:* add the three files (cheap). *Priority:* **Medium.** *Confidence:* high.

**R9 — The marquee extensibility path has no runbook.**
*Evidence:* "add a framework" / "add a skill" exist only as ADR prose + `shared/frameworks/README.md`; no step-by-step guide. *Impact:* the thing contributors most want to do is undocumented; the 30-minute productivity bar fails. *Likelihood:* high. *Mitigation:* two short runbooks driven by the existing template + adapter contract. *Priority:* **Medium.** *Confidence:* high.

**R10 — Installer has no upgrade/uninstall path.**
*Evidence:* CLI is install/verify/doctor only; upgrades are `install --force`; uninstall is manual. *Impact:* consumer repos drift; upgrades feel unsafe. *Likelihood:* medium. *Mitigation:* `update` + `uninstall` (uninstall = remove lockfile-listed paths; small, bounded). *Priority:* **Medium.** *Confidence:* high.

**R11 — Generated wrapper formats are partly unverified.**
*Evidence:* four wrapper formats exist; overview flags Antigravity workflow path as unverified. *Impact:* a generated wrapper may be wrong for some agents. *Likelihood:* low-medium. *Mitigation:* snapshot + one real-agent smoke per format, or mark unverified formats explicitly. *Priority:* **Medium.** *Confidence:* medium.

**R12 — Dependence on a living, unversioned spec.**
*Evidence:* skills target the Agent Skills spec, which has no formal releases; `SPEC_REVISION` records the revision. *Impact:* upstream churn could invalidate skills. *Likelihood:* low-medium. *Mitigation:* the recorded revision + a CI check when the spec changes; already partially mitigated. *Priority:* **Medium.** *Confidence:* medium.

**R13 — Analysis depth is advertised broadly but shallow off-Playwright.**
*Evidence:* trace forensics are Playwright-only; the others normalize via JUnit. *Impact:* users expect Playwright-grade diagnosis everywhere. *Likelihood:* medium. *Mitigation:* the matrix now says this; keep it prominent in skill output ("shallow analysis: non-Playwright"). *Priority:* **Medium.** *Confidence:* high.

**R14 — Stated runtime support is under-tested.**
*Evidence:* "Python 3.8+" but CI runs 3.12 only; "Node >=18.18" but installer job runs Node 20 only. *Impact:* breakage on the low end of supported ranges. *Likelihood:* medium. *Mitigation:* a small CI matrix (Python 3.8+3.12; Node 18+20+22). *Priority:* **Medium.** *Confidence:* high.

**R15 — No end-to-end "install → activate in a real agent" test.**
*Evidence:* the installer copies files and verifies hashes, but activation inside an actual agent is untested. *Impact:* "installs everywhere" is unproven where it matters. *Likelihood:* medium. *Mitigation:* one headless activation smoke per Tier-1 agent (ties to R1). *Priority:* **Medium.** *Confidence:* medium.

**R16 — Monorepo single-release-unit couples independent lifecycles.**
*Evidence:* one version (`0.9.0`) spans skills, installer, and contracts ([ADR-0001](architecture/ADR-0001-repository-structure.md)). *Impact:* an installer patch forces a version bump on skills and vice-versa; awkward as they diverge in cadence. *Likelihood:* low-medium. *Mitigation:* keep single-version for 1.0 (simplicity wins now); revisit only if cadences genuinely diverge. *Priority:* **Low-Medium.** *Confidence:* medium.

**R17 — Documentation surface is large and self-referential.**
*Evidence:* 300+ Markdown files with dense cross-links. *Impact:* consistency burden grows; drift creeps back. *Likelihood:* medium. *Mitigation:* the CI link/lint/matrix gates already fight this; resist adding more docs, prefer consolidation. *Priority:* **Low-Medium.** *Confidence:* medium.

**R18 — The runnable example can rot silently.**
*Evidence:* pins `@playwright/test ^1.58`; not run in CI (browser download cost). *Impact:* the flagship "it really runs" example could break unnoticed. *Likelihood:* low-medium over time. *Mitigation:* a nightly/optional CI job that runs it. *Priority:* **Low-Medium.** *Confidence:* high.

**R19 — Tier claims remain aspirational.**
*Evidence:* no agent has passed a CI eval (harness absent); tiers are labelled planned. *Impact:* readers may still over-read "Tier 1." *Likelihood:* low (now labelled). *Mitigation:* keep the "planned/aspirational" framing until R1 lands. *Priority:* **Low.** *Confidence:* high.

**R20 — Reserved-structure placeholders read as completeness.**
*Evidence:* `tests/evals/*` are placeholder READMEs describing future work. *Impact:* a casual reader may assume evals exist. *Likelihood:* low. *Mitigation:* a one-line "NOT YET IMPLEMENTED" banner atop each eval stub. *Priority:* **Low.** *Confidence:* high.

---

## Simplification opportunities (per the "prefer removing" rule)

- **Keep the 12-skill cap.** Do *not* grow the surface; it is a feature. (No change — reaffirm.)
- **Do not add release-train tooling for the monorepo yet** (R16). Single version is simpler and correct at this scale.
- **Consider trimming premature eval sub-structure** (`tests/evals/contracts|expected|fixtures` empty dirs) until the harness exists, or clearly banner them (R20) — avoid signalling depth that isn't there.
- **Resist new ADRs.** 13 is healthy; new decisions should reuse or supersede, not accumulate.
- **No new abstraction is warranted by this review.** The gaps are *unfinished* work, not *missing* architecture.

---

## Release roadmap (only what's required)

### v0.9 — Preview (weeks)

- Confirm/claim the repository + npm identity; publish a preview build (R3).
- Add `GOVERNANCE.md`, `MAINTAINERS.md`, `SUPPORT.md` (R8).
- Write the "add a framework" and "add a skill" runbooks (R9).
- Ship the **first slice of evals**: the contract-validity gate runner + a handful of golden cases for `qa-run`/`qa-debug` (R1, minimum viable).
- Banner the eval stubs as not-yet-implemented (R20).

### v0.95 — Release Candidate

- Implement the eval harness for the core skills on seeded broken-app fixtures, deterministic gates first (R1, R6).
- Add activation smoke cases for Tier-1 agents (R5, R15).
- Decide the Beta frameworks: flip at least one to live, or freeze the honest labelling with an explicit promotion criterion (R4).
- Add `update`/`uninstall` to the installer (R10).
- CI runtime matrix: Python 3.8+3.12, Node 18+20+22 (R14). Nightly example run (R18).

### v1.0 — Stable

- **Behavioral eval gate is mandatory in CI** and detects regression (R1, R2, R6).
- One reference contract consumer exists; contracts frozen for 1.0 (R7).
- Every "live/Production" framework claim is backed by a passing behavioral eval, or relabelled (R4).
- Verified wrapper formats only; unverified ones marked (R11).
- Documentation site + versioned release with provenance.

---

## Five-year outlook

**Will age well:** standard-native skills, the deterministic analysis core, output
contracts, the adapter boundary, single-sourced knowledge, and the security
posture. These are the load-bearing decisions and they are sound.

**Will become debt if unmanaged:** the dependence on a living upstream spec
(R12); the per-agent wrapper matrix (grows with the ecosystem); the
single-version monorepo *if* skill/installer/contract cadences diverge (R16); and
documentation volume (R17).

**Should never change:** output-contract field *semantics* (the public API); the
"deterministic gates, judgment advisory" principle; the adapter boundary; and
"evidence or it didn't happen."

**Should stay experimental (deliberately):** `qa-explore` (live/broad),
non-Playwright generation, and judge-model scoring. Resist promoting these
without behavioral evidence.

---

## Release gate

A v1.0 release **fails** if any **Critical** item remains open.

| Item | Class |
| --- | --- |
| Deterministic behavioral eval harness gating CI for core skills | **Critical — ✅ done** |
| Live-agent eval runner (provider-agnostic) + regression gate in CI | **Critical — ✅ done** |
| Published accuracy + cross-model drift against real hosted agents | **Required (operational; needs API access)** |
| Published under a confirmed repo/npm identity (no placeholder URLs); `npx` path works | **Critical** |
| Every "live/Production" framework/skill claim backed by a passing eval, or relabelled | **Critical** |
| Contract stability statement; no known breaking contract change pending | **Critical** |
| `GOVERNANCE.md`, `MAINTAINERS.md`, `SUPPORT.md` present | Required |
| "Add a framework" and "add a skill" runbooks | Required |
| Installer `update`/`uninstall`, or a documented supported upgrade path | Required |
| CI runtime matrix matches stated support (Python 3.8+, Node 18+) | Required |
| Agent-activation smoke for Tier-1 agents | Recommended |
| Judge-model advisory scoring in evals | Recommended |
| Nightly run of the runnable example | Recommended |
| Documentation site | Optional |
| Additional frameworks promoted to live | Optional |

---

## Final verdict

> **If this repository were published today, what would prevent it from becoming
> the reference implementation for AI QA engineering?**

**It has not yet *measured* that a real agent behaves correctly end to end.** The
architecture, contracts, honesty, and determinism are reference-grade — genuinely
among the best in this space. The behavioral proof layer is no longer empty: a
deterministic eval gate now runs in CI and, crucially, proves the scorer rejects
the pack's headline failure modes (hallucinated-green, silent assertion removal,
ready-with-failures). What remains for a *measured*-quality claim is the
live-agent layer that runs a real agent against fixtures and scores what it
produces — plus making the framework claims live and publishing under a real
identity. None of these are architecture problems — they are *finishing*
problems, which is the good kind to have.

The remaining gaps are now: **(1) run the live-agent eval against real hosted
agents and publish the accuracy + cross-model drift** (the runner, datasets,
baseline, and regression gate all exist — this is an operational step needing API
access), **(2) make the framework claims true or relabel them**, and **(3) publish
under a real identity.** Both eval layers — deterministic and live — now gate CI,
so the behavioral-proof gap that dominated this review is structurally closed; what
is left is execution and distribution, not architecture. This is materially closer
to the reference implementation than at first review.

*Confidence in this assessment: high for structural/evidence claims (verified
against the tree and CI), medium for adoption/behavioral predictions (inherently
uncertain).*
