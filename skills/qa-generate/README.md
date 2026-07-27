# QA Generate

The pack's automation generator — the skill to use when you want **Playwright (or same-framework) automation code**.

> **Framework support is not uniform.** Only **Playwright** generation is
> Production: it has curated, tested templates under
> [templates/playwright/](templates/playwright/). Generation for **Selenium,
> Cypress, and WebdriverIO is Beta** — the skill follows each framework's
> convention modules, but there are **no curated templates and no tests** for
> them, so treat generated non-Playwright code as **unverified** and review it
> before trusting it. This mirrors `/qa-run`, which executes Playwright live and
> only plans other frameworks. See the
> [capability matrix](../../docs/capability-matrix.md).

## What it does

| Situation | Behavior |
| --- | --- |
| Suite already exists (Playwright or another framework) | **Extend:** review structure; add tests and/or Cucumber step definitions + implementations; harvest **concrete locators from the real site** when a URL is available. Non-Playwright output is best-effort from conventions and **unverified**. |
| No Playwright, but Selenium / Cypress / WebdriverIO (etc.) exists | Generate in **that** framework from its conventions (never force Playwright) — **Beta: no curated templates, output unverified** |
| No test framework | **Bootstrap:** ask framework and language, then build a framework spine. **Playwright** is the only framework with curated, tested templates; other choices are best-effort and unverified. |

## Invocation

```text
/qa-generate a checkout test for https://staging.example.com/checkout
```

```text
/qa-generate set up end-to-end automation for this app
```

(On greenfield, the agent asks for framework + language before writing files.)

## Details

- Skill definition: [SKILL.md](SKILL.md)
- Contract: [contracts/generation-result.schema.json](contracts/generation-result.schema.json)
- Playwright templates: [templates/playwright/](templates/playwright/)
- Examples: [examples/bootstrap-new-framework.md](examples/bootstrap-new-framework.md), [examples/extend-existing-suite.md](examples/extend-existing-suite.md)

Built on the [generation platform](../../shared/generation/README.md); see [ADR-0008](../../docs/architecture/ADR-0008-generation-architecture.md).
