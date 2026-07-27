# Skill Format Notes

A guided tour of `qa-example` as a reference implementation — what each part demonstrates and where its rule is defined. This is a *local* reference: knowledge owned by this skill alone. Its sibling, `example-domain.md`, demonstrates the other kind — a synced copy owned by the shared knowledge engine.

## What each part of this skill demonstrates

| Part | Demonstrates | Rule defined in |
| --- | --- | --- |
| Frontmatter | The required field set, folded description, quoted version, maturity and audience values | Skill specification, "Frontmatter" |
| Description | Capability sentence plus "Use when..." with distinctive keywords, and an explicit non-capability statement | Skill specification, "Description rules" |
| Body sections | All six mandatory sections in order — present here even though model-only skills may omit some, because this skill is the reference for user-facing skills too | Skill specification, "Body" |
| Context loading table | Conditional loading — nothing loaded unconditionally | Skill specification, "Body" |
| Procedure step 2 | Deterministic verification before reasoning; evidence gathered by reading, not recalling | Authoring guide, "Testing a skill" |
| Procedure step 6 | Bounded retries with explicit stop-and-report behavior | Skill specification, "Guardrails" |
| Guardrails | The pack-wide set plus task-specific rules in the skill's own words | Skill specification, "Guardrails" |
| Output section | Contract reference, self-validation before completion, fallback when the repository is not writable | Output contracts standard |
| `contracts/` | The envelope in a real schema: closed enum, evidence with at least one entry, URN identity | Output contracts standard |
| `examples/` | A worked example whose shown output validates against the skill's own contract | Quality checklists, "Examples review" |

## Things this skill deliberately does not contain

Their absence is as instructive as the rest:

- No argument placeholder tokens and no agent-specific execution syntax — the hard prohibitions in the specification. The Inputs section shows the portable phrasing instead.
- No paths reaching outside the skill directory, and no reference to any sibling skill by path — cross-skill relationships are handoffs by command name.
- No `scripts/`, `templates/`, or `tests/` directories — they are as-needed, and this skill does not need them. An empty directory is a layout violation, not a convention.
