# Example: routing decisions

Worked routing decisions showing the signal table applied. Each is a request, the decisive signal, and the resulting one-line dispatch.

## A clear failure to triage

### Request

```text
/qa the checkout spec went red in CI run 4123
```

### Decisive signal

A red CI run and a named failing spec — priority 2 (a failure to explain).

### Expected behavior

The router matches priority 2, and because `qa-debug` is not yet available, it says so and offers what exists today.

```text
This is a failure to triage, which belongs to /qa-debug — not available in the
current milestone. Today I can plan a run of that spec with /qa-run, or analyze
the project with /qa-init if .qa/context.md is missing.
```

## A run request, context missing

### Request

```text
/qa run the smoke suite
```

### Decisive signal

A run request (priority 3) — but `.qa/context.md` does not exist, and priority 1 precedes it.

### Expected behavior

```text
There's no .qa/context.md yet, so I'll route to /qa-init first to profile the
project; then /qa-run can plan the smoke suite against a known stack.
```

## A genuinely ambiguous request

### Request

```text
/qa can you look at my API tests
```

### Decisive signal

Two plausible routes — plan a run (`qa-run`) or investigate them (`qa-debug`) — with no dominant reading.

### Expected behavior

The router asks exactly one question, then dispatches on the answer.

```text
Two readings fit: do you want to run the API tests (/qa-run) or investigate a
failure in them (/qa-debug)? Tell me which and I'll hand off.
```

## A general question, no action

### Request

```text
/qa what's the difference between smoke and regression suites?
```

### Decisive signal

A general QA question with no action to take — step 4.

### Expected behavior

The router answers briefly, then names the command to act on it — it does not route to a work skill for a question.

```text
[brief answer on smoke vs regression] — when you want to run either against this
project, use /qa-run and name the suite.
```
