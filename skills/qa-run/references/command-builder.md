<!-- synced-from: shared/execution/command-builder.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# Command Builder

How a chosen strategy, a resolved scope, a browser, and an environment become the one concrete command the run executes. The builder is framework-agnostic: it assembles the *intent* of the command, and the framework adapter supplies the framework's actual flags and syntax.

Every built command is recorded verbatim in the execution result, so a run is always reproducible and auditable.

## Inputs

The builder consumes decisions already made by other modules — it invents nothing:

| Input | Source |
| --- | --- |
| Strategy | The chosen strategy (see the execution-strategy module) |
| Scope | The include and exclude sets the strategy resolved |
| Browser and mode | The environment decision (see the environment-detection module) |
| Runner | The framework adapter, from the recorded framework |
| Reporter | Always includes a machine-readable reporter, so the result can be normalized |

## The build

1. Start from the adapter's base run command.
2. Apply the scope as the adapter's selection mechanism — a tag filter, a path filter, a project selection, or named files. The adapter owns the syntax; the builder owns which selection to apply.
3. Apply the browser and mode as the adapter's flags.
4. Always add a machine-readable reporter alongside any human reporter. Normalization depends on it; a run without it cannot produce a trustworthy result.
5. Add the evidence flags the artifact plan requires (tracing, video, screenshots) at the levels the strategy chose.
6. Record the full command string in the result.

## Rules

- **One command, fully specified.** The builder produces a single command with every relevant flag explicit. It does not rely on ambient defaults that a reader of the result could not see.
- **Reporter is non-negotiable.** A machine-readable reporter is always present; the result's counts and per-test outcomes come from it, not from scraping human output.
- **Secrets never enter the command line.** Credentials are passed by environment-variable reference, never interpolated into the recorded command (the command is stored and shown).
- **No destructive flags.** The builder never adds flags that update snapshots, rewrite baselines, or delete artifacts; execution observes, it does not mutate the project.
- **Illustrative until launched.** The built command is presented in the plan before the run; the guardrails against claiming a run happened apply until the command has actually executed and returned.

## Extension

A new framework changes only the adapter's answers — base command, selection syntax, reporter and evidence flags. The builder's logic (which selection, which reporter, record verbatim) is unchanged. This is why adding a framework never touches the command-building step of any skill.
