# Evidence Model

The structure every finding carries, so that any diagnostic skill consumes findings the same way, whatever analyzer or framework produced them. A finding is a conclusion plus its proof; this model is the proof's shape.

## A finding

| Field | Meaning |
| --- | --- |
| `classification` | The finding's class, from the failure taxonomy |
| `reason` | One sentence: why this classification, in plain language |
| `artifact` | The primary artifact the finding rests on |
| `location` | Where that artifact is |
| `timestamp` | When the finding was produced (ISO 8601 UTC) |
| `confidence` | Calibrated per the confidence model; omitted rather than invented |
| `evidence` | One or more supporting observations (below) |
| `affectedTests` | The tests this finding concerns |
| `relatedArtifacts` | Other artifacts that corroborate or contextualize it |
| `recommendations` | Safe next actions, per the recommendation guidelines |

## An evidence entry

Each supporting observation carries its own small structure, so a reader can trace the finding to source:

| Field | Meaning |
| --- | --- |
| `type` | The kind of observation: trace, har, junit, report, console, network, stdout, stderr, screenshot, video, log, file, diff |
| `description` | What this observation shows |
| `source` | The exact file, command, or entry it came from |
| `excerpt` | The relevant fragment, verbatim and **redacted** — optional but strongly preferred |

## Rules

- **Every finding has at least one evidence entry.** A conclusion with no evidence is not a finding; it is a guess, and it is not emitted.
- **Excerpts are redacted at construction.** The evidence model masks secrets and PII as the excerpt is set, so an evidence object can never carry a credential (redaction policy).
- **Provenance, not blame.** Evidence records where a fact came from; it does not editorialize. The classification and reason carry the judgment; the evidence carries the proof.
- **One shape, every producer.** The Playwright trace analyzer, the JUnit parser, and a future Selenium analyzer all emit this exact structure. That uniformity is what lets `qa-debug` and `qa-report` be written once for all frameworks.

## Why it is fixed now

The evidence model is frozen before the skills that consume it exist, so those skills can be built against a stable shape. Adding a field is an additive, versioned change; removing or renaming one is a breaking change under the pack's versioning policy. The model is implemented by the analysis core's evidence module, so the specification and the code cannot drift.
