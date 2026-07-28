# shared/tooling/

The launcher that skills use to reach their bundled deterministic engine.

| File | Role |
| --- | --- |
| [qa_tool.py](qa_tool.py) | Copied into every bundling skill as `<skill>/scripts/qa_tool.py`. Resolves its own `lib/` directory and dispatches to `qa_analysis`, `qa_diagnostics`, or a framework adapter. |

## Why a launcher rather than a shell recipe

The invocation documented in each skill has to work in whatever shell the user's
AI assistant happens to run commands in. The previous recipe did not:

```bash
QA_LIB="$(ls -d .agents/skills/qa-run/scripts/lib ... | head -1)"
PYTHONPATH="$QA_LIB" python3 -m qa_analysis.cli junit report.xml
```

Command substitution, `ls -d | head -1`, and the `VAR=value command` prefix are all
POSIX-only, so on Windows PowerShell every deterministic call failed. A failed call
does not stop a skill — it falls back to its documented manual path and marks the
result degraded. Windows users therefore got the model-guessing behaviour this
project exists to replace, while believing the tooling was running.

The launcher moves that work out of the shell and into Python:

```bash
python3 .agents/skills/qa-run/scripts/qa_tool.py analysis junit report.xml
```

Identical in bash, zsh, PowerShell, and cmd.exe. The only remaining platform
difference is the interpreter name — `python` instead of `python3` where the
latter is not on PATH.

## Contract

- `qa_tool.py <tool> <subcommand> [args]`, where `<tool>` is `analysis`,
  `diagnostics`, or `playwright`.
- Exit codes pass through unchanged: `0` success, `1` an invalid contract,
  `2` unreadable input or a payload that failed its seam contract.
- Output passes through unchanged — JSON on stdout for every subcommand that
  produces it.
- A tool the skill does not bundle exits `2` and names what is available, rather
  than failing with an import traceback.

The launcher adds no behaviour of its own. It resolves a path and delegates, so
there is no second implementation of anything to keep in sync.

## Editing

This file is the source. Both bundlers — [scripts/bundle_python.py](../../scripts/bundle_python.py)
for development and [the installer](../../packages/installer/lib/core/bundle.mjs)
for consumers — copy it into each bundling skill, and `bundle_python.py --check`
executes it from a temporary bundle to prove it still works.
