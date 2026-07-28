#!/usr/bin/env python3
"""The single entry point for a skill's bundled deterministic tooling.

Every skill that carries an engine also carries a copy of this file at
`<skill>/scripts/qa_tool.py`, beside the `lib/` directory it dispatches into.

## Why this exists

The invocation used to be a shell recipe:

    QA_LIB="$(ls -d .agents/skills/qa-run/scripts/lib ... | head -1)"
    PYTHONPATH="$QA_LIB" python3 -m qa_analysis.cli junit report.xml

Three parts of that are POSIX-only — command substitution, `ls -d | head -1`, and
the `VAR=value command` prefix — so on Windows PowerShell every deterministic call
failed. Failing calls do not stop a skill; they push it onto its documented manual
fallback. The result was that Windows users silently got the *guessing* behaviour
this project exists to replace, while believing they had the tooling.

So the shell does no work at all now. This launcher finds its own `lib/`
directory from `__file__` and puts it on `sys.path` itself:

    python3 .agents/skills/qa-run/scripts/qa_tool.py analysis junit report.xml

That line is identical in bash, zsh, PowerShell, and cmd.exe. On Windows, use
`python` if `python3` is not on PATH — that is the only remaining difference.

## Usage

    qa_tool.py analysis    <subcommand> [args]   -> qa_analysis.cli
    qa_tool.py diagnostics <subcommand> [args]   -> qa_diagnostics.cli
    qa_tool.py playwright  <subcommand> [args]   -> playwright_analysis
    qa_tool.py --list                            what this skill bundles

Exit codes pass through from the underlying tool unchanged: 0 success, 1 an
invalid contract, 2 unreadable input or a payload that failed its contract.
"""

import os
import pathlib
import sys

_HERE = pathlib.Path(__file__).resolve().parent
_LIB = _HERE / "lib"

# Tool name -> (module path, callable). Resolved lazily so a skill that bundles
# only part of the toolkit still runs the parts it has.
_TOOLS = {
    "analysis": ("qa_analysis.cli", "main"),
    "diagnostics": ("qa_diagnostics.cli", "main"),
    "playwright": ("playwright_analysis", "main"),
}

_USAGE = """usage: qa_tool.py <tool> <subcommand> [args]

  analysis     parse artifacts, classify errors, validate contracts, diff-guard
  diagnostics  root cause, timeline, priority, repair plans
  playwright   normalize a Playwright report or summarize a trace

  --list       show which tools this skill bundles

examples:
  python3 qa_tool.py analysis junit test-results/results.xml
  python3 qa_tool.py analysis diff-guard change.diff
  python3 qa_tool.py diagnostics report --execution-result qa-artifacts/run.json
  python3 qa_tool.py playwright report test-results/results.json
"""


def _available():
    """Tools whose module is importable from this skill's bundled lib/."""
    found = []
    for name, (module, _) in _TOOLS.items():
        top = module.split(".")[0]
        if (_LIB / top).is_dir() or (_LIB / f"{top}.py").is_file():
            found.append(name)
    return found


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)

    if not _LIB.is_dir():
        sys.stderr.write(
            f"qa_tool: no bundled library at {_LIB}\n"
            "The skill's deterministic engine is missing. Run: qa repair --project .\n"
        )
        return 2

    # The bundled lib is authoritative: prepend so a same-named package installed
    # elsewhere on the machine cannot shadow the version that shipped with this skill.
    sys.path.insert(0, str(_LIB))

    if not argv or argv[0] in ("-h", "--help", "help"):
        sys.stdout.write(_USAGE)
        return 0

    if argv[0] == "--list":
        available = _available()
        sys.stdout.write(
            "bundled tools: " + (", ".join(available) if available else "none") + "\n"
        )
        return 0 if available else 2

    tool = argv[0]
    if tool not in _TOOLS:
        sys.stderr.write(f"qa_tool: unknown tool {tool!r}\n\n{_USAGE}")
        return 2

    module_name, entry = _TOOLS[tool]
    try:
        module = __import__(module_name, fromlist=[entry])
    except ImportError as exc:
        available = _available()
        sys.stderr.write(
            f"qa_tool: {tool} is not bundled in this skill ({exc}).\n"
            f"This skill bundles: {', '.join(available) if available else 'nothing'}\n"
        )
        return 2

    return getattr(module, entry)(argv[1:])


if __name__ == "__main__":
    # os.environ is untouched: the launcher never mutates the caller's environment.
    del os
    sys.exit(main())
