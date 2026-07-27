# Example: installation self-check

## Request

```text
Run the QA pack installation self-check.
```

## Context

The pack's skills are installed in the agent's discovery path. The repository is writable, so the report can be written to `qa-artifacts/`.

## Expected behavior

1. The skill activates by description (no explicit command — it is model-only).
2. The agent reads `references/skill-format-notes.md` and `references/example-domain.md`, recording a fragment of each as evidence of the read.
3. The agent parses `contracts/self-check-report.schema.json` and confirms it is valid JSON.
4. All three files read cleanly, so the classification is `pass`.
5. The agent composes the report, checks it against the contract (required fields, enum value, at least one evidence entry), writes it to `qa-artifacts/qa-example-a1b2c3.json`, and summarizes in prose.

## Expected output

```json
{
  "contract": { "name": "qa-example/self-check-report", "version": "1.0.0" },
  "skill": { "name": "qa-example", "version": "0.1.0" },
  "generatedAt": "2026-07-18T09:30:00Z",
  "summary": "All qa-example files are installed and readable: both references and the output contract loaded cleanly. The pack installation looks healthy at this skill's scope.",
  "classification": "pass",
  "confidence": 0.97,
  "evidence": [
    {
      "type": "file",
      "description": "Local reference loaded and readable",
      "source": "references/skill-format-notes.md",
      "excerpt": "A guided tour of qa-example as a reference implementation"
    },
    {
      "type": "file",
      "description": "Synced shared-knowledge copy loaded and readable",
      "source": "references/example-domain.md",
      "excerpt": "State rules in the imperative, numbered, most important first"
    },
    {
      "type": "file",
      "description": "Output contract parsed as valid JSON",
      "source": "contracts/self-check-report.schema.json",
      "excerpt": "\"$id\": \"urn:qa-pack:contract:qa-example:self-check-report:1\""
    }
  ],
  "metadata": {}
}
```
