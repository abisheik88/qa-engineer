# templates/

Reusable scaffolds. Every recurring artifact in the project starts from a template here, so contributions begin compliant instead of being reviewed into compliance. Templates use `{{placeholder}}` tokens; the skill validator deliberately rejects unreplaced tokens, so nothing half-filled can merge.

## Index

| Template | Produces | Used with |
| --- | --- | --- |
| [skill-template/](skill-template/SKILL.md) | A complete skill directory in the canonical layout | `cp -r templates/skill-template skills/qa-<name>` — see the [authoring guide](../docs/skills/authoring-guide.md) |
| [knowledge-module-template.md](knowledge-module-template.md) | A `shared/` knowledge module | [Shared knowledge engine](../shared/README.md) |
| [domain-template.md](domain-template.md) | A `shared/domains/` knowledge-base document (the seven canonical sections) | [QA knowledge base](../shared/domains/README.md) |
| [output-contract-template.json](output-contract-template.json) | A report JSON Schema with the standard envelope | [Output contracts](../docs/skills/output-contracts.md) |
| [example-template.md](example-template.md) | A worked example in a skill's `examples/` | [Skill anatomy](../docs/skills/skill-anatomy.md) |
| [rfc-template.md](rfc-template.md) | A proposal for command-surface or platform changes | Skill proposal escalation — [authoring guide](../docs/skills/authoring-guide.md) |
| [release-notes-template.md](release-notes-template.md) | The body of a GitHub Release | [Release process](../docs/contributing/versioning-and-releases.md) |

The Architecture Decision Record template lives with the ADR system at [docs/architecture/adr-template.md](../docs/architecture/adr-template.md).

## Maintaining templates

Templates are normative documentation with holes in it: they change through the same review as the standards they encode, and a change to a standard must update its template in the same pull request. If a template and its standard disagree, the standard wins — and the mismatch is a bug.
