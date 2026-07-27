# examples/

Runnable, public-facing examples of the pack in use. Populated in **Milestone 9**.

## What is here now

- **[getting-started/](getting-started/README.md)** — a runnable, hermetic
  Playwright + TypeScript app with the full workflow walked end to end:
  **support → install → generate → run → debug → report**, each step showing the
  real command and its expected output. The `/qa-run` result is validated against
  its contract; the Playwright suite runs with `npx playwright test`.

## What is still planned

Broader demo material remains on the [roadmap](../ROADMAP.md):

- **Per-framework demo repositories** — Selenium, Cypress, and WebdriverIO
  projects. These wait on those frameworks moving from Beta to live execution;
  see the [capability matrix](../docs/capability-matrix.md).
- **Seeded broken-app fixtures** — shared with the behavioral evaluation harness
  (Milestone 10), so documentation and evaluations exercise the same artifact.

Until then, each skill's own `examples/` directory carries worked scenarios (a
failed login, a locator break, a flaky test, a GraphQL review, an accessibility
audit) with their expected contract outputs.
