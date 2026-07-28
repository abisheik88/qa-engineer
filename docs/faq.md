# FAQ

Questions a new reader is likely to have, answered honestly — including the ones
with unflattering answers.

## What is this, in one sentence?

A set of twelve Agent Skills plus a deterministic Python engine that teaches any
Agent Skills–compatible AI coding agent to run, generate, debug, and report on test
automation without inventing results.

## Why prompts? Why not a plugin, an MCP server, or a library?

Because the agent is already in the loop, and the failure mode worth fixing is
behavioral, not mechanical. Teams do not lack a way to run Playwright; they lack a
way to stop an agent from "fixing" a suite by deleting an assertion.

Skills are also the only format that installs identically into every major agent.
A plugin would need one implementation per host; an MCP server would add a process,
a transport, and a dependency. The pack does carry code — the analysis engine — but
it ships as bundled files the agent invokes, not as a service.

## Does it work offline?

Yes, after install. The analysis engine is standard-library Python with no
third-party dependencies, the skills are local Markdown, and nothing phones home.
The installer needs network only to fetch the package itself.

## Does it send my code anywhere?

No. There is no telemetry and no network call in the pack. Your agent sends
whatever your agent normally sends — that is between you and your agent vendor —
but the pack adds nothing to it.

## What does it actually install into my repository?

Skills under `.agents/skills/` (and `.claude/skills/` for Claude Code), the bundled
Python engine inside the skills that use it, and `qa-lock.json` recording a SHA-256
per file. Nothing else. `npx qa-automation-pack uninstall --project .` removes
exactly what the lockfile lists, backing each file up first.

## Will it change my tests without asking?

Only `/qa-generate` writes test code, and only non-destructively: new files freely,
edits to existing files with explicit permission. `/qa-fix` produces a *plan* and
writes nothing. `/qa-review` edits nothing. The
[command table](../README.md#command-surface) marks exactly which commands touch
your repository.

## My project uses Cypress / Selenium / WebdriverIO. Does it work?

Partly, and the matrix says so precisely. All four frameworks are detected and
normalize their results identically through the shared core, so triage, reporting,
and flake analysis work for all of them. But `/qa-run` and `/qa-generate` gate
*live* execution and generation to Playwright today. Until that gate flips with a
real run behind it, the honest label for the other three is Beta. See the
[framework matrix](compatibility/framework-matrix.md).

## Which AI agents does it support?

Nine hosts read the standard discovery paths: Claude Code, Cursor, OpenAI Codex CLI,
OpenCode, Gemini CLI, GitHub Copilot, Antigravity, Kimi, and any other Agent Skills
reader. Support means "the skills install and are discoverable" — see
[COMPATIBILITY.md](../COMPATIBILITY.md). It does not yet mean "measured to behave
identically", which is the next question.

## How well does it actually work?

The honest answer, which the project states everywhere rather than burying:

- **Deterministically verified:** yes, thoroughly. 235 tests, 21 evaluation cases
  including adversarial ones, contract invariants enforced at runtime, and 17 CI
  gates. The tooling does what it claims.
- **Behaviorally benchmarked across models:** no. Four artifacts produced by one
  model in one session pass the scorer. That is an existence proof, not an accuracy
  number, and the [excellence audit](release/v1-excellence-audit.md) declines to
  claim otherwise.

If you need a published accuracy figure before adopting a tool, this one does not
have it yet.

## What stops the agent from just claiming success?

Three layers, in increasing order of strength:

1. **Instruction** — every skill's guardrails forbid it. Weakest layer; a model can
   ignore an instruction.
2. **Contract** — the shipped JSON Schema rejects `passed` alongside a non-zero exit
   code, and `ready` alongside failing tests. A dishonest result is *invalid*, and
   the skill validates before completing.
3. **Diff guard** — deterministic detection of the specific ways a suite is made to
   lie: removed or weakened assertions, skips, early returns, excluded specs,
   `|| true`, swallowed failures, inflated timeouts, deleted test files.

None of these can stop an agent that ignores the skill entirely. They make the
dishonest path fail loudly rather than pass quietly.

## Why is the command surface capped at twelve?

Every installed skill competes for the agent's context and for activation accuracy.
A thirteenth command makes the other twelve slightly worse at being chosen. So
growth requires an RFC that says what the new command displaces. Most good ideas
are better as an argument mode of an existing command, or as a knowledge module
that improves every skill at once.

## Do I need Python?

For the deterministic engine, yes — Python 3.8 or newer, standard library only, so
there is nothing to `pip install`. Without it, skills fall back to documented manual
reasoning and **mark their results degraded**, which is a real downgrade stated
plainly rather than hidden. `npx qa-automation-pack doctor --project .` tells you
which state you are in.

## Can I use it in CI?

The installer is CI-friendly (`--yes`, `--json`, deterministic, no prompts), and
`verify` makes a good pipeline check. The skills themselves need an agent, so
"running QA skills in CI" means running your agent in CI. The pack does not provide
one.

## How is this different from just prompting my agent well?

A good prompt is not versioned, not tested, not shared across your team's four
different agents, and cannot reject its own dishonest output. This pack is a prompt
library *plus* the three things a prompt cannot do: deterministic tooling, contracts
that fail, and a drift gate that keeps every copy of the knowledge identical.

## Is it stable? Should I pin it?

It is `0.9.0`, a public preview. Output contracts follow additive-only rules within
a major version ([ADR-0003](architecture/ADR-0003-versioning-strategy.md)), so a
consumer reading them is reasonably safe, but the pack is pre-1.0 and things can
still move. Pin the version if you build on the artifacts.

## Who maintains it, and what support can I expect?

One maintainer, stated plainly in [MAINTAINERS.md](../MAINTAINERS.md) along with why
that is a risk for adopters and what reduces it. There is no SLA; see
[SUPPORT.md](../SUPPORT.md).

## Something broke. What is the fastest path?

```bash
npx qa-automation-pack doctor --project .    # diagnoses and prints fix hints
npx qa-automation-pack repair --project .    # fixes drifted or missing pack files
```

Then [troubleshooting.md](troubleshooting.md), which maps symptoms to causes with
the real exit codes.

## How do I add support for my framework?

[docs/contributing/add-a-framework.md](contributing/add-a-framework.md). The
architecture was built for this: adding a framework should change only
`shared/frameworks/`, and the runbook ends with the check that proves it —
`git diff --stat skills/` must be empty.

## Can I fork it and strip out what I do not need?

Yes. MIT licensed, no runtime dependencies, no service component, plain files.
Skills you delete simply stop existing; the rest keeps working. That a fork is
genuinely viable is part of how a single-maintainer project stays safe to adopt.

## Why does every report end with an attribution footer?

The same reason a Lighthouse or Allure report does: a report that circulates should
say what produced it. It appears only on human-readable renderings — never on JSON
artifacts, CLI output, or anything a program parses, because appending prose to an
interface corrupts it.
