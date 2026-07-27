# shared/ci/

> **Status: not authored.** This directory holds a scope note and nothing else.
> No skill loads CI knowledge today, and no capability claim depends on it — see
> the [capability matrix](../../docs/capability-matrix.md). The catalog below is
> intent, not content. It was originally slated for Milestone 3 and did not land
> there; it will be scheduled explicitly rather than assumed complete.

Continuous-integration knowledge, loaded when a task involves a CI system's runs, logs, or configuration — intended as the backbone of CI failure triage.

## Planned catalog

| Section | Scope |
| --- | --- |
| `github-actions/` | Workflow and log anatomy, artifact retrieval, annotations, matrix/retry semantics |
| `jenkins/` | Pipeline log structure, stage/agent model, artifact archiving, common plugins in test pipelines |
| `gitlab-ci/` | Job/stage logs, artifacts and reports, retry and rules semantics |
| `azure-devops/` | Pipeline logs, test-result publication, stage approvals interplay with test runs |

## What belongs here

- Log formats and how to slice them: where the failure actually is in ten thousand lines of noise.
- How test results and artifacts (reports, traces, screenshots) surface in each system, and how to retrieve them — including the authentication each path requires, stated explicitly.
- Pipeline patterns that cause test failures unrelated to tests: caching, parallelization, environment drift.

What does not: generating CI pipelines from scratch (a generation concern owned by skills) and failure *classification* judgment, which is a domain concern (`domains/failure-taxonomy.md`) these modules feed.

Module format: [templates/knowledge-module-template.md](../../templates/knowledge-module-template.md). Engine rules: [shared/README.md](../README.md).
