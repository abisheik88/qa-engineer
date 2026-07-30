# ADR-0018: A red run diagnoses itself — one bounded automatic handoff, and no others

- **Status:** Accepted
- **Date:** 2026-07-29

## Context

[Principle 6](../engineering-principles.md) says skills compose by handing off *by name*:
a skill ends by recommending the next command, and the [execution
lifecycle](execution-lifecycle.md) states phase 10 as "never by doing that next step
yourself". That rule earns its keep. Skills that call skills are how a pack stops being
predictable: cost becomes unbounded, a user cannot tell which skill made a claim, and a
mutation three hops deep is a mutation nobody approved.

It also produced one bad interaction, every single time a suite went red. `qa-run`
finished, reported `failed`, and recommended `/qa-debug`. The user then typed
`/qa-debug`. There was no decision in between — nobody wants the fact of a failure
without its cause — so the recommendation was pure friction, and it was friction at the
worst moment, when someone is already blocked.

Two smaller facts pushed the same way. First, the diagnosis was often *degraded* when it
finally ran, because the run had captured no screenshot and no trace, so `/qa-debug`'s
first recommendation was to run the suite again with tracing on — a second full run to
learn what the first could have recorded for free. That gap is closed separately, by
making failure evidence a floor rather than a strategy preference. Second, a
recommendation is unenforceable: nothing in the contract could tell whether a red run had
even offered the next step.

## Decision

`qa-run` dispatches `/qa-debug` **automatically** when a run classifies as `failed` or
`errored`, and presents the diagnosis alongside the run summary. This is the pack's only
automatic forward handoff, and it holds only under all seven of these bounds, specified
for reuse in the shared `failure-handoff` module:

1. **One hop, forward only.** The successor does not dispatch onward and does not
   re-enter execution. The chain is exactly two links and then stops with a
   recommendation.
2. **The successor must not mutate.** `/qa-debug` reads artifacts and explains. `/qa-fix`
   edits, so it stays a recommendation the user approves. Automation is for learning why
   a run failed, never for acting on the answer.
3. **Dispatch by command name, never by path.** No skill loads another skill's files;
   sibling paths are not guaranteed at runtime, which is what
   [ADR-0002](ADR-0002-agent-skill-standard.md) requires and the architecture fitness
   check enforces.
4. **The artifact goes first.** The execution result is written and validated against its
   contract *before* the handoff, and the handoff passes its path. There is no privileged
   in-memory channel, so the automatic path and a human typing `/qa-debug <path>` produce
   the same diagnosis from the same input.
5. **Announced and suppressible.** The run says it is diagnosing before it does, and a
   user who asked for the run only gets the run only — with the suppression recorded.
6. **Degrades honestly.** If `/qa-debug` is not installed or cannot run, the handoff is
   recorded as `unavailable` with the reason and the recommendation stands.
7. **Recorded in the artifact.** `execution-result` carries a `handoff` block, and from
   contract 1.1.0 a `failed` or `errored` result is **invalid** without one. The
   automatic step is therefore auditable, and a red run cannot silently skip it.

The run's verdict is never revised by the diagnosis. A `failed` run stays `failed` however
the cause is classified.

## Alternatives considered

**Keep the recommendation and change nothing.** The status quo, and the honest reading of
principle 6. Rejected because the principle exists to prevent unpredictable chains, not to
protect a keystroke: the one case where the next step has no decision in it is the case
where the rule costs the user something and buys nothing.

**Let `qa-run` diagnose failures itself.** No dispatch, no exception to principle 6.
Rejected because it duplicates the diagnostic platform inside the execution skill, and
duplication is exactly how the two would drift — a failure diagnosed by `/qa-debug` and
the same failure diagnosed by `qa-run` would eventually disagree, and the user could not
tell which to trust. Ownership stays where [ADR-0011](ADR-0011-diagnostic-platform.md)
put it.

**Make the router do it.** `qa` dispatches to `qa-run`, reads the result, then dispatches
to `qa-debug`. Architecturally tidy — the only dispatcher stays the only dispatcher — but
it works only when the user came in through `/qa`. A direct `/qa-run regression`, which is
how most runs start, would keep the old friction, and the pack would have two different
behaviors for the same failure depending on how it was invoked.

**A general chaining mechanism** — declared `next:` edges in every skill's frontmatter,
so any skill can trigger any other. Rejected as the thing principle 6 was written
against. A pack where any skill may trigger any other has no bound on cost, no clear
attribution for a claim, and no way to be sure nothing mutated. One named exception with
seven conditions is reviewable; a mechanism is not.

## Consequences

**Easier.** A red run answers "why" in the same turn it reports "what". The diagnosis
arrives with better evidence than before, because the failure evidence floor guarantees a
screenshot and a trace to read. And the handoff is contract-enforced, so a red result that
skipped diagnosis without saying why cannot be emitted at all.

**Harder.** A red run costs more than it used to: the diagnosis runs whether or not the
user would have asked, which matters most on a wide failure (a base-URL outage failing
every test) where the cause is already obvious. Suppression is the release valve, and
`/qa-debug` prioritizes rather than diagnosing every failure separately.

**Risk accepted.** The exception invites "my skill needs one too". The bound is this
document: another automatic handoff requires amending this ADR and satisfying all seven
conditions — in particular condition 2, which excludes every mutating skill in the pack.

**Follow-up obligations.**

- `execution-result` moves to **1.1.0**: `handoff` is additive, and the three new
  invariants are gated on the producer's `contract.version` so 1.0.0 results stay valid
  (see [output-contracts.md](../skills/output-contracts.md)).
- The `failure-handoff` module is synced into both `qa-run` (the sender) and `qa-debug`
  (the receiver), so the bounds are one edit and both ends read the same rules.
- `qa-debug` states that it may be entered automatically and that it still stops at a
  recommendation — condition 1 is a rule the receiver has to keep too.
- Eval coverage: a golden case whose red result carries the handoff and its failure
  screenshot, and adversarial cases for a red 1.1.0 result with no handoff and for one
  with no artifacts.
