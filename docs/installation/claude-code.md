# Install for Claude Code

1. From your app directory:

   ```bash
   npx qa-engineer --yes
   # or target Claude Code explicitly:
   npx qa-engineer install --agent claude-code --yes
   ```

2. Skills land in `.claude/skills/` (and usually `.agents/skills/` as well).
3. In Claude Code, invoke `/qa-explore`, `/qa-run`, etc., or rely on auto-activation from the skill description.
4. Verify: `npx qa-engineer verify` and `npx qa-engineer self-test`.

Manual: `cp -R skills/qa-explore .claude/skills/`.
