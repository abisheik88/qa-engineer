# Example: a failed login (authentication)

Distinguishes authentication (identity could not be established) from a product bug. The owner is the auth setup, not the product.

## Request

```text
/qa-debug login test keeps failing
```

## Context

`auth > signs in` failed. The analysis result cites a network entry `POST /api/session → 401` and a console message "invalid credentials". No product 5xx.

## Expected behavior

1. Gather results; the 401 is the decisive signal.
2. The engine classifies `authentication` (HTTP 401 outranks message text), owner "auth-or-test-setup", P1 (high severity).
3. Verify: a 401 is authentication, not authorization (which would be 403) and not a product bug.
4. Recommend fixing the credentials or auth setup — never weakening the auth check.

## Expected output

`qa-artifacts/qa-debug-3f2b.json`:

```json
{
  "contract": { "name": "qa-debug/debug-result", "version": "1.0.0" },
  "skill": { "name": "qa-debug", "version": "0.1.0" },
  "generatedAt": "2026-07-19T09:20:00Z",
  "summary": "The login test failed authentication: POST /api/session returned 401 with 'invalid credentials'. The test's credentials or auth setup are wrong — the app is behaving correctly.",
  "classification": "authentication",
  "confidence": 0.9,
  "evidence": [
    { "type": "network", "description": "Session request rejected", "source": "session.har", "excerpt": "POST /api/session -> 401" },
    { "type": "console", "description": "Auth error message", "source": "trace.zip", "excerpt": "invalid credentials" }
  ],
  "rootCause": {
    "classification": "authentication",
    "confidence": 0.9,
    "reason": "A 401 on the session request indicates the identity could not be established — an authentication failure.",
    "ownership": "auth-or-test-setup",
    "recommendation": "Fix the credentials or auth setup; do not weaken the authentication check."
  },
  "priority": {
    "severity": "high", "priority": "P1",
    "businessImpact": "high", "technicalImpact": "medium", "testingImpact": "medium",
    "confidence": 0.9, "owner": "auth-or-test-setup", "estimatedEffort": "medium"
  },
  "timeline": [
    { "order": 0, "phase": "execution-start", "detail": "Run started", "source": "execution-result", "timestamp": "2026-07-19T09:15:00Z" },
    { "order": 1, "phase": "response", "detail": "POST /api/session returned 401", "source": "session.har" },
    { "order": 2, "phase": "console-error", "detail": "invalid credentials", "source": "trace.zip" },
    { "order": 3, "phase": "failure", "detail": "Test failed: signs in", "source": "e2e/auth.spec.ts" }
  ],
  "recommendations": [
    { "action": "Verify the test account's credentials and the auth setup; the app returned a correct 401.", "priority": "P1", "owner": "auth-or-test-setup" }
  ],
  "metadata": {}
}
```
