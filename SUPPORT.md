# Support

Where to get help, what to expect, and how to help us help you.

**Before anything else, run the diagnostics.** They resolve most problems and, when
they don't, their output is the single most useful thing you can attach to a report:

```bash
npx qa-engineer doctor --project .     # environment + install diagnosis, with fix hints
npx qa-engineer self-test --project .  # PASS/FAIL checks
npx qa-engineer repair --project .     # fix drifted or missing pack files
```

Common problems and their fixes are in
[docs/troubleshooting.md](docs/troubleshooting.md) — check there first; it covers
skills not activating, a missing Python engine, drift after a manual edit, and
install conflicts.

## Where to go

| What you need | Where | Expect |
| --- | --- | --- |
| "How do I…?" / usage question | GitHub **Discussions** | Best effort, community-first |
| Something is broken | GitHub **Issues** → *Bug report* | Triaged within a week |
| Documentation is wrong or unclear | GitHub **Issues** → *Documentation* | Treated as a bug |
| A new skill or knowledge module | GitHub **Issues** → *Skill proposal* | Discussed against the [command-surface cap](GOVERNANCE.md) |
| A security vulnerability | **Private report** — see [SECURITY.md](SECURITY.md). Never an issue. | Acknowledged within 72 hours |
| A feature you want | GitHub **Issues** → *Feature request* | Honest yes/no/not-now |

## What to expect, stated plainly

This is a volunteer-maintained project with **one maintainer**
([MAINTAINERS.md](MAINTAINERS.md)). Calibrate accordingly:

- **There is no SLA.** Best-effort response, typically within a week.
- **Bugs with a reproduction get fixed first**, and usually much faster than ones
  without. A failing test in a pull request is the fastest path of all.
- **"Not now" is a real answer.** The command surface is capped deliberately; a
  useful idea can still be declined, and you will be told why rather than left in
  an open issue forever.
- **Behavioral questions may have no answer yet.** How well a specific AI model
  follows these skills is not yet measured across models — see the limitations in
  [docs/release/v0.9-release-checklist.md](docs/release/v0.9-release-checklist.md).
  If your issue is "the agent did something odd", say which agent and model; that
  is genuinely useful data even when we cannot promise a fix.

## What makes a report actionable

For a bug, please include:

1. **Output of `npx qa-engineer doctor --project . --json`** — this alone
   answers most of the environment questions.
2. **The exact command you ran** and what you expected instead.
3. **Which agent and model** (Claude Code, Cursor, Codex CLI …) if the problem is
   in skill behavior rather than the CLI.
4. **The artifact**, if one was produced (`qa-artifacts/*.json`), with secrets
   removed — the analyzers redact by default, but check.
5. **Versions:** `npx qa-engineer --version`, `node --version`,
   `python3 --version`.

For a skill-behavior report, the most valuable detail is **what the skill claimed
versus what was true**. That is the failure mode this pack exists to prevent, and a
concrete instance is worth more than a general impression.

## What is out of scope

- **Debugging your test suite.** The pack helps your agent do that; we cannot do it
  for you in an issue thread.
- **Support for AI agents that do not implement the Agent Skills standard.** See
  [COMPATIBILITY.md](COMPATIBILITY.md).
- **Support for modified installs.** If you have edited files under
  `.agents/skills/`, `verify` will tell you; `repair` will restore them. We debug
  from a verified install.

## Helping yourself faster

The repository is designed to answer questions without a human:

- [docs/capability-matrix.md](docs/capability-matrix.md) — what the pack can do and
  how well proven each capability is. If it is not in the matrix, it is not a
  capability.
- [docs/troubleshooting.md](docs/troubleshooting.md) — symptoms → causes → fixes.
- [docs/architecture/README.md](docs/architecture/README.md) — why the project is
  shaped the way it is.
- [docs/release/](docs/release/) — the verified state of the project, including its
  known limitations.
