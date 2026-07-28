# Other agents (Kimi, OpenCode peers, custom hosts)

Any tool that loads Agent Skills from a directory of `SKILL.md` folders can use this pack.

## Kimi and copy-only hosts

```bash
npx qa-engineer install --agent kimi --yes
# or manually:
cp -R /path/to/qa-engineer/skills/qa-explore .agents/skills/
```

Point the agent at `.agents/skills/` (or copy into whatever skills path the product documents). No wrapper is required when the host auto-activates from skill descriptions.

## Generic recipe

1. Copy `skills/<name>/` into the host's skills discovery path.
2. Ensure `references/`, `contracts/`, and `examples/` travel with the skill (self-contained).
3. Invoke by skill name (`qa-explore`) or slash command if the host supports it.
