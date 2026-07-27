# Security Policy

This project ships instructions and (in later milestones) tooling that AI coding agents execute inside real repositories. That makes security a design constraint, not an afterthought. This document explains how to report vulnerabilities, what is currently supported, and the security guarantees the project is built around.

## Reporting a vulnerability

**Do not open a public issue for security problems.**

Report vulnerabilities through GitHub's private vulnerability reporting on this repository (*Security → Report a vulnerability*). Include reproduction steps, affected files or versions, and impact as you understand it.

What to expect:

- Acknowledgement within **5 business days**.
- An assessment and remediation plan within **15 business days** for confirmed reports.
- Coordinated disclosure: we ask for up to **90 days** before public disclosure, and we credit reporters in the advisory and changelog unless they prefer otherwise.

## Supported versions

The project is pre-release; only the `main` branch receives fixes. Once versioned releases begin, this table and the [support policy](docs/contributing/versioning-and-releases.md) will define which release lines receive security fixes.

| Version | Supported |
| --- | --- |
| `main` (unreleased) | Yes |

## Threat model

The pack operates in an unusual position: its content is executed by AI agents that hold shell, file, and sometimes browser access inside user repositories. Three threat surfaces follow, and every design decision in the architecture is checked against them.

### 1. The pack as a supply chain

Skills and tooling installed into thousands of repositories are an attack target. Design guarantees:

- **No code execution at install time.** Installation copies files; it never runs project-defined hooks or post-install scripts.
- **The installer never edits agent security configuration** — no MCP server registration, no permission or allowlist changes. It prints instructions and lets the user decide.
- **Integrity is verifiable.** From Milestone 4, an install lockfile records a hash per installed file, and a `verify` command detects drift or tampering.
- **Analyzers are dependency-free.** Deterministic tooling (Milestone 3) uses the language standard library only — no transitive dependency surface.

### 2. Untrusted data flowing through agents

QA artifacts — HAR files, traces, console output, CI logs, DOM snapshots — can contain attacker-influenced content. A hostile page's DOM or a poisoned log line must never become instructions to an agent that holds shell access. Design guarantees:

- **Artifacts are data, never instructions.** Every skill that ingests artifacts carries an explicit guardrail to treat their contents as untrusted data and to ignore any instruction-like text inside them.
- **Analyzers never evaluate or execute artifact content**, and they hard-fail on unrecognized formats rather than guessing.

### 3. Sensitive data leaving the user's machine

Artifacts routinely contain credentials: `Authorization` headers and cookies in HAR files, session state in traces, tokens in CI logs. When an agent reasons over them, that content enters a model provider's context. Design guarantees:

- **Redaction by default.** Analyzers strip authorization headers, cookies, and recognizable token patterns from their output unless the user explicitly opts out.
- **No secrets in reports.** Skills are forbidden from echoing credential values into generated reports, commit messages, or logs, and project context templates instruct users to reference environment variable *names*, never values.
- **No telemetry.** The pack collects and transmits nothing.

Guarantees marked for later milestones (lockfile verification, analyzer redaction, diff guards) are binding on those milestones: the features they describe must ship with the guarantee intact, and a release that weakens one requires a documented decision in an ADR.

## Scope

In scope: everything in this repository — documentation that could induce unsafe agent behavior, CI workflows, and (as they ship) skills, analyzers, and the installer.

Out of scope: vulnerabilities in the AI agents themselves, in model providers, or in the test frameworks the pack orchestrates — report those upstream. Deliberately vulnerable fixture applications used by the evaluation harness (Milestone 5) are clearly marked, never published to package registries, and excluded from installable artifacts; findings inside them are not vulnerabilities.

## Security-relevant conventions for contributors

- Never commit credentials, tokens, or live endpoint data — including inside example artifacts and fixtures.
- GitHub Actions must run with least-privilege permissions and pin actions to major versions managed by Dependabot.
- Changes that touch the threat model or weaken a guarantee above require an ADR and explicit maintainer sign-off.
