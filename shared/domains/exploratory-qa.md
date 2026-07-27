# Exploratory QA

Operating principles for live product QA against a URL in a browser. Consumed by the explore skill. Complements evidence-and-reporting; does not replace suite execution knowledge.

## Best practices

- **Best practice:** treat DOM state as truth and screenshots as evidence. Verify interactions via the DOM (or accessibility tree) before capturing a screenshot; screenshot pipelines often lag the page by seconds.
- **Best practice:** never enter credentials or OTPs. Open the login page and ask the user to sign in in their browser session. Re-check session state before each phase if the session may have died.
- **Best practice:** assign stable finding IDs once (`EXP-1`, `EXP-2`, …). Removals leave gaps; never renumber. Cross-references in reports and chat must not break.
- **Recommendation:** run attached test cases before free exploration so known acceptance criteria get first claim on the session.
- **Recommendation:** separate data bugs from presentation bugs. When UI numbers look wrong, cross-check the live API (and optional DB when the user provided access) at the capture timestamp before asserting "wrong data".
- **Best practice:** every finding cites at least one proof artifact — screenshot, network entry, console excerpt, or DOM observation — with a path under the run's artifact directory.
- **Recommendation:** include a "what works well" section. Credibility comes from calibrated praise as much as criticism.

## Common failures

- Reporting a "dead click" from a stale screenshot or coordinate miss when a DOM click would have succeeded (or vice versa).
- Typing secrets into the page from the agent session.
- Claiming severity without evidence, or embedding raw tokens/PII in the report.
- Renumbering findings after a feedback round, breaking prior references.
- Treating unreproducible user reports as confirmed bugs without listing attempts.

## Detection signals

- Login wall, expired session, or blank shell after navigation.
- Console error storms, failed XHR/fetch, or zero-byte responses on critical endpoints.
- Filters that do not appear in request query strings while the UI claims they apply.
- Duplicate hidden component instances (off-screen inputs) that steal actions.
- Focus stolen by canvas or overlays (`document.activeElement` not the intended control).

## Repair guidance

- For product findings: recommend a fix direction; do not edit application code from this skill.
- For session blockers: stop after a small number of stuck attempts, report the blocker with evidence, and ask the user for the next step (login, VPN, environment).
- For user-reported hypotheses: mark VALIDATED, COULD-NOT-REPRODUCE (with attempts), or PARTIAL with measurements.

## Framework notes

- Exploratory QA is browser-adapter agnostic: Playwright MCP, Cursor/IDE browser tools, CDP, or CLI Playwright/Selenium. Prefer the host agent's native browser tool; fall back to CLI when MCP is unavailable.
- Automated suite frameworks (Playwright, Cypress, Selenium, WebdriverIO) are out of scope for the explore loop itself; durable automation from findings is a handoff to generation or run skills by name.

## Anti-patterns

- **Anti-pattern:** trusting a screenshot taken immediately after an action without DOM verification.
- **Anti-pattern:** html2canvas or in-page capture as the primary path when the agent can take a native screenshot.
- **Anti-pattern:** org-specific hosting, branding, or database recipes baked into the skill body.
- **Anti-pattern:** destructive security tests, DoS, or credential fishing during explore.

## Future extension

- Mobile / Appium explore loops; recorded session replay; automated highlight overlays as a deterministic script; optional publish hooks that remain outside the skill body.
