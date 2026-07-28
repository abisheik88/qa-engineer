#!/usr/bin/env python3
"""Bundle the shared Python code into the skills that depend on it.

Diagnostic and execution skills run deterministic tooling in the consumer's
repository, so that code must travel with the skill (self-containment). This
tool materializes it into each skill's scripts/lib/ from the canonical source in
shared/. The canonical source is the single point of truth; the bundled copies
are a build artifact (git-ignored) that the installer produces.

Three kinds of payload:

- **packages** — importable directories (`qa_analysis`, `qa_diagnostics`).
- **package data** — non-Python files a package reads at runtime. The
  diagnostics engine validates every diagnosis against its internal schemas, so
  those schemas must be bundled or the engine cannot run at all.
- **modules** — single-file framework adapters (`playwright_analysis`), bundled
  flat so `import playwright_analysis` resolves the same way in the repository
  and in an installed skill.

  python3 scripts/bundle_python.py --check   verify each skill bundles and RUNS
  python3 scripts/bundle_python.py --write    materialize scripts/lib/ in each skill

--check bundles into a temporary directory, executes the engine from there with
only that directory on PYTHONPATH, and discards it — proving the skill is
self-contained. Importing is not enough: a missing data file only surfaces when
the code runs. CI runs --check.
"""

import argparse
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]

PACKAGE_SOURCES = {
    "qa_analysis": ROOT / "shared/analysis/lib/qa_analysis",
    "qa_diagnostics": ROOT / "shared/diagnostics/lib/qa_diagnostics",
}

# Non-Python files a bundled package reads at runtime, as
# (source dir, destination relative to the package root).
PACKAGE_DATA = {
    # The context CLI validates .qa/context.md against the context contract.
    "qa_analysis": [
        (ROOT / "shared/analysis/schemas", "schemas"),
    ],
    "qa_diagnostics": [
        (ROOT / "shared/diagnostics/schemas/internal", "schemas/internal"),
    ],
}

# Single-file framework adapters, bundled flat next to the packages.
MODULE_SOURCES = {
    "playwright_analysis": ROOT / "shared/frameworks/playwright/lib/playwright_analysis.py",
}

# The launcher every bundling skill carries, one level above lib/. It resolves its
# own lib/ path, so the documented invocation needs no shell features and works
# identically on Windows.
LAUNCHER_SOURCE = ROOT / "shared/tooling/qa_tool.py"

# Which skills bundle what. qa-review is knowledge-only (it reviews code by
# judgment against the knowledge base) and bundles nothing.
MANIFEST = {
    "qa-init": {"packages": ["qa_analysis"], "modules": []},
    "qa-run": {"packages": ["qa_analysis"], "modules": ["playwright_analysis"]},
    "qa-debug": {"packages": ["qa_analysis", "qa_diagnostics"], "modules": ["playwright_analysis"]},
    "qa-fix": {"packages": ["qa_analysis", "qa_diagnostics"], "modules": []},
    "qa-report": {"packages": ["qa_analysis", "qa_diagnostics"], "modules": []},
    "qa-flaky": {"packages": ["qa_analysis", "qa_diagnostics"], "modules": []},
    "qa-api": {"packages": ["qa_analysis", "qa_diagnostics"], "modules": []},
    "qa-audit": {"packages": ["qa_analysis", "qa_diagnostics"], "modules": []},
}

_IGNORE = shutil.ignore_patterns("__pycache__", "*.pyc")


def _copy_package(name, dest_dir):
    src = PACKAGE_SOURCES[name]
    if not src.exists():
        raise FileNotFoundError(f"source package missing: {src}")
    shutil.copytree(src, dest_dir / name, ignore=_IGNORE)
    for data_src, data_rel in PACKAGE_DATA.get(name, []):
        if not data_src.exists():
            raise FileNotFoundError(f"package data missing: {data_src}")
        shutil.copytree(data_src, dest_dir / name / data_rel, ignore=_IGNORE)


def _copy_module(name, dest_dir):
    src = MODULE_SOURCES[name]
    if not src.exists():
        raise FileNotFoundError(f"source module missing: {src}")
    shutil.copyfile(src, dest_dir / src.name)


def _copy_launcher(scripts_dir):
    if not LAUNCHER_SOURCE.exists():
        raise FileNotFoundError(f"launcher missing: {LAUNCHER_SOURCE}")
    shutil.copyfile(LAUNCHER_SOURCE, scripts_dir / LAUNCHER_SOURCE.name)


def _materialize(entry, lib):
    for name in entry["packages"]:
        _copy_package(name, lib)
    for name in entry["modules"]:
        _copy_module(name, lib)
    # The launcher sits beside lib/, not inside it.
    _copy_launcher(lib.parent)


def _payload_names(entry):
    return entry["packages"] + entry["modules"]


# Executed inside the bundle with only the bundle on PYTHONPATH. Proves the
# code RUNS there, not merely that it imports.
_SMOKE = r"""
import json, sys, tempfile, pathlib
payloads = json.loads(sys.argv[1])

if "qa_analysis" in payloads:
    from qa_analysis import taxonomy, redaction, diff_guard, contracts
    from qa_analysis import cli as analysis_cli
    assert taxonomy.classify("no such element: #cart")[0]
    assert "REDACTED" in redaction.redact_text("password: hunter2")
    assert diff_guard.check_diff("--- a/t.spec.ts\n+++ b/t.spec.ts\n-expect(a).toBe(1)\n")
    ok, _ = contracts.validate({"a": 1}, {"type": "object", "required": ["a"]})
    assert ok
    # The context contract must be reachable from the bundle, or `context`
    # silently degrades to a parse with no validation.
    assert analysis_cli._context_schema() is not None, "context schema not bundled"

if "qa_diagnostics" in payloads:
    from qa_diagnostics import engine
    from qa_diagnostics import cli as diag_cli
    execution = {
        "tests": {"total": 1, "passed": 0, "failed": 1, "skipped": 0},
        "executed": [{"title": "checkout", "status": "failed",
                      "message": "locator not found: #cart",
                      "file": "tests/checkout.spec.ts", "retries": 0}],
    }
    diagnosis = engine.diagnose(execution)
    assert diagnosis["entries"], "engine produced no diagnosis entries"
    plans = engine.plan_repairs(diagnosis)
    assert plans, "engine produced no repair plans"
    summary = engine.summarize(execution, diagnosis)
    assert summary["releaseReadiness"], "engine produced no readiness verdict"
    # The documented CLI path must work from the bundle too.
    with tempfile.TemporaryDirectory() as tmp:
        p = pathlib.Path(tmp) / "execution-result.json"
        p.write_text(json.dumps(execution), encoding="utf-8")
        assert diag_cli.main(["report", "--execution-result", str(p)]) == 0

if "playwright_analysis" in payloads:
    import playwright_analysis
    with tempfile.TemporaryDirectory() as tmp:
        report = pathlib.Path(tmp) / "results.json"
        report.write_text(json.dumps({"suites": [{"file": "a.spec.ts", "specs": [
            {"title": "t", "tests": [{"results": [{"status": "passed", "duration": 1}]}]}]}]}),
            encoding="utf-8")
        parsed = playwright_analysis.parse_report(str(report))
    assert parsed["tests"]["passed"] == 1, parsed
"""


def write():
    for skill, entry in MANIFEST.items():
        lib = ROOT / "skills" / skill / "scripts" / "lib"
        if lib.exists():
            shutil.rmtree(lib)
        lib.mkdir(parents=True)
        _materialize(entry, lib)
        print(f"bundled {', '.join(_payload_names(entry))} -> skills/{skill}/scripts/lib/")
    return 0


def check():
    status = 0
    for skill, entry in MANIFEST.items():
        names = _payload_names(entry)
        with tempfile.TemporaryDirectory() as tmp:
            lib = pathlib.Path(tmp) / "lib"
            lib.mkdir()
            try:
                _materialize(entry, lib)
            except FileNotFoundError as exc:
                print(f"FAIL {skill}: {exc}")
                status = 1
                continue
            # Run the bundled code using only the bundled directory, so this
            # proves the skill is self-contained (no dependency on shared/).
            result = subprocess.run(
                [sys.executable, "-c", _SMOKE, json.dumps(names)],
                env={"PYTHONPATH": str(lib), "PATH": ""},
                capture_output=True, text=True,
            )
            if result.returncode == 0:
                # The launcher is what skills actually invoke, and it must work with
                # NO PYTHONPATH set — that is the whole point of it.
                launcher = subprocess.run(
                    [sys.executable, str(lib.parent / "qa_tool.py"), "--list"],
                    env={"PATH": ""}, capture_output=True, text=True,
                )
                if launcher.returncode != 0:
                    print(f"FAIL {skill}: launcher failed\n{launcher.stderr.strip()}")
                    status = 1
                    continue
            if result.returncode == 0:
                print(f"ok   {skill}: bundles and runs {', '.join(names)}")
            else:
                print(f"FAIL {skill}: bundled execution failed\n{result.stderr.strip()}")
                status = 1
    return status


def main(argv=None):
    parser = argparse.ArgumentParser(description="Bundle shared Python code into skills")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--check", action="store_true", help="verify bundling and execution (no writes)")
    group.add_argument("--write", action="store_true", help="materialize scripts/lib/ in each skill")
    args = parser.parse_args(argv)
    return check() if args.check else write()


if __name__ == "__main__":
    sys.exit(main())
