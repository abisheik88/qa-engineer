# Documentation

This directory holds the project's long-form documentation. Quick-start material lives in the root [README.md](../README.md); everything deeper lives here.

## Start here

[engineering-principles.md](engineering-principles.md) is the project's constitution — the ordered principles that settle architectural decisions. Read it first; the rest of the documentation applies it.

## Map

| Section | Contents | Status |
| --- | --- | --- |
| [engineering-principles.md](engineering-principles.md) | The constitution: ordered principles for making architectural decisions | Active |
| [capability-matrix.md](capability-matrix.md) | **Canonical** source for what the pack does and how far each capability is proven — every other doc derives capability claims from it | Active |
| [release-readiness.md](release-readiness.md) | Release/production checklists, known limitations, experimental features, support policy, and the blockers before public preview | Active |
| [troubleshooting.md](troubleshooting.md) | Symptoms → causes → fixes for install, skills, verification, results, and the context file, with real exit codes | Active |
| [preview-tester-guide.md](preview-tester-guide.md) | A 20-minute script for preview testers, and what feedback is most useful | Active |
| [evaluation-platform.md](evaluation-platform.md) | The two-layer eval platform: deterministic gate + live-agent runner, providers, scenarios, benchmark reports, regression detection, and cross-model drift | Active |
| [architecture/](architecture/README.md) | Architecture overview, ADRs, and the core-engine specifications (context contract, execution lifecycle, skill interactions, extension points) | Active |
| [skills/](skills/README.md) | The skill platform: `SKILL.md` specification, anatomy, authoring guide, output contracts, quality checklists | Active |
| [compatibility/](compatibility/framework-matrix.md) | Per-framework support matrix (execution, generation, analysis, diagnostics, reporting) | Active |
| [installation/](installation/README.md) | Per-agent installation guides and quickstart | Active |
| [rfcs/](rfcs/RFC-0001-qa-explore.md) | Accepted RFCs that change the command surface or platform standards | Active |
| [contributing/](contributing/README.md) | Contributor standards: workflow, coding, commits, branches, style guide, review, issues, releases | Active |

## Conventions

- Every directory carries a `README.md` that indexes its contents.
- Documents link to each other with relative paths to explicit files, so links work on GitHub, in editors, and under the CI link checker.
- All documentation is linted and link-checked by [CI](../.github/workflows/ci.yml); the writing rules are defined in [contributing/documentation-standards.md](contributing/documentation-standards.md).

## Where things will land later

- Auto-generated per-skill reference pages arrive with the documentation site in Milestone 9 (in progress) and will live under a dedicated `reference/` section.
- Cookbook-style walkthroughs (triage a failing CI run, heal locators after a redesign, turn a story into BDD scenarios) arrive alongside the behavioral evaluation harness in Milestone 10.
