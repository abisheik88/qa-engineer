#!/usr/bin/env python3
"""Deterministic behavioral-evaluation harness.

Scores skill outputs against their contracts and case-specific assertions. It is
the CI-gating, deterministic layer of the eval framework described in
[README.md](README.md): "deterministic assertions gate; judgment is advisory."

Two kinds of case:

- **golden** — an output that represents correct behavior. It MUST validate
  against the skill's contract and satisfy every assertion. A golden case that
  stops passing is a regression.
- **adversarial** — an output that represents a failure mode the pack promises to
  prevent (a run reported "passed" with a non-zero exit code; a "fix" that
  removes an assertion; a report that says "ready" with failing tests). The
  scorer MUST reject it — contract-invalid or an assertion must fail. An
  adversarial output that slips through is a scorer blind spot, and fails CI.

This layer needs no live agent, so it runs deterministically in CI. When a live
agent runner is added (it captures real agent output for the same cases), it
feeds those outputs into this same scorer — the cases and assertions do not
change.

Standard-library only. Reuses the pack's contract validator
(`shared/analysis/lib/qa_analysis/contracts.py`) — no second schema engine.

Usage:
  python3 tests/evals/run_evals.py            # run all cases, gate on failure
  python3 tests/evals/run_evals.py --json      # machine-readable report to stdout
  python3 tests/evals/run_evals.py --skill qa-run   # filter to one skill
"""

import argparse
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent          # tests/evals
REPO = HERE.parents[1]                                   # repo root
sys.path.insert(0, str(REPO / "shared" / "analysis" / "lib"))

from qa_analysis import contracts  # noqa: E402  (path set above)

MISSING = object()


def resolve(value, path):
    """Resolve a dotted path (dict keys and integer list indices) or MISSING."""
    if path == "":
        return value
    cur = value
    for seg in path.split("."):
        if isinstance(cur, list):
            try:
                idx = int(seg)
            except ValueError:
                return MISSING
            if idx < 0 or idx >= len(cur):
                return MISSING
            cur = cur[idx]
        elif isinstance(cur, dict):
            if seg not in cur:
                return MISSING
            cur = cur[seg]
        else:
            return MISSING
    return cur


def check_assertion(output, a):
    """Return (ok, message) for one assertion against the output."""
    # anyOf: passes if any sub-assertion passes. Lets a case express implications
    # like "reported passed  =>  exit code 0" as
    # {"anyOf": [{"path": "classification", "notEquals": "passed"},
    #            {"path": "execution.exitCode", "equals": 0}]}.
    if "anyOf" in a:
        results = [check_assertion(output, s) for s in a["anyOf"]]
        ok = any(r[0] for r in results)
        return ok, "anyOf unsatisfied: " + "; ".join(m for o, m in results if not o)

    path = a.get("path", "")
    actual = resolve(output, path)

    if "present" in a:
        ok = (actual is not MISSING and actual not in (None, "", [], {})) == bool(a["present"])
        return ok, f"{path}: present expected {a['present']}, got {'absent' if actual is MISSING else 'present'}"
    if "absent" in a:
        absent = actual is MISSING or actual in (None, "", [], {})
        return absent == bool(a["absent"]), f"{path}: absent expected {a['absent']}"

    if actual is MISSING:
        return False, f"{path}: path not found"

    if "equals" in a:
        return actual == a["equals"], f"{path}: expected {a['equals']!r}, got {actual!r}"
    if "notEquals" in a:
        return actual != a["notEquals"], f"{path}: must not equal {a['notEquals']!r}"
    if "in" in a:
        return actual in a["in"], f"{path}: {actual!r} not in {a['in']}"
    if "gte" in a:
        return isinstance(actual, (int, float)) and actual >= a["gte"], f"{path}: {actual!r} not >= {a['gte']}"
    if "lte" in a:
        return isinstance(actual, (int, float)) and actual <= a["lte"], f"{path}: {actual!r} not <= {a['lte']}"
    if "minItems" in a:
        return isinstance(actual, list) and len(actual) >= a["minItems"], f"{path}: fewer than {a['minItems']} items"
    if "contains" in a:
        return isinstance(actual, str) and a["contains"].lower() in actual.lower(), f"{path}: does not contain {a['contains']!r}"
    if "notContains" in a:
        text = actual if isinstance(actual, str) else json.dumps(actual)
        return a["notContains"].lower() not in text.lower(), f"{path}: must not contain {a['notContains']!r}"
    if "noneContains" in a:
        # For arrays of strings: no element may contain the substring.
        needle = a["noneContains"].lower()
        items = actual if isinstance(actual, list) else [actual]
        bad = [x for x in items if isinstance(x, str) and needle in x.lower()]
        return not bad, f"{path}: an item contains forbidden {a['noneContains']!r}: {bad}"

    return False, f"{path}: unknown assertion {a}"


def load_output(case):
    """The output under test: inline `output`, or loaded from `goldenFile`."""
    if "output" in case:
        return case["output"]
    ref = case["goldenFile"]
    with open(HERE / ref, "r", encoding="utf-8") as fh:
        return json.load(fh)


def score_case(case):
    """Evaluate one case. Returns a result dict."""
    skill = case["skill"]
    kind = case.get("kind", "golden")
    output = load_output(case)

    schema = contracts.load_schema(REPO / case["contract"])
    contract_ok, contract_errors = contracts.validate(output, schema)

    assertions = list(case.get("assertions", []))
    if "minConfidence" in case:
        assertions.append({"path": "confidence", "gte": case["minConfidence"]})

    checks = [(a, *check_assertion(output, a)) for a in assertions]
    assertions_passed = sum(1 for _, ok, _ in checks if ok)
    assertions_total = len(checks)
    failures = [msg for _, ok, msg in checks if not ok]

    # A "good" output = valid contract AND all assertions hold.
    good = contract_ok and not failures

    if kind == "golden":
        passed = good
        score = (1.0 if contract_ok else 0.0) * (assertions_passed / assertions_total if assertions_total else 1.0)
        detail = failures if failures else (contract_errors if not contract_ok else [])
    elif kind == "adversarial":
        # The scorer must REJECT this output.
        passed = not good
        score = 1.0 if passed else 0.0
        detail = [] if passed else ["scorer accepted an output it should have rejected"]
    else:
        return {"id": case.get("id"), "skill": skill, "kind": kind, "passed": False,
                "score": 0.0, "detail": [f"unknown kind {kind!r}"]}

    return {
        "id": case.get("id", "?"),
        "skill": skill,
        "kind": kind,
        "passed": passed,
        "score": round(score, 3),
        "contractValid": contract_ok,
        "assertions": f"{assertions_passed}/{assertions_total}",
        "detail": detail,
    }


def discover(skill_filter=None):
    cases = []
    paths = list(HERE.glob("*/*.case.json")) + list(HERE.glob("safety/**/*.case.json"))
    seen = set()
    for path in sorted(paths, key=lambda p: str(p)):
        if path in seen:
            continue
        seen.add(path)
        with open(path, "r", encoding="utf-8") as fh:
            case = json.load(fh)
        case.setdefault("id", path.stem)
        if skill_filter and case.get("skill") != skill_filter:
            continue
        cases.append(case)
    return cases


def main():
    parser = argparse.ArgumentParser(description="Deterministic behavioral eval harness")
    parser.add_argument("--json", action="store_true", help="emit a machine-readable report")
    parser.add_argument("--skill", help="only run cases for this skill")
    args = parser.parse_args()

    cases = discover(args.skill)
    results = [score_case(c) for c in cases]

    by_skill = {}
    for r in results:
        by_skill.setdefault(r["skill"], {"passed": 0, "total": 0})
        by_skill[r["skill"]]["total"] += 1
        by_skill[r["skill"]]["passed"] += 1 if r["passed"] else 0

    passed = sum(1 for r in results if r["passed"])
    total = len(results)
    golden = sum(1 for r in results if r["kind"] == "golden")
    adversarial = sum(1 for r in results if r["kind"] == "adversarial")

    report = {
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "golden": golden,
        "adversarial": adversarial,
        "bySkill": by_skill,
        "cases": results,
    }

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        for r in results:
            mark = "ok  " if r["passed"] else "FAIL"
            print(f"  {mark} [{r['kind']:11}] {r['id']:34} contract={'ok' if r['contractValid'] else 'invalid':7} assertions={r['assertions']}")
            for d in r["detail"]:
                print(f"         - {d}")
        print()
        print(f"run-evals: {passed}/{total} cases passed "
              f"({golden} golden, {adversarial} adversarial) across {len(by_skill)} skill(s)")

    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
