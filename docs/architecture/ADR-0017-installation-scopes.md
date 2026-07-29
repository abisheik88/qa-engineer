# ADR-0017: Installation is scoped — global, workspace, or project — and each shares what it can

- **Status:** Accepted
- **Date:** 2026-07-29

## Context

The installer knew one arrangement: copy every skill into every discovery directory a
project reads, with the deterministic engine bundled inside each skill. That was the
right default and it is still the right default for a repository. It was also the *only*
arrangement, and it had two costs that only became visible at scale.

**It duplicated heavily.** A single project install wrote **1213 files and 13 MB**, of
which 7 MB was **eighteen copies of the same engine** — nine bundling skills times the
two discovery directories the installer writes to serve both Claude Code and every host
that reads `.agents/skills`.

**There was no way to install once for a machine.** Users asked for it, and the answer
was to point `--project` at the home directory. That worked, and it was a trick: it
scattered `qa-lock.json`, `.agents/`, and `.claude/` directly into `$HOME`, it was
undocumented, no test covered it, and any change to path handling would have broken it
silently. A tool whose only global mode is an undocumented misuse of a project flag is
not a tool teams adopt.

The pack is also vendor-neutral by design ([ADR-0002](ADR-0002-agent-skill-standard.md)),
and a machine-wide install collides with that: hosts do not agree on where user-level
skills live, and several have no such place at all.

## Decision

**Installation has three named scopes, and each shares as much as its situation allows.**

| Scope | Root | Shares | For |
| --- | --- | --- | --- |
| `--global` | `~/.qa-engineer` | one engine, one skill tree | a machine |
| `--workspace` | `<monorepo>/.qa-engineer` | one engine, one skill tree | every package in a repository |
| `--project` | the project | nothing — engine bundled per skill | one repository, self-contained |

1. **QA Engineer owns one directory.** `~/.qa-engineer/` holds `engine/`, `skills/`,
   `qa-lock.json`, and — created on demand — `config/`, `sessions/`, `cache/`, `logs/`,
   `adapters/`. Nothing is written loose into `$HOME`. `QA_ENGINEER_HOME` relocates it
   entirely. Directories that hold nothing yet are not created: an empty `sessions/`
   promising a feature that does not exist is a lie the filesystem tells forever.

2. **A scope has a `qaRoot`, and that is the whole sharing mechanism.** One engine, one
   canonical skill tree. The launcher (`shared/tooling/qa-tool.mjs`) walks up from
   wherever a skill lives looking for `.qa-engineer/engine`, then the machine home, then
   `node_modules`, then `npx`. A skill therefore does not know which scope installed it,
   which is exactly why one skill directory serves all three.

3. **Agents are reached by link, not by copy.** A global install symlinks each skill from
   the agent's user-level directory into the canonical tree — a *junction* on Windows,
   which needs no administrator rights or Developer Mode. Link support is **probed
   before planning**; a filesystem that cannot hold one (FAT, some network and container
   mounts) gets copies and a warning, never a failed install.

4. **A host is served globally only where its user-level path is documented.**
   `lib/agents/user-level.mjs` is a table, and `null` is a real answer carrying a reason.
   Claude Code and Antigravity have documented user-level directories; Cursor, Codex,
   OpenCode, Gemini CLI, and Copilot do not, and the install says so by name rather than
   writing to a guessed path. **Writing skills where a host does not read them is the
   worst failure this installer can produce**: the files are there, the install reports
   success, and the user concludes the tool is broken.

5. **Project mode is untouched.** Every install already on disk is a project install, and
   a 0.10 lockfile — which has no `scope` block — is read as `project` because that is
   what its absence means. Adding modes must not rewrite anyone's repository.

6. **Lifecycle commands find the install themselves.** `verify`, `doctor`, `repair`,
   `update`, `uninstall`, and `self-test` prefer a project lockfile in the current
   directory and fall back to the machine install, matching the layering a developer
   already knows from `node_modules` and `~/.gitconfig`.

**Result: 1213 files and 13 MB became 215 files, 26 links, and 1.9 MB, with one engine.**

## Alternatives considered

**XDG base directories on Linux.** `$XDG_DATA_HOME/qa-engineer` plus `$XDG_STATE_HOME`
and `$XDG_CACHE_HOME` is tidier by the specification and worse in practice: three
directories, three variables, three fallbacks, a different layout on macOS and Windows,
and an `uninstall` with three roots to get right. One dot-directory is what Docker, the
AWS CLI, Cargo, and Git do; `cache/` lives inside it and is documented as safe to delete,
which is most of what XDG would have bought.

**Keeping `--project ~` and documenting it.** Rejected. It writes into `$HOME` directly,
so nothing can distinguish what the tool put there from what the user did — which means
it can never be cleanly uninstalled.

**A global install that copies rather than links.** Simpler, and it forfeits the property
that makes the mode worth having: `update` touching one directory and every agent seeing
it at once. Copying remains the automatic fallback where links are impossible.

**Inventing user-level paths for the hosts that do not document one.** Rejected on the
rule above. A guessed path produces a silent no-op, which is strictly worse than a
message saying "this host needs a project install".

**One transaction per directory.** The global scope writes into two places — the owned
directory and the agents' — and the first design made the transaction root the owned
directory, which put `.claude/` inside `~/.qa-engineer/` where no agent looks. Rather
than run two transactions with two rollback paths, the root is the deepest directory
containing both, which is the home in every normal case.

## Consequences

**Easier.** Install once, use everywhere. Upgrading is one directory. Disk falls by 85%.
A monorepo installs once at its root instead of once per package. Adding a host is one
table entry. The report renderer, being part of the engine, is now shared by
construction — every project on a machine renders through the same code, which is what
[ADR-0016](ADR-0016-universal-report-rendering.md) promised and only a shared install
actually guarantees.

**Harder.** There are three modes to reason about instead of one, and a global install
introduces a failure the project mode never had: a link can be broken by something else
on the machine. `verify` checks link targets for exactly that reason. Backups for an
owned scope live inside it, so a user looking for `.qa/backups` in a global install will
not find them there.

**Accepted risks.** The user-level table is the weak point — it is correct as of the
documentation read on 2026-07-29, and a host that moves its directory will produce an
install that reports success and does nothing. Only `doctor` would catch that today, and
only if the user runs it. Windows junctions are used but have not been exercised on a
Windows machine in CI; the copy fallback exists precisely because that confidence is not
yet earned.

**Follow-up obligations.**

- `lib/agents/user-level.mjs` must carry a documentation URL beside every non-null path,
  and a reason beside every null one. A test asserts the second.
- CI runs the installer suite on Linux only. Windows link behaviour is untested and the
  fallback is what makes that acceptable, not a reason to stop wanting the coverage.
- `sessions/` is created on demand and nothing writes to it yet. It becomes real when
  authentication lands; until then `doctor` reports it as "not yet created" rather than
  as part of the install.
