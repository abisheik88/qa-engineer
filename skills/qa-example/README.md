# QA Example

The pack's reference skill: a complete, validated implementation of the [skill specification](../../docs/skills/skill-specification.md) that doubles as a lightweight installation self-check. Contributors copy from it; maintainers invoke it to confirm an installed pack is discoverable and readable. It performs no QA work.

## Invocation

```text
Ask your agent: "Run the QA pack installation self-check."
```

The skill activates by description (`metadata.audience: model` — it is not one of the pack's user-facing commands).

## Details

- Skill definition: [SKILL.md](SKILL.md)
- Output contract: [contracts/self-check-report.schema.json](contracts/self-check-report.schema.json)
- Worked example: [examples/self-check.md](examples/self-check.md)

When this skill and the platform documentation disagree, that is a platform bug — file a documentation issue.
