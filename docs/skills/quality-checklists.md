# Skill Quality Checklists

The per-dimension checklists a skill must pass — used by authors before opening a pull request and by reviewers during it. They extend the repository-wide [review checklist](../contributing/review-checklist.md), which still applies (scope, commits, changelog, CI). Automated checks are marked *(CI)*; everything else is judgment, which is the point of review.

## Architecture review

- The capability genuinely needs its home: not expressible as a mode of an existing skill or a `shared/` module.
- Layout matches [skill-anatomy.md](skill-anatomy.md) exactly; no empty directories, nothing outside the canonical entries *(CI)*.
- Self-containment holds: no `../` or cross-skill paths *(CI)*; cross-skill relationships are handoffs by name.
- Knowledge placement is right: nothing in the body or local references that `shared/` should own, and vice versa.
- Composition follows the two sanctioned mechanisms — handoff by name, artifacts as interfaces ([authoring guide](authoring-guide.md)).

## Documentation review

- Frontmatter is complete and valid *(CI)*; body sections present, in order *(CI)*.
- `README.md` is a landing page, not a second `SKILL.md` — no duplicated procedure or knowledge.
- References each carry a loading condition in the `Context loading` table; no reference is unreachable from `SKILL.md` *(CI)*.
- Prose follows the [documentation standards](../contributing/documentation-standards.md); terminology matches the glossary.
- Nothing aspirational stated as current — milestone-gated capabilities are marked as such.

## Prompt review

Read the body **as the agent**:

- Every procedure step is executable with only the information the skill provides — no step silently assumes knowledge, tools, or state.
- Every mutation step is followed by verification; the procedure states what success looks like and how the agent confirms it.
- Bounded retries: the procedure says when to stop and escalate, never "keep trying".
- Ambiguity is resolved in the skill's favor: where the agent must choose, the skill states the default and the tiebreaker.
- The description routes correctly: it activates on realistic phrasings of the skill's job and does not activate on its neighbors' — check collisions with `check-keywords` *(CI, advisory)*.
- Guardrails cover the pack-wide set plus the failure modes specific to this task.

## Examples review

- At least one example exists, follows [the template](../../templates/example-template.md), and is realistic — a request a practitioner would actually make.
- The shown output actually conforms to the skill's contract and guardrails (an example that violates its own skill is a defect twice over).
- Unhappy paths are represented once the skill is `beta` or above: a missing artifact, an out-of-scope request being redirected.

## Security review

Apply the [threat model](../../SECURITY.md) to this specific skill:

- Artifact ingestion: the body treats artifact contents as untrusted data, and the guardrail is stated, not implied.
- No instruction anywhere that could echo credentials into output, reports, or commit messages; evidence excerpts are specified as redacted.
- No step downloads or executes remote content; no step edits agent configuration.
- For repair-type skills: forbidden actions (deleting assertions, adding skips, inflating timeouts) are explicitly barred in guardrails.

## Compatibility review

- The body is agent-syntax-free and placeholder-free *(CI)*; nothing depends on a single agent's features.
- `compatibility` declares runtime needs only and matches what the scripts actually require; no agent names *(CI)*.
- The skill degrades gracefully: for every optional dependency (MCP server, runtime), the procedure states the fallback.
- Description length fits the pack budget *(CI)*.

## Output contract review

- The result is a finding → contract exists; the result is code/prose → no contract directory. No middle ground.
- Schema follows [output-contracts.md](output-contracts.md): envelope fields, `$id` URN, `additionalProperties` discipline, evidence array `minItems: 1` *(CI: schema parses)*.
- Classification enum is action-oriented: every value implies a distinct next action.
- The `## Output` section references the contract and instructs self-validation before completion.
- Schema changes in this PR are classified (MAJOR/MINOR/PATCH) and the skill and changelog versions agree with the classification.

## Contribution review

The repository-wide [review checklist](../contributing/review-checklist.md), plus for skills:

- `metadata.version` bumped and correctly classified for the change.
- Author recorded live testing in the PR description — agent, model, requests tried; untested changes to `beta`/`stable` skills are not mergeable.
- Synced references untouched by hand; `sync-shared --check` clean *(CI)*.

## Release checklist

Run for every release that touches skills, alongside the [release process](../contributing/versioning-and-releases.md):

- `validate-skills`, `sync-shared --check`, and `check-keywords` clean on the release commit *(CI)*.
- Every changed skill's version bumped; changelog entries classified to match.
- Deprecations announced this release follow the [deprecation steps](authoring-guide.md) and have their removal target recorded.
- Contract MAJOR changes carry migration notes.
- [COMPATIBILITY.md](../../COMPATIBILITY.md) reflects anything this release changed about runtimes or verified agents.
