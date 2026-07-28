#!/usr/bin/env node
// Engine parity gate: the Node engine must produce exactly what Python produces.
//
// The pack is moving its deterministic engine from Python to Node so that it needs
// one runtime instead of two (see ADR-0012). A reimplementation of 3,500 lines of
// analysis code is the kind of change that goes subtly wrong: a `(?i)` flag that
// did not survive translation, a `\1` that should be `$1`, a rounding rule that
// differs on the boundary. Those are not caught by "does it run" — they are caught
// by running both and comparing.
//
// So Python stays in the repository until this gate is green for every module, and
// no module is switched over before its row here passes. When the last Python
// module is deleted, this gate goes with it; until then it is what makes the port
// safe rather than hopeful.
//
// Corpus: tests/parity/engine-cases.json, plus the real framework fixtures under
// shared/analysis/lib/tests/fixtures/.
//
// Run: node scripts/check-engine-parity.mjs

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { redactText, detectSecrets, redactHeaders } from '../packages/engine/lib/analysis/redaction.mjs';
import { classify } from '../packages/engine/lib/analysis/taxonomy.mjs';
import { parseJUnitText, MalformedArtifact } from '../packages/engine/lib/analysis/junit.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cases = JSON.parse(fs.readFileSync(path.join(root, 'tests/parity/engine-cases.json'), 'utf8'));
const fixtures = path.join(root, 'shared/analysis/lib/tests/fixtures');

function python(source, payload) {
  const result = spawnSync('python3', ['-c', source], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    cwd: root,
    env: { ...process.env, PYTHONPATH: path.join(root, 'shared/analysis/lib') },
  });
  if (result.status !== 0) {
    throw new Error(`python side failed: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

const problems = [];
let compared = 0;

function compare(module, label, expected, actual) {
  compared += 1;
  const a = JSON.stringify(expected);
  const b = JSON.stringify(actual);
  if (a === b) return;
  problems.push(
    `${module}: output differs for ${JSON.stringify(label)}\n` +
      `      python: ${a}\n` +
      `      node:   ${b}`,
  );
}

// --- redaction ---------------------------------------------------------------
{
  const inputs = cases.redaction;
  const expected = python(
    'import json,sys\n' +
      'from qa_analysis import redaction\n' +
      'data = json.load(sys.stdin)\n' +
      'print(json.dumps([{ "redacted": redaction.redact_text(t), "found": redaction.detect_secrets(t) } for t in data]))\n',
    inputs,
  );
  inputs.forEach((input, index) => {
    compare('redaction', input, expected[index], {
      redacted: redactText(input),
      found: detectSecrets(input),
    });
  });

  // Header masking, in both shapes the HAR reader produces.
  const headerCases = [
    { Authorization: 'Bearer abc', 'X-Api-Key': 'k', Accept: 'application/json' },
    [{ name: 'Cookie', value: 'a=1' }, { name: 'Accept', value: 'text/html' }],
    [{ name: 'X-Custom', value: 'password=hunter2' }],
    {},
    [],
  ];
  const expectedHeaders = python(
    'import json,sys\n' +
      'from qa_analysis import redaction\n' +
      'print(json.dumps([redaction.redact_headers(h) for h in json.load(sys.stdin)]))\n',
    headerCases,
  );
  headerCases.forEach((input, index) => {
    compare('redaction.headers', input, expectedHeaders[index], redactHeaders(input));
  });
}

// --- taxonomy ---------------------------------------------------------------
{
  const inputs = cases.classify;
  const expected = python(
    'import json,sys\n' +
      'from qa_analysis import taxonomy\n' +
      'out = []\n' +
      'for case in json.load(sys.stdin):\n' +
      '    c, conf, reason = taxonomy.classify(case.get("message"), http_status=case.get("httpStatus"))\n' +
      '    out.append({"classification": c, "confidence": conf, "reason": reason})\n' +
      'print(json.dumps(out))\n',
    inputs,
  );
  inputs.forEach((input, index) => {
    compare('taxonomy', input, expected[index], classify(input.message, input.httpStatus ?? null));
  });
}

// --- junit ------------------------------------------------------------------
{
  const documents = [...cases.junit];
  // The real thing, from four different frameworks.
  for (const name of fs.readdirSync(fixtures).filter((f) => f.endsWith('.xml'))) {
    documents.push(fs.readFileSync(path.join(fixtures, name), 'utf8'));
  }
  const expected = python(
    'import json,sys,tempfile,os\n' +
      'from qa_analysis.junit import parse_junit, MalformedArtifact\n' +
      'out = []\n' +
      'for doc in json.load(sys.stdin):\n' +
      '    fd, p = tempfile.mkstemp(suffix=".xml")\n' +
      '    os.write(fd, doc.encode("utf-8")); os.close(fd)\n' +
      '    try:\n' +
      '        out.append({"ok": True, "result": parse_junit(p)})\n' +
      '    except MalformedArtifact:\n' +
      '        out.append({"ok": False})\n' +
      '    finally:\n' +
      '        os.unlink(p)\n' +
      'print(json.dumps(out))\n',
    documents,
  );
  documents.forEach((doc, index) => {
    let actual;
    try {
      actual = { ok: true, result: parseJUnitText(doc) };
    } catch (error) {
      if (!(error instanceof MalformedArtifact)) throw error;
      actual = { ok: false };
    }
    compare('junit', doc.slice(0, 70), expected[index], actual);
  });

  // Malformed input must be refused by both, not parsed into a fabricated result.
  const malformed = cases.junitMalformed;
  const expectedMalformed = python(
    'import json,sys,tempfile,os\n' +
      'from qa_analysis.junit import parse_junit, MalformedArtifact\n' +
      'out = []\n' +
      'for doc in json.load(sys.stdin):\n' +
      '    fd, p = tempfile.mkstemp(suffix=".xml")\n' +
      '    os.write(fd, doc.encode("utf-8")); os.close(fd)\n' +
      '    try:\n' +
      '        parse_junit(p); out.append("parsed")\n' +
      '    except MalformedArtifact:\n' +
      '        out.append("refused")\n' +
      '    finally:\n' +
      '        os.unlink(p)\n' +
      'print(json.dumps(out))\n',
    malformed,
  );
  malformed.forEach((doc, index) => {
    let actual = 'parsed';
    try {
      parseJUnitText(doc);
    } catch (error) {
      if (!(error instanceof MalformedArtifact)) throw error;
      actual = 'refused';
    }
    compare('junit.malformed', doc.slice(0, 70), expectedMalformed[index], actual);
    if (actual === 'parsed') {
      problems.push(`junit.malformed: both sides PARSED ${JSON.stringify(doc)} — a malformed document must be refused, not guessed`);
    }
  });
}

if (problems.length) {
  console.error(`engine parity FAILED (${compared} comparisons):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `engine parity OK: ${compared} comparison(s) across redaction, taxonomy, and junit — ` +
    'Node output is identical to Python',
);
