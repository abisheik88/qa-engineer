# Code Style Matching

How generated code takes on the repository's style, so it reads as if the team wrote it. Correct code in a foreign style has failed the milestone's bar — output must look like it belongs, not like AI output. Style is detected by the repository analysis; this module applies it.

## What is matched

| Aspect | Matched to the repository's observed choice |
| --- | --- |
| Indentation and width | Spaces or tabs, and the size, as the surrounding code uses |
| Quotes and semicolons | Single or double quotes; semicolons or not |
| Async idiom | The project's `async/await`, promise, or callback style in tests |
| Assertion style | The assertion library and idiom actually in use — never a different one |
| Locator idiom | The selection approach the suite uses, defined where the suite defines it |
| Imports | Import ordering and module style (ESM or CJS) as used |
| Comments | The density and style of comments the codebase uses — neither stripped nor inflated |
| Types | The project's typing discipline, where the language has one |

## Rules

- **Defer to configured tooling.** If the repository has a formatter or linter configuration, generated code conforms to it — that configuration is the authoritative style, above any inference.
- **Match the majority.** Where style varies, follow the dominant form and note the inconsistency; do not average two styles into a third.
- **Assertion style is not negotiable.** Generated tests use the suite's existing assertion library and idiom. Introducing a second assertion style into a suite is a defect, however good the alternative.
- **No signature style.** Generated code carries no comments announcing it was generated, no decorative banners, and no idioms the codebase does not already use. The goal is invisibility.
- **Preserve on modification.** When extending an existing file, match that file's local style specifically, and leave its untouched parts exactly as they were.

## Boundary

This module governs *how code reads*. What it is *named* is the naming-conventions module; which pattern it *implements* is the repository analysis and template selection. Together they make generated code indistinguishable from the surrounding work — which is the whole point.
