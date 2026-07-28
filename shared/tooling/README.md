# shared/tooling/

The launcher that skills use to reach the deterministic engine.

| File | Role |
| --- | --- |
| [qa-tool.mjs](qa-tool.mjs) | Committed into every bundling skill as `<skill>/scripts/qa-tool.mjs` (kept in step by `sync-shared`), and copied there again by the installer. Finds the engine and dispatches to it. |

## Why a launcher rather than a direct path

Each skill documents exactly one command:

```bash
node <skill-dir>/scripts/qa-tool.mjs analysis junit report.xml
```

and the launcher works out where the engine actually is, because the pack is
installed three different ways and the engine lands somewhere different each time:

| Install path | Engine found at | Cost |
| --- | --- | --- |
| `npx qa-engineer install` | `<skill>/scripts/lib/` — bundled | offline, fastest, pinned to the installed version |
| `npx skills add <owner>/<repo>`, or any file copier | `node_modules/qa-engineer/` when the project depends on the pack | offline |
| neither | `npx qa-engineer engine …` | network on first use, npm cache after |

`node qa-tool.mjs --where` reports which one answered, because "the engine is
missing" and "the engine is being fetched" are different problems with different
fixes.

That this file is **committed** rather than generated is what makes the second row
work at all — and that row is the wider Agent Skills ecosystem, where a repository
of skills is expected to be usable by copying it.

## What this replaced, twice

The first invocation contract was a shell recipe:

```bash
QA_LIB="$(ls -d .agents/skills/qa-run/scripts/lib ... | head -1)"
PYTHONPATH="$QA_LIB" python3 -m qa_analysis.cli junit report.xml
```

Command substitution, `ls -d | head -1`, and the `VAR=value command` prefix are all
POSIX-only, so on Windows PowerShell every deterministic call failed. A failed call
does not stop a skill — it falls back to its documented manual path and marks the
result degraded. Windows users therefore got the model-guessing behaviour this
project exists to replace, while believing the tooling was running.

The second was a Python launcher. Portable across shells, but it needed a Python
interpreter: a second runtime, required of every user, for an engine they had
installed with Node. `python3` is not on PATH on Windows by default, and the failure
mode was the same silent degradation. [ADR-0012](../../docs/architecture/ADR-0012-node-engine.md)
records why the engine moved to Node instead.

## Contract

- `node qa-tool.mjs <tool> <subcommand> [args]`, where `<tool>` is `analysis`,
  `diagnostics`, or `playwright`.
- Exit codes pass through unchanged: `0` success, `1` an invalid contract,
  `2` unreadable input, bad usage, or a payload that failed its seam contract.
- Output passes through unchanged — JSON on stdout for every subcommand that
  produces it.
- When no engine can be reached at all, it names the path it tried and what to run,
  rather than failing with a module-resolution traceback.

The launcher adds no behaviour of its own. It resolves a location and delegates, so
there is no second implementation of anything to keep in sync.

## Editing

This file is the source. `node scripts/sync-shared.mjs --write` refreshes the
committed copy in each skill and `--check` fails if one has drifted; the
[installer](../../packages/installer/lib/core/bundle.mjs) copies it alongside the
bundled engine at install time.
