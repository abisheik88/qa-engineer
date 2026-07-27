#!/usr/bin/env python3
"""Enforce the stated Python support floor.

COMPATIBILITY.md promises the analysis toolkit runs on "any Python 3.8+
interpreter with nothing to install". Nothing checked that, and the hosted CI
runners no longer offer 3.8, so the promise was untested at its own boundary.

This gate closes it without needing an old interpreter: every shipped module is
parsed with `ast.parse(..., feature_version=(3, 8))`, which rejects syntax newer
than the floor (`match` statements, `X | Y` annotations, walrus in comprehension
positions 3.8 disallows, and so on). It also greps for standard-library APIs
added after 3.8, which the parser cannot see.

Syntax and known-API coverage is not a substitute for running the suite on 3.8 —
it is what can be verified reproducibly, and it is honest about which of the two
it is.

Run: python3 scripts/check-python-floor.py
"""

import ast
import pathlib
import re
import sys

FLOOR = (3, 8)
ROOT = pathlib.Path(__file__).resolve().parents[1]

# Directories whose Python ships to users or runs in CI.
INCLUDE = ("shared", "scripts", "tests")

# Standard-library APIs newer than the floor. Each entry is (pattern, added-in).
POST_FLOOR_APIS = (
    (re.compile(r"\bfunctools\.cache\b"), "3.9"),
    (re.compile(r"\bmath\.(lcm|nextafter|ulp)\b"), "3.9"),
    (re.compile(r"\bstr\.remove(prefix|suffix)\b|\.remove(prefix|suffix)\("), "3.9"),
    (re.compile(r"\bimport graphlib\b|\bgraphlib\."), "3.9"),
    (re.compile(r"\bimport zoneinfo\b|\bzoneinfo\."), "3.9"),
    (re.compile(r"\bdirs_exist_ok\s*="), "3.8 (shutil.copytree) — verify"),
    (re.compile(r"\bcached_property\b"), "3.8 — verify"),
    (re.compile(r"\bimportlib\.metadata\b"), "3.8 — verify"),
    (re.compile(r"\bdatetime\.fromisoformat\([^)]*\)\s*#\s*Z"), "3.11 for 'Z' suffix"),
    (re.compile(r"\bexcept\*"), "3.11"),
    (re.compile(r"\btomllib\b"), "3.11"),
    (re.compile(r"\bStrEnum\b"), "3.11"),
    (re.compile(r"\bitertools\.(pairwise|batched)\b"), "3.10"),
)


def python_files():
    for base in INCLUDE:
        for path in sorted((ROOT / base).rglob("*.py")):
            if "__pycache__" in path.parts:
                continue
            yield path


def main():
    problems = []
    checked = 0

    for path in python_files():
        rel = path.relative_to(ROOT)
        source = path.read_text(encoding="utf-8")
        checked += 1

        try:
            ast.parse(source, filename=str(rel), feature_version=FLOOR)
        except SyntaxError as exc:
            problems.append(
                f"{rel}:{exc.lineno}: syntax newer than Python "
                f"{FLOOR[0]}.{FLOOR[1]}: {exc.msg}"
            )

        for pattern, added in POST_FLOOR_APIS:
            match = pattern.search(source)
            if match:
                line = source[: match.start()].count("\n") + 1
                problems.append(
                    f"{rel}:{line}: uses {match.group(0)!r}, added in Python {added}"
                )

    if problems:
        print(f"python floor check failed (floor: {FLOOR[0]}.{FLOOR[1]}):", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1

    print(
        f"python floor OK: {checked} file(s) parse under "
        f"{FLOOR[0]}.{FLOOR[1]} with no post-floor stdlib APIs"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
