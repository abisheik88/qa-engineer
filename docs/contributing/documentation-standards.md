# Documentation Standards

Documentation is this project's primary interface — for contributors today, and for the AI agents that will consume its skills later. This document is the project's **style guide**: it exists so that documentation across the repository reads as if one careful author wrote all of it. Mechanical style is enforced by CI; judgment rules are enforced in review.

## Accuracy rules

These are the rules that protect the project's credibility; violations block merge.

1. **Never present planned behavior as shipped.** Future capabilities are always marked with their milestone ("arrives in Milestone 4") or written in the explicit future tense.
2. **Compatibility claims cite verification.** Statements about agent behavior carry the verification date or an explicit *unverified* marker, as in [COMPATIBILITY.md](../../COMPATIBILITY.md).
3. **No duplicated normative content.** A rule lives in exactly one document; everything else links to it. When two documents must both mention a rule, one is the source and the other summarizes with a link.

## Structure

- Every document opens with one or two sentences stating what it is and who it is for — before any heading structure.
- One `H1` per document, matching its purpose; sections descend without skipping levels.
- Front-load conclusions: the decision, the rule, or the answer comes first, the rationale after.
- Every directory carries a `README.md` that indexes its contents.

## Style

- Sentence case for headings ("Supported versions", not "Supported Versions"); proper nouns keep their casing.
- US English spelling.
- Active voice, present tense; "the installer writes", not "files will be written by the installer".
- Address the reader as "you"; refer to the project as "the project" or "the pack", never "we believe"-style editorializing in normative documents.
- Expand an abbreviation on first use per document (Architecture Decision Record (ADR)).

## Voice and tone

The project's voice is a senior engineer explaining a decision to a respected colleague: direct, specific, and calm.

- **Confident, not promotional.** State what something does and why; never "powerful", "seamless", "cutting-edge", or exclamation marks. If a claim needs an adjective to sound good, the claim is weak.
- **Opinionated with reasons.** Normative documents say "do X because Y", not "you might consider X". Where the project has a rule, state the rule; where it has a preference, state the preference and the tiebreaker.
- **Honest about limits.** Unverified, planned, and best-effort things are labeled as such. Understatement ages better than hype.
- **No hedging theater.** Delete "simply", "just", "note that", "it's worth mentioning", "as you can see". Either the point earns a sentence or it doesn't appear.

## Verbosity

The reader's time is the budget. Rules of thumb:

- One idea per paragraph; one paragraph is usually enough per idea. If a section restates another document, replace the restatement with a link.
- Never explain the same thing twice at different levels of detail in one document — pick the level the audience needs.
- Bullet lists are for parallel items, not for prose chopped into fragments. If the bullets read as sentences continuing each other, write a paragraph.
- Cut preambles. A section that opens "In this section we will discuss..." starts one sentence too early.

## Linking

- Relative paths to explicit files: `[ADR-0002](../architecture/ADR-0002-agent-skill-standard.md)`, never a bare directory path.
- Link the first mention of another document in a section; do not re-link every mention.
- External links point to stable, canonical sources (specifications, official documentation). CI checks internal links on every push and external links weekly.

## Code blocks, tables, and diagrams

- Fenced code blocks always declare a language; use `text` for output, trees, and formats without a highlighter.
- Tables are for enumerable facts with parallel structure; explanation lives in surrounding prose, not inside cells.
- Diagrams are ASCII inside `text` fences so they render everywhere, diff cleanly, and need no build step. Keep them under 80 characters wide.

## Admonitions

Exactly two levels, rendered as blockquotes; anything that needs more hierarchy than this needs restructuring, not a louder callout:

> **Note:** supplementary context the reader can safely skip.

The stronger level is reserved for consequences:

> **Warning:** the reader will break something or lose data if they ignore this.

Use them sparingly — a document that is half admonitions has buried its actual structure. Never invent additional labels (`Tip`, `Important`, `Danger`).

## Examples

- Every example is real: commands run, paths exist, output shown is output produced. An invented example is a defect, not an illustration.
- Prefer one excellent example over three adequate ones; add a second only when it demonstrates a genuinely different case (typically the unhappy path).
- Bad examples are as valuable as good ones when teaching judgment — pair them ("Good / Bad — and why") and always say *why* the bad one fails.
- Redact real-world values in examples exactly as skills must: no live hostnames, tokens, or personal data.

## Terminology

Used consistently everywhere; introduce no synonyms:

| Term | Meaning |
| --- | --- |
| skill | A directory with a `SKILL.md` conforming to the Agent Skills specification |
| command | The user-facing invocation of a skill (`/qa-debug`) |
| knowledge module | A single-source document under `shared/`, synced into skills |
| wrapper | A generated, knowledge-free per-agent invocation stub |
| analyzer | A deterministic script bundled inside a skill |
| output contract | The JSON Schema a skill's structured report validates against |
| agent | An AI coding agent (Claude Code, Cursor, ...) — never "the AI" |

## Changelog discipline

Every user-facing change adds an entry under `Unreleased` in [CHANGELOG.md](../../CHANGELOG.md) in the same pull request, written for a reader deciding whether to update — what changed and what they must do, not how it was implemented.
