#!/usr/bin/env python3
"""Live-agent evaluation runner.

Runs a real (or replayed) AI agent against evaluation *scenarios*, feeds each
produced output into the **frozen deterministic scorer** ([`run_evals.py`](run_evals.py)),
and reports behavioral quality with regression detection. This is the live layer
that sits on top of the deterministic gate; it does not modify or replace it —
`score_case` is imported and used unchanged.

Design (see docs/evaluation-platform.md):

- **Provider-agnostic.** A *provider* turns a scenario into an output artifact.
  Two ship here, neither vendor-locked:
    - `replay`   — read a recorded output from `captures/<set>/`. Deterministic,
                   needs no API keys, runs in CI, and makes every run reproducible.
    - `command`  — run any agent CLI (`--command "..."`), templated with the
                   scenario, and read its JSON output. This is how a real agent
                   (Claude Code headless, Codex, Gemini, …) plugs in.
- **Deterministic vs judgment, separated.** The gate is the deterministic score
  (contract validity + assertions), computed by the frozen scorer. Model-judgment
  (rubric) metrics are advisory only and reported in a separate section; they
  never gate. (The rubric hook is defined but no judge ships here.)
- **Reproducible artifacts.** Every run can write a full record (input, produced
  output, per-assertion result) via `--report`. The committed baseline holds only
  the pass/score per scenario, so regression comparison is deterministic.
- **Regression detection.** `--baseline <file>` fails if any scenario that passed
  in the baseline now fails, or any score drops.

Usage:
  python3 tests/evals/run_live.py                                  # replay:reference (CI default)
  python3 tests/evals/run_live.py --baseline tests/evals/baselines/reference.json
  python3 tests/evals/run_live.py --provider command --command 'my-agent --skill {skill} --request {request}'
  python3 tests/evals/run_live.py --emit-baseline tests/evals/baselines/reference.json
"""

import argparse
import json
import pathlib
import shlex
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import run_evals  # noqa: E402  (frozen deterministic scorer — reused unchanged)

SCORE_EPSILON = 1e-9


# --- providers ---------------------------------------------------------------

def provider_replay(scenario, captures_set):
    """Read a recorded output for this scenario. Deterministic and key-free."""
    rel = scenario["id"] + ".json"
    path = HERE / "captures" / captures_set / rel
    if not path.exists():
        return None, f"no capture at captures/{captures_set}/{rel}"
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh), f"replay:{captures_set}"
    except json.JSONDecodeError as exc:
        return None, f"capture is not valid JSON: {exc}"


def provider_command(scenario, command_tmpl):
    """Run any agent CLI, templated with the scenario, and parse its JSON output.

    Tokens: {skill} {id} {request} {fixture} {contract} {prompt}. The command
    must print the skill's output artifact as JSON to stdout.
    """
    inp = scenario.get("input", {})
    subs = {
        "skill": scenario.get("skill", ""),
        "id": scenario.get("id", ""),
        "request": inp.get("request", ""),
        "fixture": inp.get("fixture", ""),
        "contract": scenario.get("contract", ""),
        "prompt": inp.get("prompt", inp.get("request", "")),
    }
    try:
        argv = [seg.format(**subs) for seg in shlex.split(command_tmpl)]
    except (KeyError, ValueError) as exc:
        return None, f"bad --command template: {exc}"
    try:
        proc = subprocess.run(argv, capture_output=True, text=True, timeout=600)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return None, f"agent command failed to run: {exc}"
    if proc.returncode != 0:
        return None, f"agent command exited {proc.returncode}: {proc.stderr.strip()[:200]}"
    try:
        return json.loads(proc.stdout), "command"
    except json.JSONDecodeError:
        return None, "agent output was not valid JSON on stdout"


# --- scenario running --------------------------------------------------------

def discover(skill_filter=None):
    scenarios = []
    for path in sorted(HERE.glob("scenarios/*/*.scenario.json")):
        with open(path, "r", encoding="utf-8") as fh:
            sc = json.load(fh)
        sc.setdefault("id", f"{path.parent.name}/{path.stem}")
        if skill_filter and sc.get("skill") != skill_filter:
            continue
        scenarios.append(sc)
    return scenarios


def run_scenario(scenario, produce):
    """Produce an output via the provider and score it with the frozen scorer."""
    output, note = produce(scenario)
    if output is None:
        return {
            "id": scenario["id"], "skill": scenario["skill"],
            "category": scenario.get("category", "golden"),
            "passed": False, "errored": True, "score": 0.0,
            "contractValid": False, "assertions": "0/0",
            "detail": [note], "provider": note,
        }
    # Build a case the FROZEN scorer understands. A live scenario always expects a
    # GOOD output (kind=golden): the agent must produce a contract-valid result
    # that satisfies the good-behavior assertions — including when the request is
    # a temptation to misbehave.
    case = {
        "id": scenario["id"],
        "skill": scenario["skill"],
        "kind": "golden",
        "contract": scenario["contract"],
        "assertions": scenario.get("assertions", []),
        "minConfidence": scenario.get("minConfidence"),
        "output": output,
    }
    if case["minConfidence"] is None:
        del case["minConfidence"]
    scored = run_evals.score_case(case)
    scored["category"] = scenario.get("category", "golden")
    scored["errored"] = False
    scored["provider"] = note
    return scored


def build_report(results, provider_label):
    by_skill = {}
    for r in results:
        s = by_skill.setdefault(r["skill"], {"passed": 0, "total": 0})
        s["total"] += 1
        s["passed"] += 1 if r["passed"] else 0
    passed = sum(1 for r in results if r["passed"])
    return {
        "provider": provider_label,
        "totals": {
            "scenarios": len(results),
            "passed": passed,
            "failed": len(results) - passed,
            "errored": sum(1 for r in results if r.get("errored")),
            "golden": sum(1 for r in results if r["category"] == "golden"),
            "adversarial": sum(1 for r in results if r["category"] == "adversarial"),
        },
        "bySkill": by_skill,
        "scenarios": [
            {k: r[k] for k in ("id", "skill", "category", "passed", "score", "contractValid", "assertions", "detail")}
            for r in results
        ],
    }


def compare_baseline(report, baseline):
    """Return a list of regression strings (empty = no regression)."""
    base = {s["id"]: s for s in baseline.get("scenarios", [])}
    regressions = []
    for s in report["scenarios"]:
        b = base.get(s["id"])
        if b is None:
            continue  # new scenario — not a regression
        if b["passed"] and not s["passed"]:
            regressions.append(f"{s['id']}: passed in baseline, now FAILS ({'; '.join(s['detail']) or 'assertion/contract'})")
        elif s["score"] + SCORE_EPSILON < b["score"]:
            regressions.append(f"{s['id']}: score dropped {b['score']} -> {s['score']}")
    return regressions


def baseline_shape(report):
    """The minimal, timestamp-free baseline: pass/score per scenario."""
    return {
        "provider": report["provider"],
        "scenarios": [{"id": s["id"], "passed": s["passed"], "score": s["score"]} for s in report["scenarios"]],
    }


def main():
    p = argparse.ArgumentParser(description="Live-agent evaluation runner")
    p.add_argument("--provider", choices=["replay", "command"], default="replay")
    p.add_argument("--captures", default="reference", help="capture set for the replay provider")
    p.add_argument("--command", help="agent CLI template for the command provider")
    p.add_argument("--skill", help="only run scenarios for this skill")
    p.add_argument("--baseline", help="compare against this baseline and fail on regression")
    p.add_argument("--emit-baseline", help="write the current results as a baseline file")
    p.add_argument("--report", help="write the full run report (artifact) to this file")
    p.add_argument("--json", action="store_true", help="print the full report as JSON")
    args = p.parse_args()

    if args.provider == "command":
        if not args.command:
            print("error: --provider command requires --command", file=sys.stderr)
            return 2
        provider_label = "command"
        produce = lambda sc: provider_command(sc, args.command)  # noqa: E731
    else:
        provider_label = f"replay:{args.captures}"
        produce = lambda sc: provider_replay(sc, args.captures)  # noqa: E731

    scenarios = discover(args.skill)
    results = [run_scenario(sc, produce) for sc in scenarios]
    report = build_report(results, provider_label)

    if args.report:
        with open(args.report, "w", encoding="utf-8") as fh:
            json.dump(report, fh, indent=2)
    if args.emit_baseline:
        with open(args.emit_baseline, "w", encoding="utf-8") as fh:
            json.dump(baseline_shape(report), fh, indent=2)
            fh.write("\n")
        print(f"wrote baseline: {args.emit_baseline}")

    regressions = []
    if args.baseline:
        with open(args.baseline, "r", encoding="utf-8") as fh:
            regressions = compare_baseline(report, json.load(fh))

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        for r in results:
            mark = "ok  " if r["passed"] else ("ERR " if r.get("errored") else "FAIL")
            print(f"  {mark} [{r['category']:11}] {r['id']:34} provider={r['provider']:16} assertions={r['assertions']}")
            for d in r["detail"]:
                print(f"         - {d}")
        t = report["totals"]
        print()
        print(f"run-live [{provider_label}]: {t['passed']}/{t['scenarios']} scenarios passed "
              f"({t['golden']} golden, {t['adversarial']} adversarial, {t['errored']} errored)")
        if args.baseline:
            if regressions:
                print(f"\nREGRESSIONS vs baseline ({len(regressions)}):")
                for r in regressions:
                    print(f"  - {r}")
            else:
                print("no regressions vs baseline.")

    failed = report["totals"]["failed"] > 0
    return 1 if (failed or regressions) else 0


if __name__ == "__main__":
    raise SystemExit(main())
