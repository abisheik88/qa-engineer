// The diff guard: a deterministic protection layer against unsafe "fixes".
//
// Given a unified diff of test code, it flags changes that make a suite pass
// without proving the software works. Each flag explains why it is unsafe. It
// never edits; it only judges.
//
// The guard has two jobs, and they pull against each other:
//
// 1. **Catch every way a suite is made to lie.** Deleting or weakening
//    assertions, skipping, forcing a pass, excluding specs from the run, making
//    the test command always exit zero, swallowing failures, inflating timeouts,
//    deleting test files.
// 2. **Not cry wolf on real repairs.** Healing a stale locator *is* the job of
//    `/qa-fix`, and it necessarily rewrites an assertion line. A guard that flags
//    every legitimate repair as `high` trains the agent — and the human — to
//    override it, which is worse than having no guard.
//
// Job 2 is why assertions are compared by **strength** rather than by presence. An
// assertion replaced by one that is at least as strong, keeping the same expected
// values, is a modification worth confirming (`low`) — not a removal (`high`). An
// assertion replaced by a weaker one, or one that drops the expected value, is
// `weakened-assertion` (`high`), because that is how a test quietly stops checking
// anything.

// --- assertion recognition ---------------------------------------------------

const ASSERTION = /\b(expect|assert|should|toBe|toEqual|toHaveText|toBeVisible|toContain|assertThat)\b/i;

// Matchers that pin a specific value or state. Replacing one of these with a
// weaker matcher means the test no longer checks what it used to.
const STRONG_MATCHERS = new RegExp(
  '\\b(toBe|toEqual|toStrictEqual|toHaveText|toContainText|toHaveValue|toHaveURL|' +
    'toHaveTitle|toHaveCount|toHaveLength|toHaveAttribute|toHaveClass|toHaveScreenshot|' +
    'toMatch|toMatchObject|toMatchSnapshot|toBeVisible|toBeChecked|toBeEnabled|toBeDisabled|' +
    'toBeEmpty|toBeGreaterThan|toBeLessThan|toBeCloseTo|' +
    'assertEqual|assertEquals|assertIn|assertTrue|assertFalse|isEqualTo|containsExactly)\\b',
  'i',
);

// Matchers that only prove something exists or is loosely truthy.
const WEAK_MATCHERS = new RegExp(
  '\\b(toBeDefined|toBeUndefined|toBeTruthy|toBeFalsy|toBeNull|toBeNaN|toBeAttached|' +
    'toBeOk|assertIsNotNone|assertIsNone|isNotNull|isNotEmpty|notNull|toBeInstanceOf)\\b',
  'i',
);

// A soft assertion does not stop the test at the point of failure; swapping a hard
// assertion for a soft one weakens it.
const SOFT_ASSERTION = /\b(expect\.soft|softAssert|assertSoftly)\b/i;

// String and numeric literals — the expected values an assertion pins down.
const STRING_LITERAL = /(['"])((?:(?!\1).){2,})\1/g;
const NUMBER_LITERAL = /(?<![\w.])\d+(?:\.\d+)?(?![\w.])/g;

const IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/g;

// --- unsafe-change patterns --------------------------------------------------

const SKIP_ADDED = new RegExp(
  '(\\.skip\\b|\\.fixme\\b|\\bxit\\b|\\bxdescribe\\b|test\\.skip|it\\.skip|describe\\.skip|' +
    '@pytest\\.mark\\.skip|@Ignore\\b|@Disabled\\b|\\.only\\b|this\\.skip\\(|t\\.Skip\\()',
  'i',
);
const FORCED_PASS = new RegExp(
  '(assert\\s+True\\b|expect\\(true\\)\\.toBe\\(true\\)|expect\\(1\\)\\.toBe\\(1\\)|' +
    'return\\s*;?\\s*//\\s*pass|assert\\s+1\\s*==\\s*1|pass\\s*#\\s*(?:todo|skip|pass))',
  'i',
);

// A bare early return inside a test body ends the test before it verifies anything
// — the quietest way to fake a pass. Only value-free returns count, so
// `return page.click(...)` and `return await expect(...)` stay clean.
const EARLY_RETURN = /^\s*(?:if\s*\(.*?\)\s*\{?\s*)?return\s*;?\s*\}?\s*$/;

// Excluding specs from the run drops coverage without touching a test file.
const SUITE_EXCLUSION = new RegExp(
  '(testIgnore|testPathIgnorePatterns|excludeSpecPattern|' +
    'exclude\\s*[:=]|ignorePatterns|--grep-invert|--ignore-pattern|' +
    'specs?\\s*:\\s*\\[\\s*\\]|testMatch\\s*[:=]\\s*\\[\\s*\\])',
  'i',
);

// Making the test command exit zero regardless of the result.
const FORCED_PASS_COMMAND = new RegExp(
  '(\\|\\|\\s*true\\b|\\|\\|\\s*exit\\s+0\\b|;\\s*exit\\s+0\\b|--passWithNoTests\\b|' +
    '--pass-with-no-tests\\b|continue-on-error\\s*:\\s*true|set\\s+\\+e\\b|' +
    '-DskipTests\\b|--exit-zero\\b|\\|\\|\\s*:)',
  'i',
);

// A catch block that discards the failure.
const SWALLOWED_FAILURE = /(catch\s*(?:\([^)]*\))?\s*\{\s*\}|except\s*[\w.]*\s*:\s*pass\b)/i;
const CATCH_ADDED = /(\bcatch\s*[({]|^\s*except\b)/i;

const TIMEOUT = /(timeout|setTimeout|wait_?for|implicitly_wait|setDefaultTimeout)\D{0,20}?(\d{3,})/i;
// Deliberately excludes `expect(`: an expectation is an assertion, not a wait, and
// including it made this rule unreachable.
const WAIT = /(waitFor\w*|wait_?for\w*|\.wait\(|awaitVisible|implicitly_wait)/i;
const LOCATOR = /(getBy\w+|locator|find_element|\$\(|css=|xpath=|By\.\w+)/i;
const EMPTY_BODY = /(async\s+)?(\([^)]*\)\s*=>\s*\{\s*\}|function[^{]*\{\s*\}|def\s+test\w*\([^)]*\):\s*pass)/i;
const RETRY = /(retries?\s*[:=]\s*(\d+)|\.retry\((\d+)\))/i;

const TEST_FILE = /(\.spec\.|\.test\.|_test\.|test_|\/tests?\/|\/e2e\/|\.feature$|Test\.java$|Tests\.cs$)/i;

export const MASS_DELETION_THRESHOLD = 15;

// How much token overlap makes an added assertion the counterpart of a removed
// one. Tuned so a locator rewrite on the same expectation pairs up, while two
// unrelated assertions in the same file do not.
const COUNTERPART_THRESHOLD = 0.34;

/** Yield `[file, sign, text]` for each changed line. Sign is '+' or '-'. */
function parseDiff(diffText) {
  const changes = [];
  let current = 'unknown';
  for (const line of String(diffText).split('\n')) {
    if (line.startsWith('+++ ') || line.startsWith('--- ')) {
      const candidate = line.slice(4).trim();
      if (candidate !== '/dev/null' && candidate !== '') {
        current = candidate.replace(/^[ab]\//, '');
      }
      continue;
    }
    if (line.startsWith('@@')) continue;
    if (line.startsWith('+') && !line.startsWith('+++')) changes.push([current, '+', line.slice(1)]);
    else if (line.startsWith('-') && !line.startsWith('---')) changes.push([current, '-', line.slice(1)]);
  }
  return changes;
}

/** Files whose new side is /dev/null — deleted outright. */
function deletedFiles(diffText) {
  const deleted = new Set();
  let pending = null;
  for (const line of String(diffText).split('\n')) {
    if (line.startsWith('--- ')) {
      const candidate = line.slice(4).trim();
      pending = candidate !== '/dev/null' ? candidate.replace(/^[ab]\//, '') : null;
    } else if (line.startsWith('+++ ')) {
      if (line.slice(4).trim() === '/dev/null' && pending) deleted.add(pending);
      pending = null;
    }
  }
  return deleted;
}

function tokens(text) {
  return new Set([...String(text).matchAll(IDENTIFIER)].map((m) => m[0].toLowerCase()));
}

/**
 * The part of an assertion that carries its expected value.
 *
 * `expect(page.locator('#total')).toHaveText('42')` has two literals, and only one
 * of them is an expectation: `'#total'` is the *subject* — which element to look at
 * — and `'42'` is what the test claims about it. Scanning the whole line treated the
 * selector as an expected value, so the canonical `/qa-fix` repair
 *
 *     -expect(page.locator('#total')).toHaveText('42')
 *     +expect(page.getByTestId('total')).toHaveText('42')
 *
 * was reported as `weakened-assertion` at `high` severity for "dropping" the
 * selector, even though the assertion is unchanged. That is a false positive on the
 * exact case this module's second job exists to protect.
 */
function expectedPart(text) {
  let earliest = null;
  for (const pattern of [STRONG_MATCHERS, WEAK_MATCHERS]) {
    const match = pattern.exec(text);
    if (match && (earliest === null || match.index < earliest)) earliest = match.index;
  }
  return earliest === null ? text : text.slice(earliest);
}

function literals(text) {
  const scope = expectedPart(String(text));
  const strings = new Set([...scope.matchAll(STRING_LITERAL)].map((m) => m[2]));
  const numbers = new Set([...scope.matchAll(NUMBER_LITERAL)].map((m) => m[0]));
  return { strings, numbers };
}

/** 3 = pins a value or state, 2 = unclassified assertion, 1 = existence only. */
function strength(text) {
  if (SOFT_ASSERTION.test(text)) return 1;
  if (WEAK_MATCHERS.test(text) && !STRONG_MATCHERS.test(text)) return 1;
  if (STRONG_MATCHERS.test(text)) return 3;
  return 2;
}

/** The added assertion line most plausibly replacing this removed one. */
function counterpart(removedText, candidates) {
  const removedTokens = tokens(removedText);
  if (removedTokens.size === 0) return null;
  let best = null;
  let bestScore = 0;
  for (const text of candidates) {
    const candidateTokens = tokens(text);
    let overlap = 0;
    for (const token of removedTokens) if (candidateTokens.has(token)) overlap += 1;
    const score = overlap / Math.max(removedTokens.size, 1);
    if (score > bestScore) {
      best = text;
      bestScore = score;
    }
  }
  return bestScore >= COUNTERPART_THRESHOLD ? best : null;
}

/**
 * Analyze a unified diff.
 *
 * Returns `[{rule, severity, file, why, sample}]`. An empty list means no unsafe
 * change was detected — which is not a guarantee of correctness, only of safety.
 */
export function checkDiff(diffText) {
  const issues = [];
  const changes = parseDiff(diffText);
  const removed = changes.filter(([, sign]) => sign === '-').map(([file, , text]) => [file, text]);
  const added = changes.filter(([, sign]) => sign === '+').map(([file, , text]) => [file, text]);
  const deleted = deletedFiles(diffText);

  const flag = (rule, severity, file, why, sample) => {
    issues.push({ rule, severity, file, why, sample: String(sample).trim().slice(0, 200) });
  };

  const addedByFile = new Map();
  for (const [file, text] of added) {
    if (!addedByFile.has(file)) addedByFile.set(file, []);
    addedByFile.get(file).push(text);
  }

  // --- removed or weakened assertions ---------------------------------------
  for (const [file, text] of removed) {
    if (ASSERTION.test(text)) {
      const sameFileAdded = addedByFile.get(file) ?? [];
      // An identical line re-added is a move, not a change.
      if (sameFileAdded.some((line) => line.trim() === text.trim())) continue;

      const candidates = sameFileAdded.filter((line) => ASSERTION.test(line));
      const replacement = counterpart(text, candidates);

      if (replacement === null) {
        if (deleted.has(file)) continue; // reported once as a deleted test file, below
        flag('removed-assertion', 'high', file,
          'An assertion or expectation was removed with nothing replacing it; ' +
            'a test that no longer asserts proves nothing.', text);
        continue;
      }

      const oldStrength = strength(text);
      const newStrength = strength(replacement);
      const before = literals(text);
      const after = literals(replacement);
      const droppedStrings = [...before.strings].filter((value) => !after.strings.has(value));
      const droppedNumbers = [...before.numbers].filter((value) => !after.numbers.has(value));

      if (newStrength < oldStrength) {
        flag('weakened-assertion', 'high', file,
          'An assertion was replaced by a weaker one (existence or truthiness ' +
            'instead of a specific value or state); the test can now pass without ' +
            'the behaviour being correct.', replacement);
      } else if (droppedStrings.length > 0 || droppedNumbers.length > 0) {
        // A set union, as the Python implementation used: the literal "42" is
        // matched both as a string and as a number, and reporting it twice would
        // read as two dropped values when only one was dropped.
        const dropped = [...new Set([...droppedStrings, ...droppedNumbers])].sort();
        flag('weakened-assertion', 'high', file,
          'An assertion kept its matcher but dropped the expected value(s) ' +
            `${formatList(dropped)}; it no longer pins down what it used to.`, replacement);
      } else {
        flag('assertion-modified', 'low', file,
          'An assertion was rewritten with equal or greater strength and the same ' +
            'expected values — consistent with a legitimate repair. Confirm it still ' +
            'targets the same behaviour.', replacement);
      }
    }

    if (WAIT.test(text) && !ASSERTION.test(text)) {
      flag('removed-wait', 'medium', file,
        'A wait/synchronization was removed, which can mask a real failure or ' +
          'introduce flakiness.', text);
    }
  }

  // --- added skips, forced passes, early returns, empty bodies --------------
  for (const [file, text] of added) {
    if (SKIP_ADDED.test(text)) {
      flag('added-skip-or-only', 'high', file,
        'A skip/ignore/only marker was added; skipping or narrowing hides failures ' +
          'instead of fixing them.', text);
    }
    if (FORCED_PASS.test(text)) {
      flag('forced-pass', 'high', file,
        'A tautological or forced-pass assertion was added; it makes the test pass ' +
          'without checking behavior.', text);
    }
    if (EMPTY_BODY.test(text)) {
      flag('empty-test-body', 'high', file,
        'A test body was emptied; an empty test passes vacuously.', text);
    }
    if (EARLY_RETURN.test(text) && TEST_FILE.test(file)) {
      flag('conditional-skip', 'high', file,
        'An unconditional or condition-guarded early return was added to a test; ' +
          'the test exits before verifying anything, which is a skip in disguise.', text);
    }
    if (SUITE_EXCLUSION.test(text)) {
      flag('suite-exclusion', 'high', file,
        'Specs were excluded from the run (ignore pattern, exclusion list, or empty ' +
          'spec list); coverage is dropped without any test file changing.', text);
    }
    if (FORCED_PASS_COMMAND.test(text)) {
      flag('forced-pass-command', 'high', file,
        'The test command was made to succeed regardless of the result ' +
          '(`|| true`, `exit 0`, `--passWithNoTests`, `continue-on-error`); the suite ' +
          'can no longer fail a pipeline.', text);
    }
    if (SWALLOWED_FAILURE.test(text)) {
      flag('swallowed-failure', 'high', file,
        'A failure is caught and discarded; an assertion inside a swallowed catch ' +
          'cannot fail the test.', text);
    } else if (CATCH_ADDED.test(text) && TEST_FILE.test(file)) {
      flag('added-error-handling', 'medium', file,
        'Error handling was added inside a test; confirm the failure still surfaces ' +
          'rather than being caught and logged.', text);
    }
  }

  // --- deleted test files ---------------------------------------------------
  for (const file of [...deleted].sort()) {
    if (TEST_FILE.test(file)) {
      flag('test-file-deleted', 'high', file,
        'A test file was deleted outright; every case it held stops running, ' +
          "regardless of the file's size.", file);
    }
  }

  // --- timeout inflation and unsafe retry increases -------------------------
  flagNumericInflation(TIMEOUT, removed, added, 'timeout-inflation', 'medium',
    'A timeout was increased substantially, which can paper over a real slowness or hang.', flag);
  flagNumericInflation(RETRY, removed, added, 'unsafe-retry-increase', 'medium',
    'Retry count was increased, which can convert a real failure into an intermittent pass.', flag);

  // --- suspicious locator changes ------------------------------------------
  // Last removed locator per file wins, matching the dict comprehension this
  // replaces — the most recent removal is the one an addition is compared against.
  const removedLocators = new Map();
  for (const [file, text] of removed) {
    if (LOCATOR.test(text)) removedLocators.set(file, text);
  }
  for (const [file, text] of added) {
    if (
      LOCATOR.test(text) &&
      removedLocators.has(file) &&
      text.trim() !== removedLocators.get(file).trim()
    ) {
      flag('suspicious-locator-change', 'low', file,
        'A locator was changed; confirm it targets the same element and was not ' +
          'loosened to pass.', text);
    }
  }

  // --- mass deletion per file ----------------------------------------------
  const perFile = new Map();
  for (const [file] of removed) perFile.set(file, (perFile.get(file) ?? 0) + 1);
  for (const [file, count] of perFile) {
    if (count >= MASS_DELETION_THRESHOLD && !deleted.has(file)) {
      flag('mass-deletion', 'high', file,
        `${count} lines were deleted from a test file; large deletions can silently drop coverage.`,
        `${count} lines removed`);
    }
  }

  return issues;
}

/**
 * Python renders a list of dropped values with `repr()`, which single-quotes each
 * one. The message text is part of what a reviewer reads, so it is reproduced
 * rather than approximated.
 */
function formatList(values) {
  return `[${values.map((value) => `'${value}'`).join(', ')}]`;
}

/**
 * Compare the number each rule's own pattern captured, before and after.
 *
 * A shared `\d{2,}` scan of the line — two or more digits — made
 * `unsafe-retry-increase` unreachable for every realistic retry count, because
 * `retries: 1` to `retries: 5` is all single digits: a declared safety rule that
 * could not fire below ten. On a line carrying more than one number
 * (`timeout: 5000, port: 8080`) it also compared the wrong one.
 */
function flagNumericInflation(pattern, removed, added, rule, severity, why, flag) {
  const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  const maxNumber = (text) => {
    const values = [];
    for (const match of String(text).matchAll(global)) {
      for (const group of match.slice(1)) {
        if (group !== undefined && /^\d+$/.test(group)) values.push(Number.parseInt(group, 10));
      }
    }
    return values.length > 0 ? Math.max(...values) : null;
  };

  const removedByFile = new Map();
  for (const [file, text] of removed) {
    if (!pattern.test(text)) continue;
    const value = maxNumber(text);
    if (value === null) continue;
    if (!removedByFile.has(file)) removedByFile.set(file, []);
    removedByFile.get(file).push(value);
  }
  for (const [file, text] of added) {
    if (!pattern.test(text)) continue;
    const newValue = maxNumber(text);
    if (newValue === null) continue;
    for (const oldValue of removedByFile.get(file) ?? []) {
      if (newValue >= oldValue * 2 && newValue > oldValue) {
        flag(rule, severity, file, why, text);
        break;
      }
    }
  }
}
