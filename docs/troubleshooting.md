# Troubleshooting

Symptoms, causes, and fixes. Every command here is verified to run; the exit codes
and messages quoted are the real ones.

**Start here.** `doctor` diagnoses the environment and the install, and prints a fix
hint for anything it finds:

```bash
npx qa-engineer doctor --project .
```

Exit codes across the CLI: `0` success · `1` failure · `2` usage error ·
`3` conflict (refused to overwrite or escape) · `4` verification failure.

## Installation

### "unknown command" or npx installs the wrong thing

```bash
npx qa              # wrong: resolves a package literally named "qa"
```

Use the package name, which is also a binary name:

```bash
npx qa-engineer --yes --project .
```

Inside a project that already depends on the pack, the short `qa` binary is on the
local `PATH` via `node_modules/.bin/` and works directly. Across the documentation
the package-qualified form is used deliberately, and
`node scripts/check-docs-commands.mjs` enforces it.

### `refusing to overwrite N file(s) not owned by a previous install` (exit 3)

A file already exists where the pack wants to write, and no lockfile claims it —
so the installer will not assume it is disposable. Either move your file, or:

```bash
npx qa-engineer install --yes --force --project .   # backs up before overwriting
```

Backups land in `.qa/backups/<timestamp>/` with the original directory structure.

### Nothing was installed for my agent

`doctor` lists what was detected. Detection requires an agent-specific marker, on
purpose — `.github/` alone does not imply Copilot, and `.agents/` (which the
installer itself creates) does not imply Antigravity. Install explicitly:

```bash
npx qa-engineer install --agent claude-code --agent github-copilot --yes --project .
# known ids: claude-code cursor codex opencode gemini-cli github-copilot antigravity kimi agent-skills
```

If the lockfile records `"id": "agent-skills"`, nothing was detected and the shared
`.agents/skills/` path was used — which every spec-compliant host reads. That is a
working install, not a failure.

## Skills

### The `/qa-*` commands do not appear in my agent

In order of likelihood:

1. **Wrong directory.** Skills must be in the project the agent has open. Confirm
   with `ls .agents/skills` (or `.claude/skills`).
2. **The agent needs a restart or a reload** to pick up newly added skills. This is
   agent behavior, not a pack behavior.
3. **The host does not read either path.** Check
   [COMPATIBILITY.md](../COMPATIBILITY.md) and the per-agent guides in
   [docs/installation/](installation/README.md); some hosts need the thin wrappers
   that `--agent` writes.
4. **A stale partial install.** `npx qa-engineer verify --project .` then
   `repair`.

Activation itself is the agent's decision, not the pack's — invoking `/qa-init`
explicitly is the reliable test of whether the skills are installed.

### A skill says the deterministic engine is missing

The skill's `## Tooling` section resolves `QA_LIB` and found nothing:

```bash
npx qa-engineer repair --project .   # re-materializes scripts/lib/
npx qa-engineer doctor --project .   # confirms "bundled engine runs cleanly"
```

If `doctor` reports Python missing, install Python 3.8+. The engine is
standard-library only — there is nothing to `pip install`. Without Python, skills
fall back to their documented manual reasoning and **mark the result degraded**;
that is expected behavior, not a silent downgrade.

### The engine runs but a skill still says a result is degraded

That is the design: a skill that could not run a tool says so and lowers its
confidence rather than guessing. The message names what was missing. If the tool
*should* have worked, run it by hand to see the real error:

```bash
QA_LIB="$(ls -d .agents/skills/qa-debug/scripts/lib .claude/skills/qa-debug/scripts/lib 2>/dev/null | head -1)"
PYTHONPATH="$QA_LIB" python3 -m qa_diagnostics.cli report --execution-result qa-artifacts/execution-result.json
```

Exit `2` prints `{"error": ..., "detail": ...}` naming the problem — a malformed
artifact or a payload that failed its seam contract.

## Verification and drift

### `verify` fails with "hash mismatch"

An installed file changed. If you edited it deliberately, that edit will be lost on
the next `update`; move the change into a fork or a local skill instead. To restore:

```bash
npx qa-engineer repair --project .
```

### `verify` fails with "does not match its schema"

`qa-lock.json` is corrupt or hostile — for example it contains an absolute path or
a `..` segment, both of which are refused because `uninstall` acts on that list.
Reinstall to regenerate it:

```bash
npx qa-engineer install --yes --force --project .
```

### `uninstall` refuses with "installed file(s) have local changes"

Deliberate: it will not silently delete work. Back up what you want to keep, then:

```bash
npx qa-engineer uninstall --project . --force
```

### `refusing to operate outside the project` / `refusing to follow a link out of the project` (exit 3)

A lockfile entry resolves outside the project root, directly or through a symlink.
Nothing was modified. Regenerate the lockfile with a forced install. If you did not
create that entry, treat the repository as untrusted and see
[SECURITY.md](../SECURITY.md).

## Results and reports

### A run was reported `errored`, not `failed`

`errored` means the outcome could not be established — a missing or unparseable
reporter, or a disagreement between the exit code and the reporter. It is not a
softer `failed`; it means "unknown", which is the honest answer.

### A skill refuses to report `passed`

The contract forbids it. `classification: passed` requires exit code `0` **and**
zero failing tests; `ready` requires zero failures and a matching readiness
verdict. If the numbers and the claim disagree, the result is schema-invalid by
design — this is the pack's answer to hallucinated green. Fix the run, not the
claim.

### A "fix" was refused as unsafe

The diff guard flags changes that make a suite pass without proving anything:
removed or weakened assertions, added skips, early returns, excluded specs,
`|| true` on the test command, swallowed failures, inflated timeouts, deleted test
files. A `fail` verdict cannot be reported `repairable`. Inspect any diff yourself:

```bash
PYTHONPATH="$QA_LIB" python3 -m qa_analysis.cli diff-guard my-change.diff
```

`safe: false` with rule `assertion-modified` at severity `low` is *informational* —
an assertion was rewritten with equal or greater strength. `weakened-assertion` at
`high` means the check genuinely got weaker.

## Context file

### `qa-init` says `.qa/context.md` failed validation

The frontmatter is a deliberately small YAML subset: nested mappings, block
sequences, empty `[]`/`{}`, plain scalars. Block scalars (`|`, `>`), anchors, and
non-empty inline collections are rejected rather than guessed at. See what the
parser sees:

```bash
PYTHONPATH="$QA_LIB" python3 -m qa_analysis.cli context --root .
```

Exit `1` lists the contract errors; exit `2` means the file could not be parsed at
all and names why.

## Still stuck

Open an issue with the `doctor --json` output attached — see
[SUPPORT.md](../SUPPORT.md) for what makes a report actionable.
