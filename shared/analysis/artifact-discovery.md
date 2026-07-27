# Artifact Discovery

How analyzers find the artifacts a run produced, before parsing any of them. Discovery is deterministic and honest: it locates what exists, classifies each artifact's integrity, and reports what is missing rather than assuming it was produced.

## Modes

- **Automatic (by convention).** Given a run root, discovery globs the known artifact locations (result files, traces, HAR files, reports, screenshots, videos). Framework adapters supply the framework's conventional locations; the discovery mechanism is shared.
- **Explicit paths.** Given specific paths, discovery uses them directly and reports any that do not exist as missing — an explicit path that is absent is an error the caller must know about, not a silent skip.

## Handling the real world

Runs are messy; discovery accounts for it:

| Situation | Behavior |
| --- | --- |
| Multiple runs | Each run's artifacts are discovered under its own root; discovery does not merge runs silently |
| Parallel workers | Per-worker output directories are all discovered; none is assumed canonical |
| Sharded execution | Multiple result files are all collected; the analyzer aggregates them, discovery surfaces them all |
| Missing artifacts | Reported as missing (for explicit paths) or simply not found (for convention) — never invented |
| Partial artifacts | A zero-length or truncated file is classified `partial`, not parsed as if complete |
| Corrupted artifacts | A file that fails a cheap structural check (a trace that is not a valid zip, a report that is not valid JSON) is classified `corrupted`, not parsed past |

## Integrity classification

Every discovered artifact is classified before use: `present` (usable), `partial` (exists but empty or truncated), `corrupted` (structurally invalid), or `missing` (an expected path that is absent). Only `present` artifacts are parsed; `partial` and `corrupted` become warnings and, where they block a conclusion, an honest "could not determine" rather than a guess from bad data.

## Output

Discovery returns the artifacts grouped by integrity, each in the common artifact model (type, location, framework, timestamp, ownership). A diagnostic skill reads this to decide what it can conclude and what it must caveat — the absence or corruption of an artifact is itself evidence, and it is reported as such.
