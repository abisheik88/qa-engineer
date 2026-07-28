# Install for Cursor

1. From your app directory:

   ```bash
   npx qa-engineer --yes
   # or target Cursor explicitly:
   npx qa-engineer install --agent cursor --yes
   ```

2. Skills land in `.agents/skills/` (Cursor 2.4+ also reads `.cursor/skills/` — the shared `.agents/skills/` path is the pack default).
3. Use `/qa-explore <url>` or ask to QA a page with attached cases.
4. For browser explore, enable Cursor's browser / Playwright MCP tools when available.

Manual: `cp -R skills/* .agents/skills/`.
