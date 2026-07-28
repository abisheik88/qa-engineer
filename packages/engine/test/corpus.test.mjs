// The corpus snapshot: every input the Python-parity gate checked, still checked.
//
// While both engines existed, scripts/check-engine-parity.mjs ran them over a shared
// corpus and failed on any difference. That gate found six real defects and could
// not survive the Python engine being deleted — so before deleting it, the corpus
// was run one final time with parity green, and the engine's output recorded.
//
// The snapshot is therefore not "whatever the code happened to do". It is behaviour
// that was proven equivalent to a second independent implementation, frozen. That
// makes it a baseline worth defending: a diff here means the engine's answer to a
// known input changed, and the only correct responses are to fix the change or to
// regenerate deliberately (packages/engine/test/corpus/generate.mjs) and read the
// diff as the review.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { record } from './corpus/record.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const expected = JSON.parse(fs.readFileSync(path.join(here, 'corpus/expected.json'), 'utf8'));
const actual = record();

for (const section of Object.keys(expected)) {
  test(`corpus: ${section} matches the parity-verified baseline`, () => {
    // Compared per entry, so a failure names the input rather than dumping the
    // whole section.
    const left = expected[section];
    const right = actual[section];
    if (Array.isArray(left)) {
      assert.equal(right.length, left.length, `${section}: entry count changed`);
      left.forEach((entry, index) => {
        assert.deepEqual(right[index], entry, `${section}[${index}] changed`);
      });
    } else {
      assert.deepEqual(right, left);
    }
  });
}

test('corpus: the recorded sections are all still produced', () => {
  // A section silently disappearing from the recorder would make its cases stop
  // being checked while every remaining test still passed.
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
});

test('corpus: the corpus is not empty in any section', () => {
  for (const [section, value] of Object.entries(actual)) {
    const size = Array.isArray(value) ? value.length : Object.keys(value).length;
    assert.ok(size > 0, `${section} has no cases`);
  }
});
