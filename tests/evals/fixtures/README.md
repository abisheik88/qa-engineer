# Eval fixtures

Input material the eval cases run against: small, self-contained repositories and the artifacts a case needs. Fixtures are implemented in a later milestone alongside the runner; this README specifies what they will be.

## What a fixture is

A fixture is the smallest repository that exhibits a known stack — enough for a skill to detect and reason about, no more. Each fixture has a documented "truth" (its real language, framework, conventions) that the [expected/](../expected/README.md) outputs assert against.

## Planned fixtures

| Fixture | Represents |
| --- | --- |
| `playwright-ts/` | Single-package Playwright + TypeScript + pnpm web project |
| `selenium-java/` | Maven project using Selenium WebDriver |
| `cypress-cucumber/` | Cypress project with Cucumber `.feature` files |
| `monorepo/` | Workspace with two packaged apps and differing stacks |
| `sparse/` | Minimal repo with weak signals, for confidence and gap handling |

Artifact fixtures (a sample trace, a HAR, a JUnit report) join these when the skills that consume them ship.

## Rules

- **Self-contained and small.** A fixture holds only what a case needs to detect or plan; it is not a real application.
- **Redacted and safe.** No secrets, no real hostnames, no personal data — the [security policy](../../../SECURITY.md) applies to test material too.
- **Documented truth.** Each fixture states its real stack, so expected outputs are derived from fact, not from the skill's own output (which would make the eval circular).
- **Excluded from published artifacts.** Fixtures ship with the repository for CI, never inside an installable package.
