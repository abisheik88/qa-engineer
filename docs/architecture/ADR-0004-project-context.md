# ADR-0004: Project understanding is captured once by qa-init and read by every skill

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

Nearly every QA task depends on the same facts about a repository: its language, test framework, package manager, CI provider, and folder conventions. These facts are expensive to determine (reading config files, inspecting the dependency tree, recognizing conventions) and they rarely change between one command and the next.

If each skill determines them independently, three problems follow. The work is repeated on every invocation, wasting the agent's context and the user's time. The skills can disagree — one infers Playwright from a config file, another infers Cypress from a stray dependency — producing incoherent behavior across a single session. And detection logic gets copied into every skill, violating principle 4 ([shared knowledge over duplicated prompts](../engineering-principles.md)).

## Decision

Repository understanding is a distinct responsibility owned by one skill, [qa-init](../../skills/qa-init/README.md), which records its findings in a persistent file, [`.qa/context.md`](context-contract.md). Every other skill reads that file as the first step of its procedure and treats it as the authoritative profile of the project.

The rules that make this hold:

- **One writer.** `qa-init` is the only skill that writes `.qa/context.md`. All other skills are readers.
- **Read first, never guess.** A skill's first procedural step is to read the context file. If it is absent, the skill stops and recommends `qa-init` rather than re-deriving the stack — a wrong guess is worse than an honest halt.
- **Structured facts, human judgment.** The file carries machine-readable YAML frontmatter (facts) and a Markdown body (team narrative), specified in the [context contract](context-contract.md). Facts come from detection; the body captures what detection cannot infer.
- **Regeneration preserves human edits.** Re-running `qa-init` refreshes the detected content but preserves the human-authored body sections. This is a binding obligation on every implementation of `qa-init`.
- **Committed, shared state.** Teams commit `.qa/context.md` so every developer and CI run shares one profile.

## Alternatives considered

- **Each skill detects independently, no shared file.** Rejected: repeats expensive work every invocation, and lets skills reach conflicting conclusions within one session. It also scatters detection logic across every skill, the exact duplication principle 4 forbids.
- **Detection as a deterministic script only, no persisted document.** Rejected for this milestone: it presumes the tooling layer that Milestone 4 builds, and it discards the human-editable narrative that captures environments, known-flaky areas, and ownership — knowledge no detector can infer. The persisted document is designed so a script can populate its frontmatter later without changing the contract.
- **Environment variables or ad-hoc config for context.** Rejected: invisible, unversioned, and unreviewable; it cannot hold narrative, and it cannot be diffed in a pull request the way a committed Markdown file can.

## Consequences

- Every skill gains a reliable, cheap first step and a coherent view of the project; detection knowledge lives in exactly one place.
- The pack gains a **staleness** obligation: a committed context file can drift from a changing repository. Mitigations: `qa-init` is cheap to re-run, `generatedAt` and `generatedBy` are recorded in every file, and skills are expected to flag obvious contradictions between the context and what they observe.
- Every skill must handle a **missing or partial** context gracefully — halt-and-recommend when absent, tolerate `null` fields when present. This is written into the [execution lifecycle](execution-lifecycle.md).
- The context file is the first of the pack's [extension seams](extension-points.md): new detectable facts are additive frontmatter fields, so new capability rarely requires touching existing skills.
- A formal machine-validatable schema for the frontmatter is deferred to the deterministic-tooling milestone; until then the [context contract](context-contract.md) is authoritative and `qa-init` conforms by construction.
