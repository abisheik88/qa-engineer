// Tests for the `.qa/context.md` parser.
//
// This is the file every skill reads to learn what the project is, so the failure
// that matters is not "cannot parse" — it is parsing something *different* from
// what the author wrote. A skill acting on a misread context makes confident
// decisions about a project that does not exist.
//
// So the supported subset is tested for what it produces, and everything outside
// it is tested for being refused.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  parse,
  parseFile,
  parseFrontmatter,
  splitFrontmatter,
  MalformedContext,
} from '../lib/analysis/context.mjs';

test('context: scalars are typed, not left as strings', () => {
  const parsed = parseFrontmatter(
    'schemaVersion: 1\nratio: 1.5\nmonorepo: false\nmcp: true\nbuildTool: null\nother: ~\nempty:\nquoted: "1"\n',
  );
  assert.deepEqual(parsed, {
    schemaVersion: 1,
    ratio: 1.5,
    monorepo: false,
    mcp: true,
    buildTool: null,
    other: null,
    empty: null,
    quoted: '1',
  });
});

test('context: nested mappings and block sequences', () => {
  const parsed = parseFrontmatter(
    'language:\n  primary: "typescript"\n  others:\n    - "javascript"\n    - "css"\nruntime:\n  node: "20.x"\n',
  );
  assert.deepEqual(parsed, {
    language: { primary: 'typescript', others: ['javascript', 'css'] },
    runtime: { node: '20.x' },
  });
});

test('context: a sequence flush with its key, then a following key', () => {
  assert.deepEqual(parseFrontmatter('packages:\n- a\n- b\nnext: 1\n'), {
    packages: ['a', 'b'],
    next: 1,
  });
});

test('context: empty flow collections are the only flow collections allowed', () => {
  assert.deepEqual(parseFrontmatter('a: []\nb: {}\n'), { a: [], b: {} });
  assert.throws(() => parseFrontmatter('a: [1, 2]\n'), MalformedContext);
  assert.throws(() => parseFrontmatter('a: {k: v}\n'), MalformedContext);
});

test('context: a trailing comment is stripped, a quoted hash is not', () => {
  assert.equal(parseFrontmatter('e2e: "playwright"   # detected\n').e2e, 'playwright');
  assert.equal(parseFrontmatter('glob: "e2e/**/*#tag.spec.ts"\n').glob, 'e2e/**/*#tag.spec.ts');
});

test('context: everything outside the subset is refused, not guessed at', () => {
  const rejected = [
    ['block scalar', 'body: |\n  text\n'],
    ['folded scalar', 'body: >\n  text\n'],
    ['anchor', 'a: &anchor value\n'],
    ['alias', 'a: *anchor\n'],
    ['tab indent', 'a: 1\n\tb: 2\n'],
    ['neither key nor item', 'just some words\n'],
    ['empty key', ': value\n'],
    ['item at the root', '- item\n'],
  ];
  for (const [label, text] of rejected) {
    assert.throws(() => parseFrontmatter(text), MalformedContext, `should have refused: ${label}`);
  }
});

test('context: a mapping key sharing indent with a sequence entry is refused', () => {
  // YAML itself rejects this ("expected <block end>, but found '?'"), and the
  // parser used to close the sequence and promote the key to the root mapping —
  // producing a plausible object from a file nobody could have meant.
  assert.throws(
    () => parseFrontmatter('list:\n  - one\n  key: inside a sequence\n'),
    /matches no open block/,
  );
});

test('context: a line indented past every open block is refused', () => {
  assert.throws(() => parseFrontmatter('a: 1\n    b: 2\n'), MalformedContext);
});

test('context: frontmatter and body are separated, and the body keeps its own dashes', () => {
  const { context, body } = parse('---\nkey: value\n---\n# Notes\n\nProse with --- inside.\n');
  assert.deepEqual(context, { key: 'value' });
  assert.match(body, /Prose with --- inside\./);
});

test('context: missing or unterminated frontmatter is refused', () => {
  assert.throws(() => splitFrontmatter('no fence here\n'), /no frontmatter/);
  assert.throws(() => splitFrontmatter('---\nkey: value\n'), /unterminated frontmatter/);
});

test('context: a parse failure is thrown, not reported as an invalid result', () => {
  // "unparseable" and "parseable but wrong" are different answers, and collapsing
  // them would report a broken file as merely non-conforming.
  assert.throws(() => parse('no frontmatter\n', { schema: { type: 'object' } }), MalformedContext);
});

test('context: with a schema, a conforming document is valid and a wrong one is not', () => {
  const schema = {
    type: 'object',
    required: ['schemaVersion'],
    properties: { schemaVersion: { type: 'integer' } },
  };
  assert.equal(parse('---\nschemaVersion: 1\n---\n', { schema }).valid, true);

  const wrong = parse('---\nschemaVersion: "one"\n---\n', { schema });
  assert.equal(wrong.valid, false);
  assert.ok(wrong.errors.length > 0);
});

test('context: the real generated fixture parses to its full structure', () => {
  const fixture = new URL('./fixtures/valid-context.md', import.meta.url).pathname;
  const { context } = parseFile(fixture);
  assert.equal(context.schemaVersion, 1);
  assert.equal(context.testFramework.e2e, 'playwright');
  assert.deepEqual(context.repository.packages, []);
  assert.equal(context.repository.monorepo, false);
});

test('context: an unreadable file throws MalformedContext, not a raw fs error', () => {
  assert.throws(
    () => parseFile(path.join(os.tmpdir(), 'qa-no-such-context.md')),
    MalformedContext,
  );
});

test('context: a file with CRLF endings parses the same as one with LF', () => {
  const lf = parse('---\na: 1\nb:\n  c: "x"\n---\nbody\n');
  const crlf = parse('---\r\na: 1\r\nb:\r\n  c: "x"\r\n---\r\nbody\r\n');
  assert.deepEqual(crlf.context, lf.context);
});

test('context: a temp file round-trips through parseFile', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qa-ctx-')), 'context.md');
  fs.writeFileSync(file, '---\nschemaVersion: 1\n---\nnarrative\n');
  try {
    assert.deepEqual(parseFile(file).context, { schemaVersion: 1 });
  } finally {
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  }
});
