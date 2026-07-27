# WebdriverIO Framework Adapter

The pack's fourth framework. WebdriverIO implements the same [execution adapter contract](../../execution/execution-contract.md), [generation template categories](../../generation/template-selection.md), and [analysis](../../analysis/README.md) shapes as the others — so adding it changed only this directory, with zero changes to `qa-run`, `qa-generate`, or the diagnostic skills. With four frameworks now crossing the boundary identically, the adapter boundary is considered permanent.

## Modules

| Module | Adapter responsibility |
| --- | --- |
| [webdriverio-detection.md](webdriverio-detection.md) | Recognizing a WebdriverIO project |
| [webdriverio-execution.md](webdriverio-execution.md) | Execution planning (planning only this milestone) |
| [webdriverio-generation.md](webdriverio-generation.md) | Generation planning against the template categories |
| [webdriverio-artifacts.md](webdriverio-artifacts.md) | Artifact locations and mapping to the common model |
| [webdriverio-conventions.md](webdriverio-conventions.md) | Structural conventions the platform reads |

The analysis adapter — `lib/webdriverio_analysis.py` — reuses the shared JUnit parser.

## Not yet

No live WebdriverIO execution or generation (gated by the skills' current guardrails); no WebdriverIO-specific diagnostics beyond the shared engine. The adapter is complete; flipping execution and generation on is a future, adapter-free step.
