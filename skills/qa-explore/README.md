# QA Explore

Full-spectrum exploratory product QA against a live URL — functional, API replay, performance, client security, and UI/UX — with optional attached test cases and an evidence-backed report (screenshots and severity per finding).

## Invocation

```text
/qa-explore https://staging.example.com/dashboard
```

Or attach test cases and ask to QA the page. The skill asks for a URL if none is given, opens a browser, runs the full pipeline, and writes proof under `qa-artifacts/explore-<run-id>/`.

## Details

- Skill definition: [SKILL.md](SKILL.md)
- Output contract: [contracts/explore-result.schema.json](contracts/explore-result.schema.json)
- Worked examples: [examples/](examples/)
- RFC: [RFC-0001](../../docs/rfcs/RFC-0001-qa-explore.md)

## Manual install (any Agent Skills host)

Copy this directory into the agent's skills discovery path (for example `.agents/skills/qa-explore/` or `.claude/skills/qa-explore/`). Prefer the pack installer (`qa install`) when available — see [docs/installation/](../../docs/installation/README.md).
