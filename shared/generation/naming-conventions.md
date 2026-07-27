# Naming Conventions

How generated files, classes, and tests are named to match the repository. Naming is one of the most visible signals that code belongs; getting it wrong makes even well-styled code read as foreign. Conventions are detected by the repository analysis; this module applies them.

## What is named

| Element | Matched to the observed convention |
| --- | --- |
| Test files | The suite's file-naming pattern and spec suffix (for example, a `.spec` or `.test` suffix, kebab or camel case) |
| Page objects | The project's page-object file and class naming |
| Fixtures and helpers | The naming used for shared code |
| Directories | The folder names and organization the suite uses |
| Test titles | The phrasing and structure of `describe`/`test` titles the suite uses |
| Tags | The tag or label format the suite uses to group suites |

## Rules

- **Infer from the majority, record the confidence.** The dominant observed pattern is the convention; when it is weak or inconsistent, follow the majority and note it.
- **Match test-title voice.** If the suite writes titles as user-facing behavior ("completes a purchase"), generated titles match that voice; if it writes them as method-style names, match that. Consistency of voice matters as much as consistency of format.
- **Follow the tag vocabulary.** Use the suite's existing tags (a smoke tag, a regression tag) exactly; do not invent a new tagging scheme alongside the existing one.
- **No convention, sensible default.** When the project has no established convention for something (a greenfield bootstrap), use the framework's idiomatic default and state the choice in the README, so the team adopts it knowingly.
- **Never rename existing things.** Matching the convention applies to *new* names. Generation never renames existing files, classes, or tests to fit a preference — that would be a destructive change disguised as tidiness.

## Boundary

This module governs *names*. How the named code *reads* is the code-style module; where it *lives* follows the folder convention detected in the repository analysis. A file that is correctly styled but conventionally misnamed, or correctly named but misplaced, still reads as foreign — all three must hold together.
