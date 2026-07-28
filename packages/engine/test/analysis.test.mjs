// Tests for the Node engine's own behaviour.
//
// These are not the parity gate. Parity (scripts/check-engine-parity.mjs) proves
// the Node output equals the Python output over a shared corpus, and it goes away
// when Python does. These tests state what the engine must do on its own terms, so
// the behaviour survives the parity harness being deleted.
//
// The XML reader gets the most attention, because it is the one thing here that
// replaces a battle-tested standard-library parser with hand-written code. Its
// job is not to be a complete XML implementation — it is to read the subset the
// pack's artifacts use and to *refuse* everything else rather than guess.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseXml, find, findAll, XmlError } from '../lib/analysis/xml.mjs';
import { parseJUnitText, MalformedArtifact } from '../lib/analysis/junit.mjs';
import { redactText, detectSecrets, redactHeaders } from '../lib/analysis/redaction.mjs';
import { classify, UNKNOWN, LOCATOR, ASSERTION, TIMEOUT, AUTH } from '../lib/analysis/taxonomy.mjs';

test('xml: reads tags, attributes, text, and nesting', () => {
  const root = parseXml('<a x="1"><b>text</b><b>more</b><c/></a>');
  assert.equal(root.tag, 'a');
  assert.equal(root.attrs.x, '1');
  assert.equal(findAll(root, 'b').length, 2);
  assert.equal(find(root, 'b').text, 'text');
  assert.equal(find(root, 'c').children.length, 0);
  assert.equal(find(root, 'missing'), null);
});

test('xml: decodes the predefined entities and numeric references', () => {
  const root = parseXml('<a t="&lt;b&gt; &amp; &quot;q&quot; &apos;s&apos;">&#65;&#x42;</a>');
  assert.equal(root.attrs.t, '<b> & "q" \'s\'');
  assert.equal(root.text, 'AB');
});

test('xml: an unknown entity is left alone rather than dropped', () => {
  // Silently deleting it would change the evidence a reader is shown.
  assert.equal(parseXml('<a>&nbsp;</a>').text, '&nbsp;');
});

test('xml: CDATA is literal', () => {
  assert.equal(parseXml('<a><![CDATA[< & > not entities]]></a>').text, '< & > not entities');
});

test('xml: skips prologs, comments, and doctypes', () => {
  const root = parseXml('<?xml version="1.0"?><!DOCTYPE a><!-- hi --><a><!-- in --><b/></a>');
  assert.equal(root.tag, 'a');
  assert.equal(root.children.length, 1);
});

test('xml: refuses malformed documents instead of guessing', () => {
  const bad = [
    ['unterminated tag', '<a'],
    ['unclosed element', '<a><b></a>'],
    ['stray close', '</a>'],
    ['two roots', '<a/><b/>'],
    ['no root', 'just text'],
    ['empty', ''],
    ['unquoted attribute', '<a x=1/>'],
    ['unterminated comment', '<a><!-- forever</a>'],
    ['unterminated CDATA', '<a><![CDATA[forever</a>'],
    ['mismatched close', '<a></b>'],
  ];
  for (const [label, source] of bad) {
    assert.throws(() => parseXml(source), XmlError, `should have refused: ${label}`);
  }
});

test('xml: a parse error names the line, so a big report can be located', () => {
  try {
    parseXml('<a>\n<b>\n<c>\n</a>');
    assert.fail('expected a refusal');
  } catch (error) {
    assert.match(error.message, /line 4/);
  }
});

test('junit: normalizes a suites-wrapped document', () => {
  const result = parseJUnitText(
    '<testsuites><testsuite><testcase name="a" classname="f.spec.ts" time="1.5"/>' +
      '<testcase name="b"><failure message="boom"/></testcase>' +
      '<testcase name="c"><skipped/></testcase></testsuite></testsuites>',
  );
  assert.deepEqual(result.tests, { total: 3, passed: 1, failed: 1, skipped: 1 });
  assert.equal(result.executed[0].durationMs, 1500);
  assert.equal(result.executed[0].file, 'f.spec.ts');
  assert.equal(result.executed[1].message, 'boom');
});

test('junit: a bare testsuite root is accepted', () => {
  assert.equal(parseJUnitText('<testsuite><testcase name="a"/></testsuite>').tests.total, 1);
});

test('junit: a non-JUnit document is refused', () => {
  assert.throws(() => parseJUnitText('<html><body/></html>'), MalformedArtifact);
});

test('junit: an unreadable duration is refused, not silently zeroed', () => {
  // Zeroing it would turn a malformed document into a plausible result.
  for (const value of ['not-a-number', 'nan', 'inf', '1.2.3', '5s']) {
    assert.throws(
      () => parseJUnitText(`<testsuite><testcase name="a" time="${value}"/></testsuite>`),
      MalformedArtifact,
      `should have refused time="${value}"`,
    );
  }
});

test('junit: an absent or empty duration is zero', () => {
  for (const xml of [
    '<testsuite><testcase name="a"/></testsuite>',
    '<testsuite><testcase name="a" time=""/></testsuite>',
  ]) {
    assert.equal(parseJUnitText(xml).executed[0].durationMs, 0);
  }
});

test('junit: failure messages are redacted at parse time', () => {
  const result = parseJUnitText(
    '<testsuite><testcase name="a"><failure message="password=hunter2"/></testcase></testsuite>',
  );
  assert.ok(!result.executed[0].message.includes('hunter2'));
  assert.match(result.executed[0].message, /REDACTED/);
});

test('redaction: masks each secret kind and leaves ordinary text alone', () => {
  const plain = 'The checkout test failed after clicking Pay twice.';
  assert.equal(redactText(plain), plain);
  for (const secret of [
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk',
    'AKIAIOSFODNN7EXAMPLE',
    'ghp_abcdefghijklmnopqrstuvwxyz0123456789',
    'someone@example.com',
  ]) {
    const out = redactText(`prefix ${secret} suffix`);
    assert.ok(!out.includes(secret), `leaked: ${secret}`);
    assert.match(out, /REDACTED/);
  }
});

test('redaction: replaces every occurrence, not just the first', () => {
  const out = redactText('a@b.com and c@d.com and e@f.com');
  assert.equal(out.match(/REDACTED:email/g).length, 3);
});

test('redaction: a literal $1 in the input is not treated as a backreference', () => {
  // `String.replace` expands `$1` in the *replacement*; an input containing `$1`
  // must survive untouched, or the redactor corrupts the evidence around a secret.
  const out = redactText('cost $1 and $& and password=abcd');
  assert.match(out, /cost \$1 and \$& and/);
});

test('redaction: CRLF endings survive', () => {
  const text = 'GET /pay\r\nAuthorization: Bearer abc\r\nbody\r\n';
  const out = redactText(text);
  assert.equal(out.match(/\r\n/g).length, 3);
  assert.equal((out.match(/\n/g) ?? []).length, 3);
  assert.ok(!out.includes('Bearer abc'));
});

test('redaction: detectSecrets reports positions and types, never values', () => {
  const found = detectSecrets('Authorization: Bearer eyJa.bbb.ccc');
  assert.ok(found.length > 0);
  for (const item of found) {
    assert.deepEqual(Object.keys(item).sort(), ['end', 'start', 'type']);
  }
  // Sorted by position, so a caller can slice around them.
  assert.deepEqual([...found].sort((a, b) => a.start - b.start), found);
});

test('redaction: sensitive headers are masked in both shapes', () => {
  const asList = redactHeaders([
    { name: 'Authorization', value: 'Bearer secret' },
    { name: 'Accept', value: 'text/html' },
  ]);
  assert.equal(asList[0].value, '[REDACTED:header]');
  assert.equal(asList[1].value, 'text/html');

  const asObject = redactHeaders({ Cookie: 'sid=1', Accept: 'text/html' });
  assert.equal(asObject.Cookie, '[REDACTED:header]');
  assert.equal(asObject.Accept, 'text/html');
});

test('taxonomy: a timeout budget printed inside an assertion failure is not a timeout', () => {
  // The whole reason the rule order is what it is.
  const { classification } = classify(
    'Timed out 5000ms waiting for expect(locator).toHaveText(expected)\n\n' +
      'Expected: "Total: 42"\nReceived: "Total: 0"',
  );
  assert.equal(classification, ASSERTION);
});

test('taxonomy: a missing element is a locator failure, not a timeout', () => {
  assert.equal(
    classify('Error: element(s) not found\nCall log: waiting for locator("#cart")').classification,
    LOCATOR,
  );
});

test('taxonomy: a real timeout is still a timeout', () => {
  assert.equal(classify('Test timeout of 30000ms exceeded.').classification, TIMEOUT);
});

test('taxonomy: an HTTP status outweighs the message text', () => {
  assert.equal(classify('Timed out', 401).classification, AUTH);
});

test('taxonomy: an unrecognized signal is unknown, not a guess', () => {
  const { classification, confidence } = classify('something nobody has seen before');
  assert.equal(classification, UNKNOWN);
  assert.ok(confidence < 0.5);
});
