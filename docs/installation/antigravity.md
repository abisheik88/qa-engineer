# Install for Antigravity

```bash
npx qa-engineer --yes
# or:
npx qa-engineer install --agent antigravity --yes
```

- Skills: `.agents/skills/`

**Detection:** Antigravity is detected by its own `.antigravity/` directory. The shared `.agents/` path is not used as evidence — this installer creates it for every host, so treating it as a marker would report Antigravity for any project the pack had already touched. Pass `--agent antigravity` to request the workflow wrappers explicitly.

- Workflow wrappers (opt-in format): `.agents/workflows/<skill>.md`
