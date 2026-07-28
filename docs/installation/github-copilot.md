# Install for GitHub Copilot

```bash
npx qa-engineer --yes
# or:
npx qa-engineer install --agent github-copilot --yes
```

- Skills: `.agents/skills/` (also compatible with `.github/skills/` hosts)
- Optional prompt wrappers: `.github/prompts/<skill>.prompt.md`

**Detection:** Copilot is detected by `.github/copilot-instructions.md` or an existing `.github/prompts/` directory — not by `.github/` alone, which nearly every repository has for Actions or issue templates. Pass `--agent github-copilot` to request the prompt wrappers explicitly.
