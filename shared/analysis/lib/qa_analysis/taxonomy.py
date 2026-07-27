"""The canonical QA failure taxonomy and its deterministic classifier.

Classification maps observed signals to one of a closed set of failure classes.
It is rule-based and conservative: when no rule matches with sufficient signal,
the result is UNKNOWN. Unknown is preferable to incorrect.
"""

import re

# The closed set of failure classifications. Every value implies a different
# owner and next action; if two would lead to the same action, they are merged.
ASSERTION = "assertion-failure"
LOCATOR = "locator-failure"
TIMEOUT = "timeout"
NETWORK = "network"
AUTH = "authentication"
AUTHORIZATION = "authorization"
ENVIRONMENT = "environment"
CONFIGURATION = "configuration"
INFRASTRUCTURE = "infrastructure"
TEST_DATA = "test-data"
APPLICATION_BUG = "application-bug"
FRAMEWORK = "framework-failure"
FLAKY = "flaky"
UNKNOWN = "unknown"

CLASSES = {
    ASSERTION, LOCATOR, TIMEOUT, NETWORK, AUTH, AUTHORIZATION, ENVIRONMENT,
    CONFIGURATION, INFRASTRUCTURE, TEST_DATA, APPLICATION_BUG, FRAMEWORK,
    FLAKY, UNKNOWN,
}

# Ordered rules: (classification, message-pattern, confidence, reason).
# Order encodes priority — a locator timeout is a locator failure, not a bare
# timeout, so the locator rule precedes the timeout rule.
_RULES = [
    (LOCATOR, re.compile(r"(?i)(no such element|element .*not (?:found|visible|attached)|locator.*(?:resolved to 0|not found)|waiting for (?:locator|selector))"), 0.8,
     "Error indicates the target element could not be found or resolved."),
    (TIMEOUT, re.compile(r"(?i)(timeout|timed out|exceeded .*ms|deadline exceeded)"), 0.75,
     "Error indicates an operation exceeded its time budget."),
    (AUTH, re.compile(r"(?i)(401 unauthorized|authentication failed|invalid (?:credentials|token)|login failed|not authenticated)"), 0.85,
     "Error indicates an authentication failure — the identity could not be established."),
    (AUTHORIZATION, re.compile(r"(?i)(403 forbidden|permission denied|access denied|not authorized|forbidden\b|insufficient (?:permission|privilege))"), 0.85,
     "Error indicates an authorization failure — the identity lacked permission."),
    (NETWORK, re.compile(r"(?i)(ECONNREFUSED| ENOTFOUND|net::ERR|connection (?:refused|reset)|5\d\d (?:internal server error|bad gateway|service unavailable)|fetch failed)"), 0.8,
     "Error indicates a network or upstream service failure."),
    (ASSERTION, re.compile(r"(?i)(assertion|expect(?:ed)?\b|toBe|toEqual|toHaveText|toBeVisible|AssertionError|expected .* (?:to|but))"), 0.7,
     "Error indicates an assertion did not hold."),
    (TEST_DATA, re.compile(r"(?i)(duplicate key|constraint violation|no rows|seed data|fixture .*(?:missing|not found)|invalid test data)"), 0.7,
     "Error indicates a test-data problem."),
    (CONFIGURATION, re.compile(r"(?i)(cannot find module|config(?:uration)? (?:error|not found)|missing (?:config|environment variable)|unknown option)"), 0.7,
     "Error indicates a configuration problem."),
    (ENVIRONMENT, re.compile(r"(?i)(base ?url|env(?:ironment)? .*(?:not set|missing)|ECONNREFUSED .*localhost|dev server)"), 0.6,
     "Error indicates an environment problem such as a missing base URL or unreachable local service."),
    (INFRASTRUCTURE, re.compile(r"(?i)(out of memory|OOM|disk (?:full|space)|browser .*(?:crash|closed unexpectedly)|worker .*(?:died|crashed))"), 0.7,
     "Error indicates an infrastructure problem such as a crash or resource exhaustion."),
    (FRAMEWORK, re.compile(r"(?i)(internal error|unexpected error in (?:playwright|selenium|cypress|webdriver)|driver .*mismatch)"), 0.6,
     "Error indicates a fault in the test framework or driver itself."),
]


def classify(message, http_status=None):
    """Classify a failure from its error message and optional HTTP status.

    Returns (classification, confidence, reason). Never guesses: an
    unrecognized signal yields UNKNOWN at low confidence with an honest reason.
    """
    text = message or ""

    # A concrete HTTP status is stronger evidence than message text.
    if http_status is not None:
        if http_status == 401:
            return (AUTH, 0.9, "HTTP 401 indicates an authentication failure.")
        if http_status == 403:
            return (AUTHORIZATION, 0.9, "HTTP 403 indicates an authorization failure.")
        if 500 <= http_status <= 599:
            return (NETWORK, 0.85, f"HTTP {http_status} indicates an upstream server failure.")

    for classification, pattern, confidence, reason in _RULES:
        if pattern.search(text):
            return (classification, confidence, reason)

    return (UNKNOWN, 0.2, "No classification rule matched the available signals; manual review needed.")
