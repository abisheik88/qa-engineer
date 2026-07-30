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
5. Add the evidence flags the artifact plan requires (tracing, video, screenshots). The strategy chooses the level; the failure floor below is the minimum it may choose.
6. Record the full command string in the result.

## The failure evidence floor

A red test the reader cannot see is a re-run they have to pay for. Every built command therefore captures at least this much, whatever the strategy:

| Evidence | Minimum level | Why it is the floor |
| --- | --- | --- |
| Machine-readable report | always | The result's counts and per-test outcomes come from it |
| Standard output and error | always | The only record of a launch failure, which no reporter contains |
| Screenshot | on failure | The first question asked about a failure is what was on screen when it broke |
| Trace | on first retry | Actions, console, and network for the attempt that failed — the input the diagnostic layer reads |
| Video | on failure, when the adapter supports it | The steps *before* the failing assertion, which a single frame cannot show |

- **A strategy may raise a level, never lower it below the floor.** A visual suite may capture screenshots for every test; a smoke run may not turn failure capture off. Speed is not a reason to run blind, because failure evidence costs nothing on a green run — nothing failed, so nothing was captured.
- **The floor is set explicitly on the command line.** The project's own config may already enable it, but an ambient default is invisible to a reader of the recorded command, and a config change silently removes it. The flag is written even when it duplicates the config, and it overrides a config that disabled capture.
- **An adapter that cannot capture something says so.** A framework with no video support records that gap in the evidence plan rather than dropping the row, so the absence is a known limit and not an oversight.

## Rules

- **One command, fully specified.** The builder produces a single command with every relevant flag explicit. It does not rely on ambient defaults that a reader of the result could not see.
- **Reporter is non-negotiable.** A machine-readable reporter is always present; the result's counts and per-test outcomes come from it, not from scraping human output.
- **Secrets never enter the command line.** Credentials are passed by environment-variable reference, never interpolated into the recorded command (the command is stored and shown).
- **No destructive flags.** The builder never adds flags that update snapshots, rewrite baselines, or delete artifacts; execution observes, it does not mutate the project.
- **Failure evidence is not optional.** A command that could not produce a screenshot for a failing test is an incomplete command; the floor above is part of the build, not a preference the run may drop.
- **Illustrative until launched.** The built command is presented in the plan before the run; the guardrails against claiming a run happened apply until the command has actually executed and returned.

## Extension

A new framework changes only the adapter's answers — base command, selection syntax, reporter and evidence flags. The builder's logic (which selection, which reporter, record verbatim) is unchanged. This is why adding a framework never touches the command-building step of any skill.
