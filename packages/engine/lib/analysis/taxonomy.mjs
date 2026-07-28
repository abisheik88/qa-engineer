// The canonical QA failure taxonomy and its deterministic classifier.
//
// Classification maps observed signals to one of a closed set of failure classes.
// It is rule-based and conservative: when no rule matches with sufficient signal,
// the result is UNKNOWN. Unknown is preferable to incorrect.
//
// Ported from qa_analysis/taxonomy.py with the rule order preserved exactly —
// order *is* the logic here (see the note on the first two rules) — and held to
// identical output by scripts/check-engine-parity.mjs.

export const ASSERTION = 'assertion-failure';
export const LOCATOR = 'locator-failure';
export const TIMEOUT = 'timeout';
export const NETWORK = 'network';
export const AUTH = 'authentication';
export const AUTHORIZATION = 'authorization';
export const ENVIRONMENT = 'environment';
export const CONFIGURATION = 'configuration';
export const INFRASTRUCTURE = 'infrastructure';
export const TEST_DATA = 'test-data';
export const APPLICATION_BUG = 'application-bug';
export const FRAMEWORK = 'framework-failure';
export const FLAKY = 'flaky';
export const UNKNOWN = 'unknown';

export const CLASSES = new Set([
  ASSERTION, LOCATOR, TIMEOUT, NETWORK, AUTH, AUTHORIZATION, ENVIRONMENT,
  CONFIGURATION, INFRASTRUCTURE, TEST_DATA, APPLICATION_BUG, FRAMEWORK,
  FLAKY, UNKNOWN,
]);

// Ordered rules: [classification, pattern, confidence, reason].
//
// Order encodes priority, and the first two rules exist because modern runners
// print a timeout budget in *every* assertion failure. Playwright's message for a
// plain text mismatch ends with "Timeout: 5000ms" even though nothing timed out,
// so a naive timeout rule captures assertion and locator failures alike and sends
// the reader to raise a timeout — the one action guaranteed not to help. The
// patterns below are derived from real captured runner output.
//
// The discriminators, from that output:
//   element missing  -> "Error: element(s) not found"   (no Received: value)
//   value mismatch   -> "Expected: X" + "Received: Y"   (element was resolved)
//   real timeout     -> a timeout with neither of the above
const RULES = [
  [LOCATOR, /(no such element|element(?:\(s\))?\s+not\s+(?:found|visible|attached)|locator.*(?:resolved to 0|not found)|waiting for (?:locator|selector)|unable to locate element)/i, 0.8,
    'Error indicates the target element could not be found or resolved.'],
  // A concrete expected-vs-received comparison is an assertion result, not a
  // time budget: the runner resolved the target and compared values.
  [ASSERTION, /expected:.*received:/is, 0.8,
    'Error shows a concrete expected-versus-received comparison, so the assertion did not hold.'],
  [TIMEOUT, /(timeout|timed out|exceeded .*ms|deadline exceeded)/i, 0.75,
    'Error indicates an operation exceeded its time budget.'],
  [AUTH, /(401 unauthorized|authentication failed|invalid (?:credentials|token)|login failed|not authenticated)/i, 0.85,
    'Error indicates an authentication failure — the identity could not be established.'],
  [AUTHORIZATION, /(403 forbidden|permission denied|access denied|not authorized|forbidden\b|insufficient (?:permission|privilege))/i, 0.85,
    'Error indicates an authorization failure — the identity lacked permission.'],
  [NETWORK, /(ECONNREFUSED| ENOTFOUND|net::ERR|connection (?:refused|reset)|5\d\d (?:internal server error|bad gateway|service unavailable)|fetch failed)/i, 0.8,
    'Error indicates a network or upstream service failure.'],
  [ASSERTION, /(assertion|expect(?:ed)?\b|toBe|toEqual|toHaveText|toBeVisible|AssertionError|expected .* (?:to|but))/i, 0.7,
    'Error indicates an assertion did not hold.'],
  [TEST_DATA, /(duplicate key|constraint violation|no rows|seed data|fixture .*(?:missing|not found)|invalid test data)/i, 0.7,
    'Error indicates a test-data problem.'],
  [CONFIGURATION, /(cannot find module|config(?:uration)? (?:error|not found)|missing (?:config|environment variable)|unknown option)/i, 0.7,
    'Error indicates a configuration problem.'],
  [ENVIRONMENT, /(base ?url|env(?:ironment)? .*(?:not set|missing)|ECONNREFUSED .*localhost|dev server)/i, 0.6,
    'Error indicates an environment problem such as a missing base URL or unreachable local service.'],
  [INFRASTRUCTURE, /(out of memory|OOM|disk (?:full|space)|browser .*(?:crash|closed unexpectedly)|worker .*(?:died|crashed))/i, 0.7,
    'Error indicates an infrastructure problem such as a crash or resource exhaustion.'],
  [FRAMEWORK, /(internal error|unexpected error in (?:playwright|selenium|cypress|webdriver)|driver .*mismatch)/i, 0.6,
    'Error indicates a fault in the test framework or driver itself.'],
];

/**
 * Classify a failure from its error message and optional HTTP status.
 *
 * Returns `{classification, confidence, reason}`. Never guesses: an unrecognized
 * signal yields UNKNOWN at low confidence with an honest reason.
 */
export function classify(message, httpStatus = null) {
  const text = message || '';

  // A concrete HTTP status is stronger evidence than message text.
  if (httpStatus !== null && httpStatus !== undefined) {
    if (httpStatus === 401) {
      return { classification: AUTH, confidence: 0.9, reason: 'HTTP 401 indicates an authentication failure.' };
    }
    if (httpStatus === 403) {
      return { classification: AUTHORIZATION, confidence: 0.9, reason: 'HTTP 403 indicates an authorization failure.' };
    }
    if (httpStatus >= 500 && httpStatus <= 599) {
      return {
        classification: NETWORK,
        confidence: 0.85,
        reason: `HTTP ${httpStatus} indicates an upstream server failure.`,
      };
    }
  }

  for (const [classification, pattern, confidence, reason] of RULES) {
    if (pattern.test(text)) return { classification, confidence, reason };
  }

  return {
    classification: UNKNOWN,
    confidence: 0.2,
    reason: 'No classification rule matched the available signals; manual review needed.',
  };
}
