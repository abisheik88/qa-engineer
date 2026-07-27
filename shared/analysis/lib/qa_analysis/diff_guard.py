"""The diff guard: a deterministic protection layer against unsafe "fixes".

Given a unified diff of test code, it flags changes that make a suite pass
without proving the software works. Each flag explains why it is unsafe. It
never edits; it only judges.

The guard has two jobs, and they pull against each other:

1. **Catch every way a suite is made to lie.** Deleting or weakening
   assertions, skipping, forcing a pass, excluding specs from the run, making the
   test command always exit zero, swallowing failures, inflating timeouts,
   deleting test files.
2. **Not cry wolf on real repairs.** Healing a stale locator *is* the job of
   `/qa-fix`, and it necessarily rewrites an assertion line. A guard that flags
   every legitimate repair as `high` trains the agent — and the human — to
   override it, which is worse than having no guard.

Job 2 is why assertions are compared by **strength** rather than by presence. An
assertion replaced by one that is at least as strong, keeping the same expected
values, is a modification worth confirming (`low`) — not a removal (`high`). An
assertion replaced by a weaker one, or one that drops the expected value, is
`weakened-assertion` (`high`), because that is how a test quietly stops checking
anything.
"""

import re

# --- assertion recognition ---------------------------------------------------

_ASSERTION = re.compile(r"(?i)\b(expect|assert|should|toBe|toEqual|toHaveText|toBeVisible|toContain|assertThat)\b")

# Matchers that pin a specific value or state. Replacing one of these with a
# weaker matcher means the test no longer checks what it used to.
_STRONG_MATCHERS = re.compile(
    r"(?i)\b(toBe|toEqual|toStrictEqual|toHaveText|toContainText|toHaveValue|toHaveURL|"
    r"toHaveTitle|toHaveCount|toHaveLength|toHaveAttribute|toHaveClass|toHaveScreenshot|"
    r"toMatch|toMatchObject|toMatchSnapshot|toBeVisible|toBeChecked|toBeEnabled|toBeDisabled|"
    r"toBeEmpty|toBeGreaterThan|toBeLessThan|toBeCloseTo|"
    r"assertEqual|assertEquals|assertIn|assertTrue|assertFalse|isEqualTo|containsExactly)\b"
)

# Matchers that only prove something exists or is loosely truthy.
_WEAK_MATCHERS = re.compile(
    r"(?i)\b(toBeDefined|toBeUndefined|toBeTruthy|toBeFalsy|toBeNull|toBeNaN|toBeAttached|"
    r"toBeOk|assertIsNotNone|assertIsNone|isNotNull|isNotEmpty|notNull|toBeInstanceOf)\b"
)

# A soft assertion does not stop the test at the point of failure; swapping a
# hard assertion for a soft one weakens it.
_SOFT_ASSERTION = re.compile(r"(?i)\b(expect\.soft|softAssert|assertSoftly)\b")

# String and numeric literals — the expected values an assertion pins down.
_STRING_LITERAL = re.compile(r"""(['"])((?:(?!\1).){2,})\1""")
_NUMBER_LITERAL = re.compile(r"(?<![\w.])\d+(?:\.\d+)?(?![\w.])")

_IDENTIFIER = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")

# --- unsafe-change patterns --------------------------------------------------

_SKIP_ADDED = re.compile(
    r"(?i)(\.skip\b|\.fixme\b|\bxit\b|\bxdescribe\b|test\.skip|it\.skip|describe\.skip|"
    r"@pytest\.mark\.skip|@Ignore\b|@Disabled\b|\.only\b|this\.skip\(|t\.Skip\()"
)
_FORCED_PASS = re.compile(
    r"(?i)(assert\s+True\b|expect\(true\)\.toBe\(true\)|expect\(1\)\.toBe\(1\)|"
    r"return\s*;?\s*//\s*pass|assert\s+1\s*==\s*1|pass\s*#\s*(?:todo|skip|pass))"
)

# A bare early return inside a test body ends the test before it verifies
# anything — the quietest way to fake a pass. Only value-free returns count, so
# `return page.click(...)` and `return await expect(...)` stay clean.
_EARLY_RETURN = re.compile(r"^\s*(?:if\s*\(.*?\)\s*\{?\s*)?return\s*;?\s*\}?\s*$")

# Excluding specs from the run drops coverage without touching a test file.
_SUITE_EXCLUSION = re.compile(
    r"(?i)(testIgnore|testPathIgnorePatterns|excludeSpecPattern|"
    r"exclude\s*[:=]|ignorePatterns|--grep-invert|--ignore-pattern|"
    r"specs?\s*:\s*\[\s*\]|testMatch\s*[:=]\s*\[\s*\])"
)

# Making the test command exit zero regardless of the result.
_FORCED_PASS_COMMAND = re.compile(
    r"(?i)(\|\|\s*true\b|\|\|\s*exit\s+0\b|;\s*exit\s+0\b|--passWithNoTests\b|"
    r"--pass-with-no-tests\b|continue-on-error\s*:\s*true|set\s+\+e\b|"
    r"-DskipTests\b|--exit-zero\b|\|\|\s*:)"
)

# A catch block that discards the failure.
_SWALLOWED_FAILURE = re.compile(r"(?i)(catch\s*(?:\([^)]*\))?\s*\{\s*\}|except\s*[\w.]*\s*:\s*pass\b)")
_CATCH_ADDED = re.compile(r"(?i)(\bcatch\s*[({]|^\s*except\b)")

_TIMEOUT = re.compile(r"(?i)(timeout|setTimeout|wait_?for|implicitly_wait|setDefaultTimeout)\D{0,20}?(\d{3,})")
# Deliberately excludes `expect(`: an expectation is an assertion, not a wait,
# and including it made this rule unreachable.
_WAIT = re.compile(r"(?i)(waitFor\w*|wait_?for\w*|\.wait\(|awaitVisible|implicitly_wait)")
_LOCATOR = re.compile(r"""(?i)(getBy\w+|locator|find_element|\$\(|css=|xpath=|By\.\w+)""")
_EMPTY_BODY = re.compile(r"(?i)(async\s+)?(\([^)]*\)\s*=>\s*\{\s*\}|function[^{]*\{\s*\}|def\s+test\w*\([^)]*\):\s*pass)")
_RETRY = re.compile(r"(?i)(retries?\s*[:=]\s*(\d+)|\.retry\((\d+)\))")

_TEST_FILE = re.compile(r"(?i)(\.spec\.|\.test\.|_test\.|test_|/tests?/|/e2e/|\.feature$|Test\.java$|Tests\.cs$)")

MASS_DELETION_THRESHOLD = 15

# How much token overlap makes an added assertion the counterpart of a removed
# one. Tuned so a locator rewrite on the same expectation pairs up, while two
# unrelated assertions in the same file do not.
_COUNTERPART_THRESHOLD = 0.34


def _parse_diff(diff_text):
    """Yield (hunk_file, sign, text) for each changed line. sign is '+' or '-'."""
    current = "unknown"
    for line in diff_text.splitlines():
        if line.startswith("+++ ") or line.startswith("--- "):
            path = line[4:].strip()
            if path not in ("/dev/null", ""):
                current = re.sub(r"^[ab]/", "", path)
            continue
        if line.startswith("@@"):
            continue
        if line.startswith("+") and not line.startswith("+++"):
            yield (current, "+", line[1:])
        elif line.startswith("-") and not line.startswith("---"):
            yield (current, "-", line[1:])


def _deleted_files(diff_text):
    """Files whose new side is /dev/null — deleted outright."""
    deleted, pending = set(), None
    for line in diff_text.splitlines():
        if line.startswith("--- "):
            path = line[4:].strip()
            pending = re.sub(r"^[ab]/", "", path) if path != "/dev/null" else None
        elif line.startswith("+++ "):
            if line[4:].strip() == "/dev/null" and pending:
                deleted.add(pending)
            pending = None
    return deleted


def _tokens(text):
    return {t.lower() for t in _IDENTIFIER.findall(text)}


def _literals(text):
    strings = {m.group(2) for m in _STRING_LITERAL.finditer(text)}
    numbers = set(_NUMBER_LITERAL.findall(text))
    return strings, numbers


def _strength(text):
    """3 = pins a value/state, 2 = unclassified assertion, 1 = existence only."""
    if _SOFT_ASSERTION.search(text):
        return 1
    if _WEAK_MATCHERS.search(text) and not _STRONG_MATCHERS.search(text):
        return 1
    if _STRONG_MATCHERS.search(text):
        return 3
    return 2


def _counterpart(removed_text, candidates):
    """The added assertion line most plausibly replacing this removed one."""
    removed_tokens = _tokens(removed_text)
    if not removed_tokens:
        return None
    best, best_score = None, 0.0
    for text in candidates:
        overlap = removed_tokens & _tokens(text)
        score = len(overlap) / max(len(removed_tokens), 1)
        if score > best_score:
            best, best_score = text, score
    return best if best_score >= _COUNTERPART_THRESHOLD else None


def check_diff(diff_text):
    """Analyze a unified diff. Returns a list of issue dicts:
    {rule, severity, file, why, sample}. An empty list means no unsafe change
    was detected (which is not a guarantee of correctness, only of safety)."""
    issues = []
    removed = [(f, t) for f, s, t in _parse_diff(diff_text) if s == "-"]
    added = [(f, t) for f, s, t in _parse_diff(diff_text) if s == "+"]
    deleted_files = _deleted_files(diff_text)

    def flag(rule, severity, file, why, sample):
        issues.append({"rule": rule, "severity": severity, "file": file,
                       "why": why, "sample": str(sample).strip()[:200]})

    added_by_file = {}
    for file, text in added:
        added_by_file.setdefault(file, []).append(text)

    # --- removed or weakened assertions --------------------------------------
    for file, text in removed:
        if _ASSERTION.search(text):
            same_file_added = added_by_file.get(file, [])
            # An identical line re-added is a move, not a change.
            if any(a.strip() == text.strip() for a in same_file_added):
                continue

            assertion_candidates = [a for a in same_file_added if _ASSERTION.search(a)]
            replacement = _counterpart(text, assertion_candidates)

            if replacement is None:
                if file in deleted_files:
                    continue  # reported once as a deleted test file, below
                flag("removed-assertion", "high", file,
                     "An assertion or expectation was removed with nothing replacing it; "
                     "a test that no longer asserts proves nothing.", text)
                continue

            old_strength, new_strength = _strength(text), _strength(replacement)
            old_strings, old_numbers = _literals(text)
            new_strings, new_numbers = _literals(replacement)
            dropped_strings = old_strings - new_strings
            dropped_numbers = old_numbers - new_numbers

            if new_strength < old_strength:
                flag("weakened-assertion", "high", file,
                     "An assertion was replaced by a weaker one (existence or truthiness "
                     "instead of a specific value or state); the test can now pass without "
                     "the behaviour being correct.", replacement)
            elif dropped_strings or dropped_numbers:
                dropped = sorted(dropped_strings | dropped_numbers)
                flag("weakened-assertion", "high", file,
                     "An assertion kept its matcher but dropped the expected value(s) "
                     f"{dropped}; it no longer pins down what it used to.", replacement)
            else:
                flag("assertion-modified", "low", file,
                     "An assertion was rewritten with equal or greater strength and the same "
                     "expected values — consistent with a legitimate repair. Confirm it still "
                     "targets the same behaviour.", replacement)

        if _WAIT.search(text) and not _ASSERTION.search(text):
            flag("removed-wait", "medium", file,
                 "A wait/synchronization was removed, which can mask a real failure or "
                 "introduce flakiness.", text)

    # --- added skips, forced passes, early returns, empty bodies -------------
    for file, text in added:
        if _SKIP_ADDED.search(text):
            flag("added-skip-or-only", "high", file,
                 "A skip/ignore/only marker was added; skipping or narrowing hides failures "
                 "instead of fixing them.", text)
        if _FORCED_PASS.search(text):
            flag("forced-pass", "high", file,
                 "A tautological or forced-pass assertion was added; it makes the test pass "
                 "without checking behavior.", text)
        if _EMPTY_BODY.search(text):
            flag("empty-test-body", "high", file,
                 "A test body was emptied; an empty test passes vacuously.", text)
        if _EARLY_RETURN.match(text) and _TEST_FILE.search(file):
            flag("conditional-skip", "high", file,
                 "An unconditional or condition-guarded early return was added to a test; "
                 "the test exits before verifying anything, which is a skip in disguise.", text)
        if _SUITE_EXCLUSION.search(text):
            flag("suite-exclusion", "high", file,
                 "Specs were excluded from the run (ignore pattern, exclusion list, or empty "
                 "spec list); coverage is dropped without any test file changing.", text)
        if _FORCED_PASS_COMMAND.search(text):
            flag("forced-pass-command", "high", file,
                 "The test command was made to succeed regardless of the result "
                 "(`|| true`, `exit 0`, `--passWithNoTests`, `continue-on-error`); the suite "
                 "can no longer fail a pipeline.", text)
        if _SWALLOWED_FAILURE.search(text):
            flag("swallowed-failure", "high", file,
                 "A failure is caught and discarded; an assertion inside a swallowed catch "
                 "cannot fail the test.", text)
        elif _CATCH_ADDED.search(text) and _TEST_FILE.search(file):
            flag("added-error-handling", "medium", file,
                 "Error handling was added inside a test; confirm the failure still surfaces "
                 "rather than being caught and logged.", text)

    # --- deleted test files --------------------------------------------------
    for file in sorted(deleted_files):
        if _TEST_FILE.search(file):
            flag("test-file-deleted", "high", file,
                 "A test file was deleted outright; every case it held stops running, "
                 "regardless of the file's size.", file)

    # --- timeout inflation and unsafe retry increases -------------------------
    _flag_numeric_inflation(_TIMEOUT, removed, added, "timeout-inflation", "medium",
                            "A timeout was increased substantially, which can paper over a real slowness or hang.", flag)
    _flag_numeric_inflation(_RETRY, removed, added, "unsafe-retry-increase", "medium",
                            "Retry count was increased, which can convert a real failure into an intermittent pass.", flag)

    # --- suspicious locator changes ------------------------------------------
    removed_locators = {f: t for f, t in removed if _LOCATOR.search(t)}
    for file, text in added:
        if _LOCATOR.search(text) and file in removed_locators and text.strip() != removed_locators[file].strip():
            flag("suspicious-locator-change", "low", file,
                 "A locator was changed; confirm it targets the same element and was not "
                 "loosened to pass.", text)

    # --- mass deletion per file ----------------------------------------------
    per_file = {}
    for file, _ in removed:
        per_file[file] = per_file.get(file, 0) + 1
    for file, count in per_file.items():
        if count >= MASS_DELETION_THRESHOLD and file not in deleted_files:
            flag("mass-deletion", "high", file,
                 f"{count} lines were deleted from a test file; large deletions can silently drop coverage.",
                 f"{count} lines removed")

    return issues


def _flag_numeric_inflation(pattern, removed, added, rule, severity, why, flag):
    def max_number(text):
        nums = [int(n) for n in re.findall(r"\d{2,}", text)]
        return max(nums) if nums else None

    removed_by_file = {}
    for file, text in removed:
        if pattern.search(text):
            value = max_number(text)
            if value is not None:
                removed_by_file.setdefault(file, []).append(value)
    for file, text in added:
        if pattern.search(text):
            new_value = max_number(text)
            if new_value is None:
                continue
            for old_value in removed_by_file.get(file, []):
                if new_value >= old_value * 2 and new_value > old_value:
                    flag(rule, severity, file, why, text)
                    break
