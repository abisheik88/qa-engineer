# packages/

The project's Node.js tooling packages — versioned and released with the
repository as a whole ([ADR-0001](../docs/architecture/ADR-0001-repository-structure.md)).
Populated in **Milestone 9**.

## What lives here

| Package | Status | Purpose |
| --- | --- | --- |
| [`packages/installer`](installer/README.md) | **Shipped (M9 / M9.5)** | The `qa` CLI: interactive onboard, detection/recommendations, copy-based install, lockfile integrity, `install` / `verify` / `doctor` / `self-test` / `repair` / `update`, and thin wrappers for agents that need them. |

A documentation-generation package (per-skill reference pages for the docs site)
is planned for later in M9 but does **not** exist yet — see the
[roadmap](../ROADMAP.md). Names for it are intentionally *not* reserved here, so
this directory never describes a package that is absent from disk.

## Rules that govern this directory

- The installer honors the security guarantees in [SECURITY.md](../SECURITY.md):
  no code execution at install time, no agent-configuration mutation, verifiable
  per-file integrity.
- Generated wrappers are rendered from skill frontmatter only, are at most 15
  lines, and contain no knowledge ([ADR-0002](../docs/architecture/ADR-0002-agent-skill-standard.md)).
- Packages are dependency-light by policy; every dependency added is attack
  surface shipped to users.
