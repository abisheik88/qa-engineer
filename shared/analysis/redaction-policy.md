# Redaction Policy

What the analysis platform masks, and the non-negotiable rule that it happens before any artifact content is exposed. Artifacts routinely carry credentials and personal data; a diagnostic tool that surfaced them would be a leak, so redaction is a property of the platform, not an option a caller remembers to enable.

## What is redacted

| Category | Examples |
| --- | --- |
| Credentials | `Authorization` and `Proxy-Authorization` headers, bearer tokens, credentials in URLs |
| Provider secrets | JWTs, AWS access keys, GitHub and Slack tokens, OpenAI-style keys |
| Assigned secrets | `password=`, `token:`, `api_key=` and similar key/value pairs |
| Session state | `Cookie` and `Set-Cookie` headers |
| PII | Email addresses |

The set is conservative by design: it targets high-signal, recognizable secrets to avoid mangling legitimate content, and it errs toward masking a value when a key name marks it as sensitive.

## The rule

**Redaction happens at capture, before exposure.** An excerpt is redacted as it is placed into an evidence object; a header is masked as a HAR is parsed; text is cleaned as it is read. There is no window in which an analyzer holds an un-redacted secret in something it will emit. The evidence model enforces this at construction, so it cannot be bypassed by forgetting a step.

## What redaction does and does not touch

- It masks values in what the platform **emits** — findings, evidence excerpts, parsed summaries, stdout.
- It does **not** rewrite the user's artifacts on disk; those belong to the user, and the platform reads them, it does not alter them.
- It preserves structure: a masked header keeps its name, a redacted URL keeps its path, so the finding stays useful while the secret is gone.

## Detection versus redaction

Alongside masking, the platform can *detect* secrets — report that a secret of a given type is present, and where, without surfacing its value. This lets a skill warn "this artifact contains credentials" and decide whether to expose it at all, which is a stronger protection than masking after the fact for especially sensitive flows.

## Verification

Redaction is implemented by the analysis core's redaction module and is unit-tested to confirm that known secrets never survive into emitted output and that ordinary text is left intact. It is the security foundation the whole platform stands on, so it is tested as such.
