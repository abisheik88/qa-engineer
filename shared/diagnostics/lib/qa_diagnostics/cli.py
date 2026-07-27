"""Unified CLI for the diagnostic engine.

The engine's reasoning is deterministic; this is how a skill reaches it. Every
subcommand reads JSON files, validates them against the internal seam contracts,
and writes JSON to stdout — so an agent never has to invent glue code, and the
input and output shapes are checked rather than assumed.

Mirrors `qa_analysis.cli` exactly: JSON to stdout, exit 0 on success, exit 2 on
bad input or usage. Standard library only.

Usage:
  python -m qa_diagnostics.cli diagnose --execution-result <path> [--analysis-result <path>]
  python -m qa_diagnostics.cli plan-repairs --diagnosis <path>
  python -m qa_diagnostics.cli summarize --execution-result <path> --diagnosis <path>
  python -m qa_diagnostics.cli report --execution-result <path> [--analysis-result <path>]

`report` is the one-shot path: it diagnoses, plans, and summarizes in a single
invocation, so the common case is one command instead of three.

Inputs
  --execution-result   a qa-run execution result (or the minimal subset:
                       `tests` counts plus `executed[]` with `status`)
  --analysis-result    an analysis result with `findings[]`; preferred over
                       `executed[]` when present
  --diagnosis          the object emitted by `diagnose`

Exit codes
  0  success
  2  unreadable file, malformed JSON, or a payload that fails its seam contract
"""

import argparse
import json
import sys

from . import engine
from . import internal_contracts
from .internal_contracts import InternalContractError


def _emit(obj):
    json.dump(obj, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")


def _read(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def _read_execution(path):
    """Read an execution result and hold it to the seam contract."""
    return internal_contracts.validate_execution_result_min(_read(path))


def _read_analysis(path):
    """Read an analysis result and hold it to the seam contract."""
    if path is None:
        return None
    return internal_contracts.validate_analysis_result(_read(path))


def _read_diagnosis(path):
    """Read a diagnosis and hold it to the seam contract."""
    return internal_contracts.validate_diagnosis(_read(path))


def main(argv=None):
    parser = argparse.ArgumentParser(
        prog="qa-diagnostics",
        description="Deterministic diagnostic engine: root cause, timeline, priority, repairs",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("diagnose", help="root causes, timeline, prioritization, recommendations")
    p.add_argument("--execution-result", required=True)
    p.add_argument("--analysis-result")

    p = sub.add_parser("plan-repairs", help="repair plans for a diagnosis (never code)")
    p.add_argument("--diagnosis", required=True)

    p = sub.add_parser("summarize", help="totals, breakdown, top priorities, release readiness")
    p.add_argument("--execution-result", required=True)
    p.add_argument("--diagnosis", required=True)

    p = sub.add_parser("report", help="diagnose + plan-repairs + summarize in one call")
    p.add_argument("--execution-result", required=True)
    p.add_argument("--analysis-result")

    args = parser.parse_args(argv)

    try:
        if args.command == "diagnose":
            execution = _read_execution(args.execution_result)
            analysis = _read_analysis(args.analysis_result)
            _emit(engine.diagnose(execution, analysis))
        elif args.command == "plan-repairs":
            _emit({"plans": engine.plan_repairs(_read_diagnosis(args.diagnosis))})
        elif args.command == "summarize":
            _emit(engine.summarize(_read_execution(args.execution_result),
                                   _read_diagnosis(args.diagnosis)))
        elif args.command == "report":
            execution = _read_execution(args.execution_result)
            analysis = _read_analysis(args.analysis_result)
            diagnosis = engine.diagnose(execution, analysis)
            _emit({
                "diagnosis": diagnosis,
                "plans": engine.plan_repairs(diagnosis),
                "summary": engine.summarize(execution, diagnosis),
            })
    except InternalContractError as exc:
        _emit({"error": "invalid-payload", "detail": str(exc)})
        return 2
    except (OSError, json.JSONDecodeError) as exc:
        _emit({"error": "io-error", "detail": str(exc)})
        return 2
    except (KeyError, TypeError) as exc:
        _emit({"error": "unexpected-shape", "detail": f"{type(exc).__name__}: {exc}"})
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
