# QA API

Assesses how well an API test layer exercises its API — across REST, GraphQL, and WebSocket — examining schema and contract usage, status and error handling, authentication, pagination, caching, and idempotency, and flagging the gaps. Recommendations only; it changes no tests.

## Invocation

```text
/qa-api assess our REST and GraphQL test coverage
```

The skill scopes the protocols, optionally analyzes a captured session (a redacted HAR), assesses each area against the protocol's knowledge, and flags weaknesses with severity and a recommendation.

## Details

- Skill definition: [SKILL.md](SKILL.md)
- Output contract: [contracts/api-result.schema.json](contracts/api-result.schema.json)
- Worked example: [examples/graphql-review.md](examples/graphql-review.md)

It reuses the analysis platform's HAR analyzer and the [rest](../../shared/domains/rest.md), [graphql](../../shared/domains/graphql.md), and [websocket](../../shared/domains/websocket.md) knowledge; the knowledge-reuse design is recorded in [ADR-0012](../../docs/architecture/ADR-0012-knowledge-base.md).
