# ADR-0016: Reports are rendered centrally from a canonical schema, never authored by an agent

- **Status:** Accepted
- **Date:** 2026-07-29

## Context

The pack is vendor-neutral by design: the same skills run under Claude Code, Cursor,
Codex CLI, OpenCode, Gemini CLI, Copilot, Antigravity, and Kimi
([ADR-0002](ADR-0002-agent-skill-standard.md)). Until now the *report* was not neutral
in the same way. A skill told the agent to render the HTML with a bundled tool, and the
fallback line in every Tooling table said: write the HTML by hand and disclose it.

Two live runs showed what that costs.

The first produced a valid artifact and a lossy report. Every finding carried `repro`,
`actual`, `expected`, and `fixDirection` — all four required by the contract — and the
hand-written HTML collapsed them into one sentence per finding. The data existed; the
rendering discarded it.

The second used the renderer and still failed: every screenshot rendered as a broken
image, because the declared paths were relative to the project root while the report was
written inside the run folder.

Both are the same class of failure — a boundary that was documented rather than
enforced. And both get worse as more agents are supported, because "the agent may write
the HTML if the tool is unavailable" means a report's appearance depends on which agent
produced it and whether its tooling happened to work. A QA report that looks different
depending on the vendor is not a product; it is nine products.

There is a further constraint. The report must open offline, from a `file://` path, in
whatever mail client the recipient uses. That rules out a CDN, a web font, a charting
library, and a PDF engine — every conventional answer to "make it look good".

## Decision

**An agent produces structured data. The pack produces every document.**

1. **One canonical schema.** `qa-engineer/qa-report` (schema 2.0,
   `packages/engine/lib/report/schemas/qa-report.schema.json`) is the producer-neutral
   report contract. It has fields for metadata, summary, coverage, issues, artifacts,
   performance, security, accessibility, console, network, data validation, and
   recommendations. It has **no field for a colour, class, font, template, or any other
   presentation hint**, and `additionalProperties: false` means one cannot be added by a
   producer. An agent that wants its report to look different has no mechanism to make
   it so. A test asserts the schema exposes no such hook.

2. **One normalizer registry.** `lib/report/core/normalize.mjs` accepts the canonical
   schema and the two per-skill contracts that predate it (`qa-explore/explore-result`,
   `qa-report/report-result`), folding each into one internal shape. An unknown contract
   or an unsupported schema version is refused by name rather than half-rendered.
   Supporting a new producer means adding a normalizer — never a second renderer.

3. **One theme, one renderer.** `lib/report/theme/` owns every colour, type scale, and
   spacing token; `lib/report/components/` owns every card, badge, chart, and table;
   `lib/report/export/` assembles them. Charts are hand-written SVG and icons are inline
   SVG, so the document has no external request and prints correctly.

4. **Three versions, stamped into every report.** Schema, theme, and renderer version
   move independently and are recorded in `<meta>` tags and in the appendix. A theme
   change must never require a schema bump; a renderer fix must never invalidate an
   archived artifact.

5. **Modes filter, they never rewrite.** `full`, `executive`, `developer`, and
   `artifact` (body-only, for an embedding host such as Claude Artifacts) select which
   sections render. They share one model and one stylesheet, so an executive rendering
   and a developer rendering cannot disagree about a number, and an embedded report is
   visually identical to a standalone one.

6. **Provenance is displayed, never acted on.** The producing agent and model are shown
   in the appendix. No rendering path branches on them. A test renders the same report
   as `claude-code` and as `cursor` and asserts the documents are byte-identical apart
   from the provenance line.

7. **The canonical output is local, and no hosted preview may stand in for it.**
   `report-bundle` writes a folder — `index.html`, `report.json`, `report.md`,
   `manifest.json` with a SHA-256 per file, and an `assets/` tree holding a *copy* of
   every piece of evidence. After writing, the emitted HTML is re-read and every `src`
   and `href` is resolved against the bundle root; a reference that escapes the folder
   or names a file that is not there fails the command. `--zip` emits the same tree as
   one archive. A platform preview — a Claude Artifact URL, a Cursor preview, any cloud
   viewer — is an optional convenience that expires, and skills are instructed never to
   present one as the deliverable.

The fallback "write the HTML by hand" is withdrawn. A skill whose renderer is
unreachable reports that the engine is missing and stops, because a hand-typed report is
the failure this ADR exists to prevent.

## Alternatives considered

**Per-agent adapter packages (`packages/agent-claude`, `agent-cursor`, …).** Proposed so
each agent could have its findings converted to the canonical schema by dedicated code.
Rejected because there is nothing for that code to do. The producers here are language
models following a `SKILL.md`; the skill *is* the adapter, and the conversion happens
when the model writes JSON. Nine packages containing no runtime code would be nine
reserved-but-empty directories, which
[ADR-0015](ADR-0015-no-reserved-empty-directories.md) forbids and a fitness test fails
on. If a future integration is a real program rather than a prompt — a CI plugin, a
GitHub Action — it gets a package then, with code in it.

**Thirteen separate npm packages for the renderer** (`report-core`, `report-theme`,
`report-components`, `report-charts`, …). Rejected on distribution grounds: the
installer copies the engine wholesale into all nine bundling skills, so every package
would reach every skill regardless, while cross-package imports break in the flattened
bundle and thirteen `package.json` files would need versioning in lockstep. The module
boundaries are kept as directories under `lib/report/`, which is what the separation was
actually for. Promoting one to a package later is a directory move plus a bundler entry.

**Letting each agent style its own report, with a shared stylesheet as a suggestion.**
Rejected: a suggestion is not a guarantee, and the first divergence is invisible until
someone puts two reports side by side.

**A templating language, so non-programmers could adjust the report.** Rejected: it
reintroduces the authoring surface this ADR removes, and the audience for the change —
QA engineers reading a report — is not the audience that would edit a template.

**Bundling a PDF library.** Rejected against the zero-dependency rule. The HTML carries
a print stylesheet that forces every finding open, drops the navigation and the glass
effects, and prints link targets. Print → Save as PDF produces a better document with
nothing to install.

**Publishing to a hosted preview as the primary output.** Rejected, and the reason is
first-hand: during this work a report was shared as a Claude Artifact URL, and the link
had expired to a "Page not found" screen before the conversation was over. A QA report
is evidence attached to a release decision — it is reopened during a postmortem, quoted
in a compliance review, and forwarded to someone who joins the team later. Anything that
can 404 is disqualified from being the deliverable. Hosted previews stay available as a
convenience for sharing a link *now*, and the skills say plainly that the folder is the
report.

**Keeping only the single self-contained file.** Rejected as the sole output, kept as
one of two. Inlining a run's evidence as base64 inflates it by a third, so a pass with
forty screenshots and a video becomes an HTML file too large to open comfortably, let
alone mail. The bundle handles that case; `report-html --embed` remains the right answer
for a lone attachment, and both are produced by the same renderer from the same model,
so they cannot disagree.

## Consequences

**Easier.** Every report from every agent is the same document, so the appearance
becomes part of the project's identity rather than a per-vendor accident. A new output
format is one exporter reading the existing model. A visual change is one edit to the
theme and it reaches every report and every mode at once. Adding a producer is one
normalizer with one test.

**Harder.** An agent can no longer improvise a report for a case the schema does not
cover; extending the schema is now a deliberate, versioned change with a test behind it.
That is the intended trade — it is the same constraint that stops a report from silently
dropping `expected` — but it does mean the schema has to keep pace with what runs
discover.

**Accepted risks.** The canonical schema is new and is only exercised by this pack's own
skills so far; the older contracts remain supported precisely because that confidence is
not yet earned. Schema 2.0 has no external producers to validate the shape against, so
the first third-party integration may surface fields it needs.

**Follow-up obligations.**

- `analysis report-schema` emits the canonical contract so an agent can validate against
  the same object the renderer reads; keep it wired to the file, never a copy.
- The agent-agnosticism test (`packages/engine/test/report.test.mjs`) is the enforcement
  for decision 6 and must not be weakened to accommodate a producer-specific tweak.
- Skill Tooling tables must not reintroduce a hand-authoring fallback for HTML.
- When a fourth contract is added, `SUPPORTED_SCHEMA_VERSIONS` in `lib/report/version.mjs`
  is the single place that decides what the renderer admits.
