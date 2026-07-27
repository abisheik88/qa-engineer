# Diagnostic Engine (`qa_diagnostics`)

The Python implementation of the [diagnostic platform](../README.md). Standard library only, deterministic, framework-agnostic. Builds on `qa_analysis` (the [analysis toolkit](../../analysis/lib/README.md)) for the failure taxonomy, evidence model, and diff guard; it adds the reasoning that turns findings into a diagnosis.

## Layout

```text
lib/
├── qa_diagnostics/
│   ├── root_cause.py       classify a failure; attach ownership and recommendation
│   ├── prioritization.py   severity, priority, impacts, owner, effort
│   ├── timeline.py         reconstruct the ordered run timeline
│   ├── repair.py           plan a repair (never code)
│   └── engine.py           orchestrate: diagnose, plan_repairs, summarize
└── tests/                  unit tests for the engine
```

## Running

Tests run through the analysis toolkit's runner, which puts both packages on the path:

```sh
python3 shared/analysis/lib/run_tests.py
```

## How skills use it

Diagnostic skills (`qa-debug`, `qa-fix`, `qa-report`) do not import from `shared/` at runtime. The bundler copies `qa_analysis` and `qa_diagnostics` into each skill's `scripts/lib/` so the skill is self-contained:

```sh
python3 scripts/bundle_python.py --check   # prove each skill bundles and imports
python3 scripts/bundle_python.py --write    # materialize scripts/lib/ (install/local use)
```

The canonical source is here; the bundled copies are a build artifact.

## Conventions

- **Standard library only, deterministic.** Same inputs, same diagnosis — no network, no clock-dependent conclusions, no model inference.
- **Orchestrate, do not duplicate.** Anything that parses an artifact or classifies a message belongs in `qa_analysis` and is called from here.
- **Repair plans contain no code.** `repair.py` emits prose intent, unit-tested to hold no source.
