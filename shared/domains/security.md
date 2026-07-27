# Security (Client-Side, Test Scope)

How to audit the client-side security signals a QA suite can reasonably check. Scoped deliberately: this is front-end, test-time hygiene — not penetration testing or a substitute for a security program. Consumed by the audit skill.

## Best practices

- **Best practice:** check the security headers a page sets — Content-Security-Policy, HSTS, X-Content-Type-Options, X-Frame-Options / frame-ancestors — since their absence is a common, detectable gap.
- **Best practice:** verify cookie flags on session cookies — `Secure`, `HttpOnly`, and an appropriate `SameSite` — from the response, since missing flags are a frequent client-side weakness.
- **Recommendation:** flag mixed content (HTTP subresources on an HTTPS page) and obvious reflected-input rendering, as smells worth a human security review — not as proof of a vulnerability.
- **Known limitation:** automated client-side checks find hygiene issues, not exploits. An audit must say so and route real concerns to a security review, never imply the app is "secure".

## Common failures

- Missing or weak CSP, missing HSTS, or permissive framing.
- Session cookies without `HttpOnly`/`Secure`/`SameSite`.
- Mixed content and secrets accidentally exposed in client responses.

## Detection signals

- Absent or weak security headers in the response (readable from a HAR or the network log).
- Session cookies lacking the expected flags.
- HTTP resources loaded by an HTTPS page.

## Repair guidance

- Map each finding to its remediation (set the header, add the cookie flag, upgrade the subresource) and rank by severity.
- Route anything beyond hygiene (potential XSS, auth bypass) to a security specialist rather than asserting a verdict.
- **Recommendation only, with redaction:** findings cite evidence, and any credential or token in that evidence is redacted by the analysis platform before it appears.

## Framework notes

- **Playwright / Cypress:** headers and cookies are readable from the network layer (`response.headers()`, `cy.intercept`), and a HAR can be exported for the analysis platform's HAR analyzer.
- **Selenium / WebdriverIO:** header inspection needs CDP (Chromium) or a proxy; **known limitation:** cross-browser header capture is uneven, so a HAR-based check is more portable.

## Anti-patterns

- **Anti-pattern:** reporting a passing client-side scan as "secure" — it overstates scope dangerously; state the limits.
- **Anti-pattern:** including real tokens or PII in a security finding — always redacted; the finding names the issue, not the secret.

## Future extension

Dependency/CVE surface checks and CSP-effectiveness analysis would extend this, still within the honest client-side scope.
