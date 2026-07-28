# Runbook: add a test framework

Adding a framework is the extensibility path this project was designed around, and
[ADR-0013](../architecture/ADR-0013-framework-boundary.md) makes a promise about it:
**adding a framework changes only `shared/frameworks/` and the registry.** No skill
moves. This runbook is that promise, made executable.

Budget: about an hour for detection plus JUnit-level analysis. Richer analysis
(native traces) takes longer and is optional.

## What you are adding

Frameworks plug in at four seams, and only the first two are mandatory:

| Seam | Required | What it does |
| --- | --- | --- |
| Registry entry | Yes | Declares the framework, its markers, and its capability gates |
| Detection + conventions | Yes | Lets `qa-init` recognize projects and `qa-run` plan |
| Analysis adapter (`lib/`) | Yes | Normalizes the framework's reporter into the shared shape |
| Generation templates | No | Only if the framework should generate code |

## Step 1 — Declare it in the registry

`shared/frameworks/registry.json` is the single source of truth; the installer's
detector and CI both derive from it, and `check-framework-registry.mjs` fails if
anything disagrees.

```jsonc
{
  "id": "robot",
  "name": "Robot Framework",
  "language": "python",
  "markers": ["robot.toml", "*.robot"],       // how a project is recognized
  "dependencies": ["robotframework"],
  "supportLevel": "Beta",                      // matches the capability matrix
  "liveExecution": false,                      // gated until proven
  "liveGeneration": false
}
```

Start with `liveExecution: false`. The architecture fitness test asserts exactly one
framework has live execution (Playwright); flipping a gate is a separate, deliberate
change with its own evidence.

## Step 2 — Create the adapter directory

```text
shared/frameworks/robot/
├── README.md                    what this adapter covers, and what it does not
├── robot-detection.md           markers, versions, monorepo notes
├── robot-conventions.md         where tests live, naming, how they run
├── robot-execution.md           the command shape, flags, reporter selection
├── robot-artifacts.md           what the framework produces and where
└── lib/
    ├── robot_analysis.py        the analysis adapter
    └── tests/
        └── test_robot_analysis.py
```

Use [`shared/frameworks/selenium/`](../../shared/frameworks/selenium/README.md) as
the model — it is the thinnest complete adapter, which is the point: thinness is the
evidence that framework specifics are genuinely behind the boundary.

## Step 3 — Write the analysis adapter

**Delegate; do not re-implement.** The shared core owns JUnit parsing, redaction,
the evidence model, and the taxonomy. An adapter that re-parses XML has leaked the
boundary.

```python
"""Robot Framework adapter for the analysis platform."""

from the shared JUnit parser import parse_junit          # shared parser
import { classify } from '../analysis/taxonomy.mjs'; // shared classifier


def parse_report(path):
    """Normalize Robot's XUnit output into the shared {tests, executed} shape."""
    return parse_junit(path)


def classify_failure(message):
    return taxonomy.classify(message)
```

If the framework has a richer native artifact (Playwright's `trace.zip`), add a
second function for it and give the adapter its own CLI so skills can reach it the
same way as everything else:

```python
def main(argv=None):
    """python -m robot_analysis report <output.xml>"""
```

Follow [`the Playwright adapter.py`](../../packages/engine/lib/frameworks/playwright.mjs)
for the CLI contract: JSON to stdout, exit `0` on success, exit `2` on a malformed
artifact.

## Step 4 — Register the lib with the test runner

`shared/analysis/lib/run_tests.py` lists each framework's `lib/` on the path and
each `tests/` directory for discovery. Add both entries.

## Step 5 — Prove parity, not just presence

The cross-framework test is what makes the boundary real. Add your framework to
[`packages/engine/test/test_compat.py`](../../packages/engine/test/analysis.test.mjs),
which asserts every framework produces an **identical normalized shape and
classification** from equivalent input. A framework that needs a special case
downstream has not been integrated; it has been bolted on.

```bash
node --test packages/engine/test/*.test.mjs        # your adapter test + the parity test
```

## Step 6 — Update the capability claims

Both matrices, in the same pull request as the code:

- [`docs/capability-matrix.md`](../capability-matrix.md) — the summary row.
- [`docs/compatibility/framework-matrix.md`](../compatibility/framework-matrix.md) —
  the per-capability detail, including what is *not* supported.

`check-capability-matrix.mjs` fails if the two disagree, and
`check-framework-registry.mjs` fails if either disagrees with the registry. Say
plainly what the adapter does not do — "JUnit-normalized; no native trace" is a
complete and respectable answer.

## Step 7 — Run the gates

```bash
npm run validate:registry && npm run validate:architecture && npm run validate:matrix
node --test packages/engine/test/*.test.mjs
npm run validate:release        # fails if your lib/ is missing from the tarball
```

If you added a `lib/` that skills bundle, add its path to `package.json` `files[]`
and to the bundle manifests in **both** `packages/installer/lib/core/bundle.mjs` and
`packages/installer/lib/core/manifest.mjs` — a test asserts the two agree.

## Definition of done

- [ ] Registry entry, with honest `supportLevel` and gates
- [ ] Adapter directory with detection, conventions, execution, artifacts docs
- [ ] `lib/` adapter that delegates to the shared core, plus its own tests
- [ ] Included in the cross-framework parity test
- [ ] Both matrices updated in the same pull request
- [ ] **Zero changes under `skills/`** — verify with `git diff --stat skills/`

That last item is the one that matters. If integrating your framework required
touching a skill, the boundary leaked, and the fix belongs in the adapter — not in
the skill.

## Promoting a framework to live execution

A separate change, deliberately:

1. Flip `liveExecution` in the registry.
2. Relax the guardrail in `skills/qa-run/SKILL.md` that gates execution to
   Playwright.
3. Update the fitness test, which currently asserts exactly one live framework.
4. Provide the evidence: a real run of a real suite, normalized by your adapter,
   validating against `execution-result.schema.json`.

Step 4 is the bar. Without a real run, the honest label stays Beta.
