# Browser adapters

How `/qa-explore` drives a browser across AI hosts. Prefer the first available adapter; document which one was used in the report metadata.

## Selection order

1. **Host browser MCP / IDE browser** — Cursor browser tools, Playwright MCP, Chrome DevTools MCP, or the agent's built-in preview pane.
2. **CDP attached session** — if the user already has a debuggable Chrome.
3. **CLI fallback** — project Playwright or Selenium via the shell (`npx playwright` / language bindings), headed when the user needs to log in.

Never require a specific MCP to be preconfigured by the installer. If no browser tool works after reasonable attempts, stop and report an environment blocker with what was tried.

## Adapter contract (logical)

Every adapter must support:

| Capability | Purpose |
| --- | --- |
| navigate(url) | Open the target |
| snapshot / accessibility tree | Structure for interaction |
| click / type / select | Interactions |
| evaluate(js) | DOM-verify, performance entries, in-page fetch |
| screenshot(path) | Native evidence capture |
| console / network (best-effort) | Baselines; prefer performance entries for network truth |

## Interaction rules

- Prefer element refs / roles / labels over x,y coordinates.
- After any navigation or scroll, refresh refs — they go stale.
- Verify with DOM or evaluate before screenshot.
- One intentional wait strategy: wait for a concrete condition (selector, network idle when safe), not fixed multi-second sleeps as the primary sync.

## Login handoff

1. Detect login (password field, SSO button, OTP prompt).
2. Message the user: sign in in the open browser; say when done.
3. Re-check `document.title` / URL / a logged-in landmark before continuing.

## CLI fallback sketch

When only CLI is available and the project has Playwright:

```bash
npx playwright screenshot --browser=chromium "<url>" qa-artifacts/explore-<run-id>/screenshots/landing.png
```

For interactive explore, prefer a short Playwright script the agent writes under `qa-artifacts/explore-<run-id>/scripts/` (throwaway, not committed suite code) or an existing headed debug session. Do not invent a permanent suite here — hand durable tests to `/qa-generate`.

## Disclosure

Record in report metadata: `browserAdapter` (`playwright-mcp` | `cursor-browser` | `cdp` | `cli-playwright` | `cli-other` | `unavailable`).
