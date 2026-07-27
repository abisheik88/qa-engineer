# QA Project Initialization

Analyzes a repository and writes its QA profile to `.qa/context.md` — the file every other QA skill reads first. Run it once when you adopt the pack, and again whenever the project's stack or layout changes. It only observes and records; it never runs tests or edits source.

## Invocation

```text
/qa-init
```

The skill detects the language, package manager, test and browser-automation frameworks, API styles, CI provider, and conventions, then writes `.qa/context.md` and summarizes what it found.

## Details

- Skill definition: [SKILL.md](SKILL.md)
- What it detects and how: [references/detection-guide.md](references/detection-guide.md)
- The file it produces: [templates/context.md](templates/context.md)
- Worked example: [examples/initialize-a-repo.md](examples/initialize-a-repo.md)

The structure and meaning of every field in `.qa/context.md` is specified in the [project context contract](../../docs/architecture/context-contract.md), and the decision to centralize context this way is recorded in [ADR-0004](../../docs/architecture/ADR-0004-project-context.md).
