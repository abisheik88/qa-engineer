# Install for Claude Code

1. From your app directory:

   ```bash
   npx qa-automation-pack --yes
   # or target Claude Code explicitly:
   npx qa-automation-pack install --agent claude-code --yes
   ```

2. Skills land in `.claude/skills/` (and usually `.agents/skills/` as well).
3. In Claude Code, invoke `/qa-explore`, `/qa-run`, etc., or rely on auto-activation from the skill description.
4. Verify: `npx qa-automation-pack verify` and `npx qa-automation-pack self-test`.

Manual: `cp -R skills/qa-explore .claude/skills/`.
