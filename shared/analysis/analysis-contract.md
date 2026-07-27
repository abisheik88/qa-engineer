# The Analyzer Contract

The interface every analyzer honors, whatever artifact it reads. A diagnostic skill composes analyzers without knowing their internals, because they all follow the same seven-step shape and emit the same evidence model. This is the analysis counterpart to the execution adapter contract: one shape, many implementations.

## The seven responsibilities

| Step | Responsibility |
| --- | --- |
| Discover | Locate the artifact — by convention or explicit path — or report it missing |
| Validate | Confirm the artifact is present, non-empty, and structurally sound before trusting it |
| Parse | Read the artifact deterministically; a malformed artifact raises, it is never guessed past |
| Normalize | Map the artifact into the pack's shared shapes (results, network entries, findings) |
| Find | Derive findings — classified conclusions — from the normalized data |
| Evidence | Attach, to every finding, the artifact and excerpt that support it, redacted |
| Recommend | Produce safe, specific next actions, without overstepping into fixing |

An analyzer that cannot complete a step says so honestly (missing, malformed, unknown) rather than fabricating a result. Partial output with an explicit gap is correct; a confident guess is a defect.

## What an analyzer emits

Every analyzer returns the shared analyzer output: the analyzer's name, the findings (each in the [evidence model](evidence-model.md)), the artifacts it examined (in the common artifact model), and any warnings. A downstream skill wraps this in its own output contract; on its own it is a complete, machine-readable analysis result.

## Framework-agnostic by default

Most analyzers are framework-agnostic because their formats are standards: JUnit XML, HAR, plain text. These live in the analysis core and serve every framework. Only genuinely framework-specific artifacts — a Playwright trace, a framework's native report — need a framework adapter, and even those reuse the core for evidence, redaction, taxonomy, and validation. The rule: put an analyzer in a framework adapter only when its format is that framework's own.

## Determinism

Analyzers are deterministic: the same artifact yields the same findings. They use no network, no clock-dependent logic in their conclusions, and no model inference. This is what lets their output gate releases and be trusted as evidence — and it is why the platform is code, not prompts.
