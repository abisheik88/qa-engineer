"""Unified CLI for the analysis core.

Every analyzer is reachable as a subcommand that writes JSON to stdout, so the
toolkit is usable from a shell, from CI, and (once bundled) by a skill. Exit
code 0 on success, 2 on a malformed artifact or bad usage.

Usage:
  python -m qa_analysis.cli junit <path>
  python -m qa_analysis.cli har <path> [--slow-ms N]
  python -m qa_analysis.cli discover [--root DIR] [--path P ...]
  python -m qa_analysis.cli diff-guard <diff-file>
  python -m qa_analysis.cli redact <file>
  python -m qa_analysis.cli validate <instance.json> <schema.json>
  python -m qa_analysis.cli classify "<error message>" [--http-status N]
  python -m qa_analysis.cli context [--root DIR] [--path .qa/context.md]
  python -m qa_analysis.cli branding [--format html|markdown|text]
"""

import argparse
import json
import pathlib
import sys

from . import junit, har, discovery, diff_guard, redaction, contracts, taxonomy
from . import branding as branding_module
from . import context as context_module
from .context import MalformedContext
from .junit import MalformedArtifact

_SCHEMA_DIR_CANDIDATES = (
    # Repository layout: shared/analysis/lib/qa_analysis -> shared/analysis/schemas
    pathlib.Path(__file__).resolve().parents[2] / "schemas",
    # Bundled layout: package data travels with the package.
    pathlib.Path(__file__).resolve().parent / "schemas",
)


def _context_schema():
    """The context contract, in whichever layout this package is running from."""
    for base in _SCHEMA_DIR_CANDIDATES:
        candidate = base / "context.schema.json"
        if candidate.is_file():
            return contracts.load_schema(candidate)
    return None


def _emit(obj):
    json.dump(obj, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")


def main(argv=None):
    parser = argparse.ArgumentParser(prog="qa-analysis", description="Deterministic QA analysis toolkit")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("junit"); p.add_argument("path")
    p = sub.add_parser("har"); p.add_argument("path"); p.add_argument("--slow-ms", type=int, default=1000)
    p = sub.add_parser("discover"); p.add_argument("--root", default="."); p.add_argument("--path", action="append", default=[])
    p = sub.add_parser("diff-guard"); p.add_argument("path")
    p = sub.add_parser("redact"); p.add_argument("path")
    p = sub.add_parser("validate"); p.add_argument("instance"); p.add_argument("schema")
    p = sub.add_parser("classify"); p.add_argument("message"); p.add_argument("--http-status", type=int, default=None)
    p = sub.add_parser("context"); p.add_argument("--root", default="."); p.add_argument("--path", default=None)
    p = sub.add_parser("branding")
    p.add_argument("--format", default="text", choices=list(branding_module.FORMATS) + ["pdf", "md", "txt"])
    p.add_argument("--metadata", action="store_true", help="emit the branding metadata as JSON instead")

    args = parser.parse_args(argv)

    try:
        if args.command == "junit":
            _emit(junit.parse_junit(args.path))
        elif args.command == "har":
            _emit(har.parse_har(args.path, slow_ms=args.slow_ms))
        elif args.command == "discover":
            result = discovery.discover(root=args.root, explicit=args.path or None)
            _emit({k: [a.to_dict() if hasattr(a, "to_dict") else a for a in v] for k, v in result.items()})
        elif args.command == "diff-guard":
            with open(args.path, "r", encoding="utf-8") as handle:
                issues = diff_guard.check_diff(handle.read())
            _emit({"issues": issues, "safe": not any(i["severity"] == "high" for i in issues)})
        elif args.command == "redact":
            with open(args.path, "r", encoding="utf-8") as handle:
                sys.stdout.write(redaction.redact_text(handle.read()))
        elif args.command == "validate":
            with open(args.instance, "r", encoding="utf-8") as handle:
                instance = json.load(handle)
            ok, errors = contracts.validate(instance, contracts.load_schema(args.schema))
            _emit({"valid": ok, "errors": errors})
            return 0 if ok else 1
        elif args.command == "classify":
            classification, confidence, reason = taxonomy.classify(args.message, http_status=args.http_status)
            _emit({"classification": classification, "confidence": confidence, "reason": reason})
        elif args.command == "context":
            path = args.path or str(pathlib.Path(args.root) / ".qa" / "context.md")
            schema = _context_schema()
            parsed = context_module.parse_file(path, schema=schema)
            _emit({
                "path": path,
                "context": parsed["context"],
                "valid": parsed["valid"],
                "errors": parsed["errors"],
                "schemaChecked": schema is not None,
            })
            return 0 if parsed["valid"] else 1
        elif args.command == "branding":
            # Written to stdout verbatim, not as JSON: the caller pastes this into
            # a rendered report, so it must be the exact bytes to embed.
            if args.metadata:
                _emit(branding_module.metadata())
            else:
                sys.stdout.write(branding_module.footer(args.format))
    except branding_module.BrandingError as exc:
        _emit({"error": "branding-error", "detail": str(exc)})
        return 2
    except MalformedContext as exc:
        _emit({"error": "malformed-context", "detail": str(exc)})
        return 2
    except MalformedArtifact as exc:
        _emit({"error": "malformed-artifact", "detail": str(exc)})
        return 2
    except (OSError, json.JSONDecodeError) as exc:
        _emit({"error": "io-error", "detail": str(exc)})
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
