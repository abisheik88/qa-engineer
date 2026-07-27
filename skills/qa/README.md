# QA Router

The public entry point for the QA Automation Pack. Type `/qa` with a request and it routes you to the skill that owns the task — so you never have to memorize the command surface. It does no QA work itself; it classifies intent and hands off.

## Invocation

```text
/qa my checkout test is failing in CI and I don't know why
```

The router reads the request, decides this is a triage task, and hands off to the owning skill with a one-line explanation.

## Details

- Skill definition: [SKILL.md](SKILL.md)
- Routing logic: [references/routing-map.md](references/routing-map.md)
- Worked examples: [examples/routing.md](examples/routing.md)

Routing behavior, the dispatch rules, and how the router avoids competing with the skills it dispatches to are documented in [skill interactions](../../docs/architecture/skill-interactions.md).
