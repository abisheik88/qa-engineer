# QA Review

Reviews a test codebase's quality and scores it — judging structure, maintainability, duplication, naming, page objects, fixtures, assertions, and test design against the pack's engineering knowledge, then recommending improvements. It reads and judges; it edits nothing.

## Invocation

```text
/qa-review assess the health of the e2e suite
```

The skill surveys the code, rates each quality dimension against the knowledge base with cited evidence, produces an overall score and verdict, and lists ranked improvements — pointing to `/qa-fix` or `/qa-generate` where a change would follow.

## Details

- Skill definition: [SKILL.md](SKILL.md)
- Output contract: [contracts/review-result.schema.json](contracts/review-result.schema.json)
- Worked example: [examples/suite-review.md](examples/suite-review.md)

Judgements are grounded in the [QA knowledge base](../../shared/domains/README.md); the knowledge-reuse design is recorded in [ADR-0012](../../docs/architecture/ADR-0012-knowledge-base.md).
