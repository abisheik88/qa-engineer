#!/usr/bin/env node
// Regenerate the recorded corpus output.
//
// The snapshot in `expected.json` was first produced while the Python engine still
// existed and `scripts/check-engine-parity.mjs` was green over the same inputs — so
// it records behaviour that was proven equivalent, not merely current. That is why
// it is trustworthy as a baseline and why it must not be regenerated casually:
// running this script accepts whatever the engine does today as correct.
//
// Regenerate only when a change to the output is *intended*, and then read the diff
// — it is the review.
//
//   node packages/engine/test/corpus/generate.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { record } from './record.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
fs.writeFileSync(path.join(here, 'expected.json'), `${JSON.stringify(record(), null, 2)}\n`);
process.stdout.write('expected.json regenerated — read the diff before committing it\n');
