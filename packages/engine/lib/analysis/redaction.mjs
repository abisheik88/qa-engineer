// Credential, secret, token, and PII redaction.
//
// Every analyzer runs artifact text through redaction before it appears in a
// finding, a report, or stdout. Redaction happens as evidence is captured, not
// after — a secret must never reach a model's context or a log.
//
// Ported from qa_analysis/redaction.py, rule for rule and in the same order, and
// held to identical output by scripts/check-engine-parity.mjs. Python's inline
// `(?i)` / `(?im)` flags become JavaScript flag letters; every rule carries `g`
// because Python's `re.sub` replaces all occurrences.

export class RedactionError extends Error {}

// Ordered. Order matters: match structured, high-signal secrets (JWTs, provider
// keys) before generic fallbacks.
const RULES = [
  { name: 'jwt', pattern: /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g },
  { name: 'aws-access-key', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'github-token', pattern: /gh[pousr]_[A-Za-z0-9]{20,}/g },
  { name: 'slack-token', pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { name: 'openai-key', pattern: /sk-[A-Za-z0-9]{20,}/g },
  { name: 'bearer', pattern: /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi },
  // Sensitive header lines: keep the header name, mask the value.
  //
  // The value is `[^\r\n]+` rather than `.+$`, and the indent is `[ \t]*` rather
  // than `\s*`, because `$` and `\s` do not mean the same thing in Python and
  // JavaScript on CRLF text: Python's `.+$` swallowed the carriage return and
  // rewrote the line ending to LF. Anchoring on a negated class removes the
  // difference and stops the redactor corrupting a document it only meant to mask.
  {
    name: 'auth-header',
    pattern: /^([ \t]*(?:authorization|proxy-authorization)[ \t]*[:=][ \t]*)[^\r\n]+/gim,
    replacement: '$1[REDACTED:auth-header]',
  },
  {
    name: 'cookie-header',
    pattern: /^([ \t]*(?:set-cookie|cookie)[ \t]*[:=][ \t]*)[^\r\n]+/gim,
    replacement: '$1[REDACTED:cookie-header]',
  },
  // Secret-like assignments: key=value / "key": "value".
  {
    name: 'assigned-secret',
    pattern: /(\b(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret)\b\s*[:=]\s*["']?)([^\s"'&]{4,})/gi,
    replacement: '$1[REDACTED:secret]',
  },
  // Credentials in URLs and query strings.
  {
    name: 'url-credential',
    pattern: /(:\/\/[^:/@\s]+:)([^@/\s]+)(@)/gi,
    replacement: '$1[REDACTED:credential]$3',
  },
  {
    name: 'query-secret',
    pattern: /([?&](?:password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key)=)([^&\s#]+)/gi,
    replacement: '$1[REDACTED:secret]',
  },
  // PII: email addresses.
  { name: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
];

const SENSITIVE_HEADERS = new Set([
  'authorization', 'proxy-authorization', 'cookie', 'set-cookie',
  'x-api-key', 'x-auth-token', 'api-key', 'x-csrf-token',
]);

/** Return text with every recognized secret or PII value masked. */
export function redactText(text) {
  if (!text) return text;
  let result = String(text);
  for (const rule of RULES) {
    // A fresh regex per call: `g` regexes carry lastIndex, and a module-level
    // pattern reused across calls would skip matches unpredictably.
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    result = result.replace(pattern, rule.replacement ?? `[REDACTED:${rule.name}]`);
  }
  return result;
}

/**
 * Return `[{type, start, end}]` for secrets found — never the values.
 *
 * Used to decide whether an artifact is safe to expose without surfacing the
 * secret itself.
 */
export function detectSecrets(text) {
  const findings = [];
  if (!text) return findings;
  const source = String(text);
  for (const rule of RULES) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    for (const match of source.matchAll(pattern)) {
      findings.push({ type: rule.name, start: match.index, end: match.index + match[0].length });
    }
  }
  // Stable sort by position, so two secrets at the same offset keep rule order.
  findings.sort((a, b) => a.start - b.start);
  return findings;
}

/**
 * Mask the values of sensitive HTTP headers.
 *
 * Accepts an object, or an array of `{name, value}` entries (the HAR shape), and
 * returns the same shape with sensitive values replaced.
 */
export function redactHeaders(headers) {
  const mask = (name, value) =>
    SENSITIVE_HEADERS.has(String(name).trim().toLowerCase())
      ? '[REDACTED:header]'
      : redactText(value);

  if (Array.isArray(headers)) {
    return headers.map((entry) =>
      entry && typeof entry === 'object' && 'name' in entry
        ? { ...entry, value: mask(String(entry.name), String(entry.value ?? '')) }
        : entry,
    );
  }
  if (headers && typeof headers === 'object') {
    return Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key, mask(key, String(value))]),
    );
  }
  return headers;
}

export const RULE_NAMES = RULES.map((rule) => rule.name);
