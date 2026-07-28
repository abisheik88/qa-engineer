# ADR-0012: The deterministic engine is Node, not Python

- **Status:** Accepted
- **Date:** 2026-07-28
- **Supersedes:** the language choice in [ADR-0009](ADR-0009-analysis-platform.md) and [ADR-0011](ADR-0011-diagnostic-platform.md). Everything else those decisions established — code over prompts, one evidence model, one taxonomy, zero third-party dependencies, framework-agnostic core with thin adapters — stands unchanged and is the reason this migration was possible at all.

## Context

[ADR-0009](ADR-0009-analysis-platform.md) decided that analysis must be **code, not prompts**, and that it must take **no third-party dependencies**, because the code is bundled into other people's repositories where every dependency is attack surface and an install burden. Both arguments were right and still hold.

It also said "Analyzers are Python (standard library only, 3.8+)". That sentence was never argued for. The alternatives section of ADR-0009 considers letting the model reason over raw artifacts, taking a schema library, per-framework analyzers with no shared core, and deferring the platform — but not implementing it in JavaScript. The language was assumed, not chosen, and the assumption cost something real:

1. **A second runtime, required of every user.** The installer is Node — `npx qa-engineer` is the documented and only install path — so Node is already present before any skill runs. Python was an additional requirement, for an engine the user installed with Node.
2. **The failure mode was silent.** A skill whose deterministic tool call fails does not stop; it falls back to its documented manual path and marks the result degraded. So a missing or misnamed interpreter did not produce an error a user would investigate. It produced *model guesswork presented as a QA result* — the exact thing this project exists to replace. `python3` is not on PATH on Windows by default, and COMPATIBILITY.md carried "Windows: expected to work; not yet verified" for that whole period.
3. **It cost an invocation contract twice.** The first was a POSIX-only shell recipe (`QA_LIB="$(ls -d … | head -1)"` with a `PYTHONPATH=` prefix) that failed on every Windows call. Replacing it with a Python launcher fixed the shell problem and left the interpreter problem.

## Decision

The deterministic engine is **Node, dependency-free**, in `packages/engine/`. Python is removed from the repository entirely — engine, tests, bundler, eval harness, CI job, and the runtime requirement.

- **One runtime.** Node ≥18.17, which the install already required. Nothing to add, nothing to detect, nothing to skip when absent.
- **Still zero dependencies.** Two things Python's standard library provided are written out rather than depended on:
  - **XML** (`lib/analysis/xml.mjs`) — Node has no parser. This reads the JUnit subset the pack's artifacts use and *refuses* everything else, because a fabricated parse becomes a fabricated test result.
  - **ZIP** (`lib/analysis/zip.mjs`) — for Playwright traces. It walks the central directory (authoritative where a streamed local header is not) and inflates through the built-in `zlib`.
- **One command shape, everywhere.** Each skill documents `node <SKILL_DIR>/scripts/qa-tool.mjs <tool> <subcommand>`, identical in bash, zsh, PowerShell and cmd.exe, with no platform difference at all.
- **The launcher is committed, not generated.** Each skill carries `scripts/qa-tool.mjs` in git, kept in step by `sync-shared`. It resolves the engine from the bundle, from `node_modules`, or via `npx` — which is what makes the pack installable by a generic file copier such as `npx skills add`, and not only by our own installer.
- **One validator.** The JSON Schema validator existed twice — Python for contracts, JavaScript for installer config — held together by a shared corpus. It is now one function that both use.

## How the migration was made safe

A reimplementation of ~3,500 lines is exactly the change that goes subtly wrong: a `(?i)` flag that did not survive translation, a `\1` that should be `$1`, a rounding rule that differs on the boundary. None of those are caught by "does it run".

So both engines existed simultaneously behind `scripts/check-engine-parity.mjs`, which ran them over a shared corpus and failed on any difference. No module was switched over before its row was green; Python was deleted only when all thirteen were, at 367 comparisons covering module output, whole rendered HTML documents byte-for-byte, and the CLI's stdout and exit codes.

**The gate found six defects in the shipped Python**, which is the strongest argument that the method was right:

| Defect | Consequence |
| --- | --- |
| A non-numeric JUnit `time` escaped as a bare `ValueError` | traceback and exit 1 where the CLI documents exit 2 with `{error, detail}` |
| Redacting a header rewrote CRLF line endings to LF | Windows runner logs and raw HTTP captures came back with mixed endings |
| A HAR whose `log.entries` was a string crashed on `'str' object has no attribute 'get'` | an `AttributeError` the CLI does not catch |
| A mapping key sharing indentation with a sequence entry was silently reinterpreted | `.qa/context.md` — the file every skill reads — could be misread into a plausible shape YAML itself rejects |
| `unsafe-retry-increase` could not fire below ten retries | a declared safety rule, dead for every value a real config carries |
| `weakened-assertion` fired on the canonical `/qa-fix` locator repair | the guard flagged the repair it exists to permit, teaching everyone to override it |

The last two were found not by comparing outputs but by an assertion added to the gate: *every rule the guard can emit must be triggered by the corpus*. A rule nothing exercises is a rule parity cannot protect.

When the last Python module was deleted the gate went with it, as its own header said it would. Its corpus did not: it is frozen in `packages/engine/test/corpus/expected.json`, recorded while parity was green, and a snapshot test defends it. That baseline is trustworthy precisely because it was proven against a second independent implementation rather than merely recorded from the only one.

## Alternatives considered

- **Keep Python, document the requirement harder.** Rejected. The problem is not that users were uninformed; it is that the failure is silent and produces confident guesswork. A louder README does not change what happens when `python3` is missing.
- **Shell instead of Node.** Rejected, and it was the user's first instinct. Shell cannot parse JSON without `jq` (a dependency, ruled out by ADR-0009), cannot parse XML at all, and would need a second implementation for PowerShell — reintroducing the exact defect the first invocation contract had.
- **Bundle a Python interpreter.** Rejected: megabytes per skill, a platform matrix to maintain, and it makes the pack a distributor of a language runtime.
- **Take a dependency for XML and ZIP.** Rejected on ADR-0009's original reasoning, which has not weakened: this code is copied into other people's repositories. The two readers cost about 350 lines and are tested against archives and documents this port did not produce.
- **Rewrite without a parity gate, relying on tests.** Rejected. The existing tests passed against both implementations *and* against four of the six defects above — they encoded the behaviour, including where it was wrong. Only a differential comparison over a wide corpus surfaced those.

## Consequences

- **Users need one runtime.** COMPATIBILITY.md drops Python entirely; the Windows caveat that existed because of `python3` goes with it.
- **CI loses the Python job and its version matrix**, and gains an engine job across Node 18, 20 and 22 — the range `engines.node` actually declares.
- **`qa doctor` stops looking for an interpreter** and instead *executes* the bundled engine, because a bundle that copied cleanly and cannot run was always the failure worth catching.
- **The bundle is one directory.** Under Python it was a per-skill list of packages, single-file adapters, and package data copied from three places. The engine is one dependency-free package that carries its own runtime data, so a wholesale copy of it is a complete engine and there is no data file left to forget.
- **The pack is installable by the wider ecosystem.** Because the launcher is committed and the engine resolves at runtime, `npx skills add <owner>/<repo>` — or any tool that copies a skill directory — produces a working skill.
- **ADR-0009's real decisions are untouched.** Analysis is still code; findings still share one evidence model and one taxonomy; there are still no dependencies. This ADR changes the language and nothing else about the architecture, which is why the port was a translation rather than a redesign.
