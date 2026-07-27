# Routing Map

The router's dispatch logic: how a request becomes a decision to hand off to exactly one skill. Match top to bottom; the first row whose signals are present wins. The order encodes priority — evidence of a concrete failure outranks a vague request to "check" something.

## Signal table

| Priority | Signals in the request or repository | Route to |
| --- | --- | --- |
| 1 | No `.qa/context.md` exists yet, or the user asks to set up, onboard, or analyze the project | `qa-init` |
| 2 | A failure to explain: a stack trace, a red CI run, a failing spec, "broken", "why did this fail" | `qa-debug` |
| 3 | A request to run, execute, or check: a suite, smoke, regression, changed tests, named specs | `qa-run` |
| 4 | A request to create: write a test, a feature file, a page object, fixtures, test data | `qa-generate` |
| 5 | A request to repair or heal: fix a test, update a selector, a rotted locator | `qa-fix` |
| 6 | Live product QA: a URL or feature to explore in the browser, attached test cases to execute against a page, "QA this page/app", full-spectrum / exploratory / security+perf+UI on a live site | `qa-explore` |
| 7 | An API concern: an endpoint, schema, GraphQL query, REST call, a captured session (test assessment, not live explore) | `qa-api` |
| 8 | A page-quality concern from artifacts or a narrow audit: accessibility, performance, visual, security audit of a view (no live explore / attached cases) | `qa-audit` |
| 9 | Intermittency: "flaky", "sometimes fails", "passes on retry" | `qa-flaky` |
| 10 | A request to review or improve existing test code | `qa-review` |
| 11 | A request for a summary, report, or export of QA results | `qa-report` |

When a request routes to a skill that has not shipped, say so plainly and name what the user can do today — never pretend the skill exists.

## Dispatch rules

- **First match wins, but read the whole request.** Priority 1 (missing context) precedes everything for skills that need a project profile. **Exception:** `qa-explore` may proceed without `.qa/context.md` when the user supplies a URL — it is product QA against a live surface, not suite execution. Still recommend `qa-init` afterward if the repo will keep automation.
- **Explore vs audit.** A URL plus "QA the page", attached cases, or multi-dimension product testing is priority 6 (`qa-explore`). A request that only names accessibility / Lighthouse / axe / visual baseline against an existing HAR or snapshot is priority 8 (`qa-audit`).
- **Dominant reading required.** Dispatch immediately only when one route clearly fits. "My login test keeps failing intermittently" is priority 9 (flaky), not priority 2 (debug), because "intermittently" dominates — read for the strongest signal, not the first keyword.
- **One question, two candidates.** When two routes are genuinely plausible ("look at my API tests" could be run or debug), ask a single question naming both, then dispatch on the answer.
- **Name, never path.** Hand off by command name (`/qa-run`). The router never tells an agent to read another skill's files.

## Why the router stays narrow

The router's description is deliberately about *uncertainty and entry* ("unsure which command", "spans several skills"), not about specific QA tasks. If it advertised the same keywords as `qa-debug` or `qa-run`, it would compete with them for auto-activation and steal requests they should own. The router wins only the requests no specific skill should — that is the whole point of keeping its language generic, and it is why a router that advertises task keywords is a known anti-pattern.
