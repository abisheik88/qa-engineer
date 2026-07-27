# Deterministic Execution Boundary

This document draws the hard line between **deterministic code** (owns facts)
and the **LLM** (owns reasoning). It implements
[ENGINEERING_PRINCIPLES.md](ENGINEERING_PRINCIPLES.md) §§6–8 and is enforced by
unit tests, seam tests, eval adversarial cases, and
`scripts/check-architecture-fitness.mjs`.

**Deterministic code owns facts. The LLM must not invent them.**

## What deterministic code owns

| Fact domain | Owner | Must not be invented by the LLM |
| --- | --- | --- |
| Process exit codes, runner stdout/stderr capture | Execution tooling / agent shell | Claiming a suite passed without a tool result |
| Normalized execution result shape | Adapter + `execution-result` contract | Fabricating `tests.passed` / `executed[]` |
| File hashes, lockfile integrity | Installer (`hash.mjs`, `verify`) | Claiming verify passed without running it |
| Framework identity | Framework registry + detectors | Asserting "Playwright project" without markers |
| Parsed JUnit / HAR / trace fields | `qa_analysis` | Inventing HTTP status codes or failure messages |
| Taxonomy classification from signals | `qa_diagnostics` / `qa_analysis.taxonomy` | Relabeling a product bug as flake without evidence |
| Diff / overwrite safety | `diff_guard` | "Healing" by deleting assertions |
| Contract validity | Schema validators | Emitting a result that fails its own schema |
| Eval scores | `run_evals.py` | Marking a case PASS by editing the capture |

## What the LLM may do

- Explain *why* a deterministic finding matters
- Summarize multiple findings for a human
- Recommend next commands (`/qa-fix`, `/qa-report`)
- Rank narrative priority when scores are equal
- Choose among options the tools already enumerated
- Ask for missing evidence instead of guessing

## What the LLM must not do

- Invent execution facts (green runs, timings, artifact paths)
- Normalize raw runner JSON by hand into `execution-result` without the adapter
- Fabricate `evidence[]` entries (paths, quotes, hashes)
- Claim live non-Playwright execution/generation when the registry marks it gated
- Delete or weaken assertions to silence a failure
- Exfiltrate secrets into reports (redaction is deterministic; LLM must not undo it)

## Execution paths (reviewed)

```text
User / Agent
    │
    ├─► Shell / Playwright CLI  ──facts──► raw artifacts
    │                                         │
    ├─► qa_analysis (parse)     ──facts──► findings / evidence
    │                                         │
    ├─► qa_diagnostics          ──facts──► classification, plans
    │                                         │
    └─► Skill (LLM)             ──reason──► summary, recommendations
                                            (must cite facts above)
```

Skills (`SKILL.md`) orchestrate this pipeline. They instruct the agent to *run*
tools and *cite* outputs. Any skill step that produces a structured contract
field which could have been computed must point at a tool or refuse with
`unknown`.

## Enforcement checklist

- [ ] New skill steps that fill contract fields name the tool or mark `unknown`
- [ ] Adversarial eval cases cover pressure to invent green / drop assertions
- [ ] Internal diagnosis dicts validate against internal schemas before skills present them
- [ ] Framework capability claims resolve through `shared/frameworks/registry.json`
