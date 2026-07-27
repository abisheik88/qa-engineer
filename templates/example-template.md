# Example: {{scenario title}}

{{One worked example per file, named for its scenario (e.g. failing-ci-run.md). Examples are evaluated in review against the skill's own contract and guardrails — an example that violates its skill is a defect twice over.}}

## Request

```text
/{{skill-name}} {{a request a practitioner would actually make}}
```

## Context

{{The repository and artifact state this example assumes: which files exist, what failed, what the project profile says. Enough that a reviewer can judge whether the behavior below is correct.}}

## Expected behavior

1. {{What the skill does, step by step, traceable to its Procedure section.}}
2. {{Include the verification steps, not just the actions.}}

## Expected output

{{The summary, files, or report produced. If the skill emits a structured report, show the JSON — it must validate against the skill's contract, with redacted, realistic values.}}
