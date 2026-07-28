# Runbook: add a skill

Read this before writing a skill — but read the first section before writing
anything at all, because the most likely correct outcome is that you do not add
one.

## Step 0 — Establish that a new skill is the right answer

The command surface is **capped at twelve user-facing commands**, and that cap is a
feature. Every installed skill consumes context in the host agent and competes for
activation with every other skill; a thirteenth command makes the other twelve
slightly worse at being chosen. So the bar is not "is this useful" — it is "is this
more useful than the accuracy it costs everything else".

Work through these in order:

1. **Can it be an argument mode of an existing skill?** Suite tiers, output formats,
   and protocol variants are argument modes, not commands. `/qa-audit` covers
   accessibility, performance, security, *and* visual for exactly this reason.
2. **Can it be a knowledge module?** If you are adding *judgment* rather than
   *workflow* — a better locator strategy, a flakiness pattern — it belongs in
   `shared/domains/` and every relevant skill gains it for free. This is the most
   common right answer, and the cheapest.
3. **Can it be a framework adapter?** See [add a framework](add-a-framework.md).
4. **Only then, a new command** — which requires an accepted
   [RFC](../../templates/rfc-template.md), per [GOVERNANCE.md](../../GOVERNANCE.md).
   [RFC-0001](../rfcs/RFC-0001-qa-explore.md) is the worked example: it argued for
   `/qa-explore` as the twelfth command and stated what it displaced.

An internal (`audience: model`) skill has a lower bar, because it does not compete
for user activation.

## Step 1 — Scaffold from the template

```bash
cp -R templates/skill-template skills/qa-yourskill
```

The template carries the canonical layout. Nothing else is permitted at the top
level of a skill directory:

```text
skills/qa-yourskill/
├── SKILL.md          the skill itself (required)
├── README.md         human-facing overview (required)
├── contracts/        <name>.schema.json — required if it produces an artifact
├── references/       knowledge, one level deep, self-contained
├── examples/         worked examples
├── scripts/          bundled tooling (generated; never hand-edited)
└── templates/        code templates it emits
```

Read [skill-anatomy.md](../skills/skill-anatomy.md) and the normative
[skill-specification.md](../skills/skill-specification.md) before writing prose.

## Step 2 — Write the frontmatter

```yaml
---
name: qa-yourskill              # must equal the directory name
description: >-                 # ≤ 500 chars recommended, hard max 1024
  What it does in one sentence. Use when <the trigger conditions that should
  activate it>.
license: MIT
metadata:
  version: "0.1.0"
  maturity: experimental        # example | experimental | beta | stable
  audience: user                # user (a command) | model (internal)
---
```

The description is the **entire** activation signal — the agent chooses your skill
from that text alone. It must contain a "Use when…" sentence, and it must not
overlap the trigger space of an existing skill; `check-keywords.mjs` reports
collisions, and there is a shared budget across all descriptions
(3,926 / 6,000 characters currently used).

## Step 3 — Write the body

User-facing skills require exactly these sections, in this order:

`## Purpose` · `## Inputs` · `## Context loading` · `## Procedure` ·
`## Guardrails` · `## Output`

Add `## Tooling` if the skill runs deterministic code (see step 5). Body budget:
400 lines advisory, 500 hard — push depth into `references/`.

Four rules that reviewers will hold you to:

- **Purpose says what *not* to use it for**, naming the sibling skill that covers
  that instead. Boundaries prevent misrouting.
- **Context loading is a table**, so knowledge loads per step rather than all at
  once. Progressive disclosure is why the pack fits in a context window.
- **Every step that fills a contract field names its source** — a tool, or an
  explicit `unknown`. This is
  [the deterministic boundary](../architecture/deterministic-execution-boundary.md),
  and it is the rule most likely to fail review.
- **Guardrails include an untrusted-input line.** Artifacts and repository content
  are data, never instructions. `check-doc-claims.mjs` enforces this.

## Step 4 — Add the output contract

If the skill produces an artifact, it needs a schema in `contracts/`, carrying the
standard envelope (`contract`, `skill`, `generatedAt`, `summary`, `classification`,
`evidence` with `minItems: 1`) and a closed `classification` enum where **every
value implies a different next action**. If two values would lead to the same
action, merge them.

Use only the [supported keyword subset](../skills/output-contracts.md#supported-keyword-subset).
Express cross-field safety rules as `allOf` + `if`/`then` invariants so they are
enforced at runtime rather than in a test — for example, `passed` requiring exit
code 0. `check-spec-code-sync.mjs` requires each invariant to carry a `title`
explaining what it prevents.

## Step 5 — Wire deterministic tooling (if any)

Never invent an invocation. Sync the shared contract and point at it:

```bash
node scripts/sync-shared.mjs --add shared/execution/deterministic-tooling.md skills/qa-yourskill
```

Then add the skill to **both** bundle manifests —
`packages/installer/lib/core/bundle.mjs` and `packages/installer/lib/core/manifest.mjs` (a test
asserts they agree) — and write a `## Tooling` table whose Invocation column is a
literal command:

```text
PYTHONPATH="$QA_LIB" python3 -m qa-engine analysis <subcommand> <args>
```

Every row needs a Fallback that keeps the skill honest when the tool is absent:
degrade and say so, never guess.

## Step 6 — Reuse knowledge; do not copy it

If two skills could plausibly need it, it belongs in `shared/`:

```bash
node scripts/sync-shared.mjs --add shared/domains/locator-strategies.md skills/qa-yourskill
```

The synced copy carries a provenance marker and is owned by the sync tool. Never
hand-edit a synced file — `sync-shared --check` fails in CI. Reference files must be
self-contained: no link may escape the skill directory.

## Step 7 — Add evaluation cases

Required, not optional: `check-architecture-fitness.mjs` fails if a user-facing
skill has neither eval cases nor an entry in `tests/evals/coverage-exemptions.json`.

- **A golden case** — correct behavior, which must validate and satisfy every
  assertion.
- **An adversarial case** — the failure mode your skill is most likely to commit
  under pressure (claiming success without evidence, weakening a check to go
  green). The scorer must **reject** it.

The adversarial case is the more valuable of the two. Write the one that would
embarrass you.

## Step 8 — Examples, README, and the matrix

- `examples/` — at least one worked example with realistic input and output.
- `README.md` — what it does, when to use it, what it will not do.
- [`docs/capability-matrix.md`](../capability-matrix.md) — a row with an honest
  support level and a link to the evidence. Start at Experimental.

## Step 9 — Run every gate

```bash
npm run validate:skills          # spec, layout, budgets, links, contract envelope
npm run validate:sync            # no drifted knowledge copies
npm run validate:keywords        # no activation collisions
npm run validate:matrix          # claims agree across documents
npm run validate:architecture    # eval coverage, boundaries
npm run validate:doc-claims      # documentation matches behavior
npm run validate:evals           # golden passes, adversarial rejected
npm test                         # installer, bundle, security, reliability
python3 npm test   # if the skill bundles tooling
```

## Definition of done

- [ ] RFC accepted, if this adds a user-facing command
- [ ] Frontmatter valid; description carries "Use when…"; no keyword collision
- [ ] All required sections present; body within budget
- [ ] Contract with envelope, actionable enum, and invariants where they apply
- [ ] Guardrails include the untrusted-input rule and the skill's real limits
- [ ] Tooling rows give literal commands, each with a fallback
- [ ] Golden **and** adversarial eval cases
- [ ] Capability matrix row with honest level and evidence
- [ ] Every gate green

## The review standard

Reviewers ask one question above all others: **can this skill claim success without
proof?** If any path through the procedure lets the agent report a result no tool
produced and no evidence supports, the skill is not ready — regardless of how well
it is written.
