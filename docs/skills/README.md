# Skill Platform

This section defines the platform every skill in the pack is built on. It exists so that adding a high-quality skill takes minutes, not days — and so that fifty skills written by fifty people read like they were written by one team.

## The documents

Read them in this order when authoring your first skill:

| Document | Defines |
| --- | --- |
| [skill-anatomy.md](skill-anatomy.md) | The canonical directory layout of a skill and the purpose of every folder |
| [skill-specification.md](skill-specification.md) | The normative `SKILL.md` standard: frontmatter, body sections, descriptions, naming, size limits |
| [authoring-guide.md](authoring-guide.md) | How to create, test, review, version, deprecate, and compose skills |
| [output-contracts.md](output-contracts.md) | The machine-readable report standard and JSON Schema strategy |
| [quality-checklists.md](quality-checklists.md) | The per-dimension review checklists a skill must pass |

## The supporting pieces

- **Templates** — every new skill starts from [templates/skill-template/](../../templates/skill-template/SKILL.md); knowledge modules, contracts, examples, RFCs, and release notes have templates in [templates/](../../templates/README.md).
- **Shared knowledge engine** — cross-skill knowledge lives in [shared/](../../shared/README.md) and is synced into skills by copy; the engine's rules are defined there.
- **Validation tooling** — [scripts/](../../scripts/README.md) holds the validators CI runs on every pull request; run them locally before pushing.
- **Reference implementation** — [skills/qa-example/](../../skills/qa-example/SKILL.md) is a complete, validated skill demonstrating every platform feature. When this documentation and `qa-example` disagree, that is a bug: file it.

## The fifteen-minute bar

The platform is designed so this workflow stays under fifteen minutes for a knowledge-level contribution:

```text
1. cp -r templates/skill-template skills/qa-<name>     (or edit an existing skill)
2. Fill in frontmatter and the six body sections
3. node scripts/validate-skills.mjs                    (fix what it reports)
4. Test it live in your own agent                      (see the authoring guide)
5. Open a pull request
```

If any step regularly takes longer, that is a platform defect — open an issue against this section, not a workaround in your skill.
