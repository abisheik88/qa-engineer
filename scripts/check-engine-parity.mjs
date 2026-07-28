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
import { parseHarData } from '../packages/engine/lib/analysis/har.mjs';
import { validate as validateContract } from '../packages/engine/lib/analysis/contracts.mjs';
import { discover, isZipFile } from '../packages/engine/lib/analysis/discovery.mjs';
import {
  footerHtml, footerMarkdown, footerText, appendTo,
  footer as brandingFooter, metadata as brandingMetadata,
} from '../packages/engine/lib/analysis/branding.mjs';
import { parse as parseContext, MalformedContext } from '../packages/engine/lib/analysis/context.mjs';

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

// Every module whose Node implementation is held to the Python one. A module is
// only switched over once its name is here and the gate is green.
const MODULES = [
  'redaction', 'taxonomy', 'junit', 'contracts', 'har', 'discovery', 'branding',
  'context',
];

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

// --- contracts ---------------------------------------------------------------
// Validity only, deliberately. The two produce different message prose and
// different path notation ("$.a.b" against "/a/b"), and matching Python's repr()
// formatting in JavaScript would be fragile work with nothing riding on it. What
// must never differ is the verdict: a document that passes one passes the other.
{
  const corpus = JSON.parse(
    fs.readFileSync(path.join(root, 'tests/parity/validator-cases.json'), 'utf8'),
  ).cases;
  const expected = python(
    'import json,sys\n' +
      'from qa_analysis import contracts\n' +
      'out = []\n' +
      'for case in json.load(sys.stdin):\n' +
      '    ok, errors = contracts.validate(case["instance"], case["schema"])\n' +
      '    out.append({"valid": ok, "hasErrors": len(errors) > 0})\n' +
      'print(json.dumps(out))\n',
    corpus,
  );
  corpus.forEach((testCase, index) => {
    const errors = validateContract(testCase.instance, testCase.schema);
    compare('contracts', testCase.name, expected[index], {
      valid: errors.length === 0,
      hasErrors: errors.length > 0,
    });
    // And the corpus's own declared expectation, so a case that both sides get
    // wrong the same way still fails.
    if (errors.length === 0 !== testCase.valid) {
      problems.push(
        `contracts: both validators disagree with the corpus for "${testCase.name}" ` +
          `(corpus says valid=${testCase.valid})`,
      );
    }
  });
}

// --- har ---------------------------------------------------------------------
{
  const documents = [
    JSON.parse(fs.readFileSync(path.join(fixtures, 'sample.har'), 'utf8')),
    { log: { entries: [] } },
    { log: { entries: [{ request: { method: 'GET', url: 'https://u:p@x.test/a' }, response: { status: 200 }, time: 5 }] } },
    { log: { entries: [{ request: { method: 'POST', url: 'https://x.test/a?token=abc123' }, response: { status: 500 }, time: 1500 }] } },
    { log: { entries: [{ response: { status: 0 }, time: 0 }] } },
    { log: { entries: [{ request: { method: 'GET', url: 'https://x.test' }, response: {}, time: 2.5 }] } },
    { log: { entries: [{ request: { method: 'GET', url: 'https://x.test' }, response: { status: '404' }, time: 3.5 }] } },
    { log: { entries: [{ request: { method: 'GET', url: 'https://x.test', headers: [{ name: 'Authorization', value: 'Bearer abc' }] }, response: { status: 200, headers: [{ name: 'Set-Cookie', value: 'sid=1' }] }, time: 1 }] } },
    { log: { entries: [{ request: {}, response: { status: 'not-a-status' }, time: null }] } },
  ];
  const expected = python(
    'import json,sys,tempfile,os\n' +
      'from qa_analysis import har\n' +
      'from qa_analysis.junit import MalformedArtifact\n' +
      'out = []\n' +
      'for doc in json.load(sys.stdin):\n' +
      '    fd, p = tempfile.mkstemp(suffix=".har")\n' +
      '    os.write(fd, json.dumps(doc).encode("utf-8")); os.close(fd)\n' +
      '    try:\n' +
      '        out.append({"ok": True, "result": har.parse_har(p)})\n' +
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
      actual = { ok: true, result: parseHarData(doc) };
    } catch (error) {
      if (!(error instanceof MalformedArtifact)) throw error;
      actual = { ok: false };
    }
    compare('har', JSON.stringify(doc).slice(0, 70), expected[index], actual);
  });

  // A HAR that is not a HAR, and a time that is not a time.
  const rejected = [
    {},
    { log: {} },
    { log: { entries: 'nope' } },
    { log: { entries: [{ time: 'not-a-number' }] } },
  ];
  const expectedRejected = python(
    'import json,sys,tempfile,os\n' +
      'from qa_analysis import har\n' +
      'from qa_analysis.junit import MalformedArtifact\n' +
      'out = []\n' +
      'for doc in json.load(sys.stdin):\n' +
      '    fd, p = tempfile.mkstemp(suffix=".har")\n' +
      '    os.write(fd, json.dumps(doc).encode("utf-8")); os.close(fd)\n' +
      '    try:\n' +
      '        har.parse_har(p); out.append("parsed")\n' +
      '    except MalformedArtifact:\n' +
      '        out.append("refused")\n' +
      '    finally:\n' +
      '        os.unlink(p)\n' +
      'print(json.dumps(out))\n',
    rejected,
  );
  rejected.forEach((doc, index) => {
    let actual = 'parsed';
    try {
      parseHarData(doc);
    } catch (error) {
      if (!(error instanceof MalformedArtifact)) throw error;
      actual = 'refused';
    }
    compare('har.malformed', JSON.stringify(doc), expectedRejected[index], actual);
    if (actual === 'parsed') {
      problems.push(`har.malformed: both sides PARSED ${JSON.stringify(doc)} — it must be refused`);
    }
  });
}

// --- discovery ---------------------------------------------------------------
// Run against a purpose-built tree rather than the repository, so the comparison
// covers the states that matter — an empty file, a corrupt JSON report, a
// truncated trace that still begins with the ZIP magic bytes, a dot-directory
// that a glob must not descend into — and does not depend on what happens to be
// lying around. Timestamps are stripped: they are wall-clock, not a computation.
{
  const tree = fs.mkdtempSync(path.join(root, '.qa-parity-'));
  const write = (relative, contents) => {
    const target = path.join(tree, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  };
  try {
    write('results.xml', '<testsuite/>');
    write('nested/deep/junit-shard-1.xml', '<testsuite/>');
    write('nested/results.json', '{"ok":true}');
    write('broken/report.json', '{not json');
    write('empty/results.xml', '');
    write('playwright-report/index.html', '<html></html>');
    write('custom-report/index.html', '<html></html>');
    write('traces/trace.zip', Buffer.concat([Buffer.from('PK\x03\x04'), Buffer.alloc(40)]));
    write('traces/good-trace.zip', Buffer.concat([Buffer.alloc(10), Buffer.from('PK\x05\x06'), Buffer.alloc(18)]));
    write('net/session.har', '{"log":{"entries":[]}}');
    write('media/run.webm', 'x');
    write('shots/failure.png', 'x');
    write('.hidden/results.xml', '<testsuite/>');
    write('shots/.hidden-actual.png', 'x');

    const strip = (result) => ({
      ...Object.fromEntries(
        ['present', 'partial', 'corrupted'].map((key) => [
          key,
          result[key].map(({ timestamp, ...rest }) => rest),
        ]),
      ),
      missing: result.missing,
    });

    const expected = python(
      'import json,sys\n' +
        'from qa_analysis import discovery\n' +
        'root = json.load(sys.stdin)["root"]\n' +
        'result = discovery.discover(root=root)\n' +
        'print(json.dumps({k: [a.to_dict() for a in v] if k != "missing" else v for k, v in result.items()}))\n',
      { root: tree },
    );
    compare('discovery', 'conventional tree', strip(expected), strip(discover({ root: tree })));

    // Explicit paths, including one that is not there at all.
    const explicit = [
      path.join(tree, 'results.xml'),
      path.join(tree, 'net/session.har'),
      path.join(tree, 'traces/trace.zip'),
      path.join(tree, 'nope/missing.xml'),
      path.join(tree, 'shots/failure.png'),
    ];
    const expectedExplicit = python(
      'import json,sys\n' +
        'from qa_analysis import discovery\n' +
        'payload = json.load(sys.stdin)\n' +
        'result = discovery.discover(root=payload["root"], explicit=payload["explicit"])\n' +
        'print(json.dumps({k: [a.to_dict() for a in v] if k != "missing" else v for k, v in result.items()}))\n',
      { root: tree, explicit },
    );
    compare(
      'discovery.explicit',
      'explicit paths',
      strip(expectedExplicit),
      strip(discover({ root: tree, explicit })),
    );

    // The ZIP check on its own: a truncated archive must not read as intact.
    const zipExpected = python(
      'import json,sys,zipfile\n' +
        'print(json.dumps([zipfile.is_zipfile(p) for p in json.load(sys.stdin)]))\n',
      [
        path.join(tree, 'traces/trace.zip'),
        path.join(tree, 'traces/good-trace.zip'),
        path.join(tree, 'results.xml'),
        path.join(tree, 'empty/results.xml'),
      ],
    );
    [
      'traces/trace.zip',
      'traces/good-trace.zip',
      'results.xml',
      'empty/results.xml',
    ].forEach((relative, index) => {
      compare('discovery.isZipFile', relative, zipExpected[index], isZipFile(path.join(tree, relative)));
    });
  } finally {
    fs.rmSync(tree, { recursive: true, force: true });
  }
}

// --- branding ----------------------------------------------------------------
// Byte-for-byte, all three formats. The footer is the one output where "close
// enough" is visibly wrong: it appears on every report a user shares, and the
// text renderer's centering depends on Python's `str.center` putting the odd
// space on the right. A snapshot in the Python tests pins those exact bytes, so a
// difference here would mean one of the two implementations is off by a space.
{
  const expected = python(
    'import json,sys\n' +
      'from qa_analysis import branding\n' +
      'print(json.dumps({\n' +
      '  "html": branding.footer_html(),\n' +
      '  "markdown": branding.footer_markdown(),\n' +
      '  "text": branding.footer_text(),\n' +
      '  "text40": branding.footer_text(width=40),\n' +
      '  "pdf": branding.footer("pdf"),\n' +
      '  "escapedClass": branding.footer_html(class_name=\'x" onload="alert(1)\'),\n' +
      '  "metadata": branding.metadata(),\n' +
      '  "appendedOnce": branding.append_to("# Report\\n", fmt="markdown"),\n' +
      '  "appendedTwice": branding.append_to(branding.append_to("# Report\\n", fmt="markdown"), fmt="markdown"),\n' +
      '  "appendedHtml": branding.append_to("<h1>R</h1>\\n", fmt="html"),\n' +
      '  "appendedNoTrailingNewline": branding.append_to("no newline", fmt="markdown"),\n' +
      '}))\n',
    {},
  );
  const once = appendTo('# Report\n', 'markdown');
  compare('branding', 'html', expected.html, footerHtml());
  compare('branding', 'markdown', expected.markdown, footerMarkdown());
  compare('branding', 'text', expected.text, footerText());
  compare('branding', 'text width=40', expected.text40, footerText({ width: 40 }));
  compare('branding', 'pdf is the text renderer', expected.pdf, brandingFooter('pdf'));
  compare('branding', 'class name is escaped', expected.escapedClass, footerHtml({ className: 'x" onload="alert(1)' }));
  compare('branding', 'metadata', expected.metadata, brandingMetadata());
  compare('branding', 'appended once', expected.appendedOnce, once);
  compare('branding', 'appending twice does not duplicate', expected.appendedTwice, appendTo(once, 'markdown'));
  compare('branding', 'appended html', expected.appendedHtml, appendTo('<h1>R</h1>\n', 'html'));
  compare('branding', 'appended to text with no trailing newline', expected.appendedNoTrailingNewline, appendTo('no newline', 'markdown'));

  // An unknown format must be refused by both rather than defaulting to one.
  let nodeRefused = false;
  try {
    brandingFooter('docx');
  } catch {
    nodeRefused = true;
  }
  const pythonRefused = python(
    'import json,sys\n' +
      'from qa_analysis import branding\n' +
      'try:\n' +
      '    branding.footer("docx"); print(json.dumps(False))\n' +
      'except branding.BrandingError:\n' +
      '    print(json.dumps(True))\n',
    {},
  );
  compare('branding', 'unknown format is refused', pythonRefused, nodeRefused);
  if (!nodeRefused) problems.push('branding: an unknown format must raise, not fall back to a default');

  // And both must read the SAME file, or "one metadata file" is not true.
  const sharedMetadata = path.join(root, 'shared/analysis/lib/qa_analysis/branding.json');
  const onDisk = JSON.parse(fs.readFileSync(sharedMetadata, 'utf8'));
  compare('branding', 'metadata comes from the one file on disk', onDisk, brandingMetadata());
}

// --- context ------------------------------------------------------------------
// The YAML-subset parser, over the real generated fixture plus every shape the
// subset declares supported and every shape it declares rejected. Two documents
// that parse differently here would give two skills different beliefs about the
// same project, which is worse than either being wrong consistently.
{
  const documents = [
    // The real thing qa-init writes.
    fs.readFileSync(path.join(fixtures, 'valid-context.md'), 'utf8'),
    // Supported shapes.
    '---\nschemaVersion: 1\n---\nbody',
    '---\na: 1\nb: 1.5\nc: true\nd: false\ne: null\nf: ~\ng:\nh: "1"\n---\n',
    '---\nlist:\n  - one\n  - two\n---\n',
    '---\nlist:\n- flush\n- with-key-indent\nnext: after\n---\n',
    '---\nempty: []\nemptyMap: {}\n---\n',
    '---\nnested:\n  deeper:\n    key: value\n---\n',
    '---\nvalue: kept   # this comment is not\n---\n',
    '---\nquoted: "has # inside"\nalso: \'and # here\'\n---\n',
    '---\n# only a comment\n\nkey: value\n---\n',
    "---\nsingle: 'quoted'\ndouble: \"quoted\"\nbare: unquoted words\n---\n",
    '---\nnegative: -5\nnegativeFloat: -1.25\n---\n',
    '---\nkeyWithColonInValue: "a: b"\n---\n',
    '---\nurl: https://example.com/path\n---\n',
    // CRLF, which a Windows generator writes and which the fence and indent
    // handling both have to survive.
    '---\r\na: 1\r\nb:\r\n  c: "x"\r\n---\r\nbody\r\n',
    // Body handling.
    '---\nkey: value\n---\n# Heading\n\nProse with --- inside.\n',
    '---\nkey: value\n---\n',
  ];
  const expected = python(
    'import json,sys\n' +
      'from qa_analysis import context\n' +
      'out = []\n' +
      'for text in json.load(sys.stdin):\n' +
      '    try:\n' +
      '        parsed = context.parse(text)\n' +
      '        out.append({"ok": True, "context": parsed["context"], "body": parsed["body"]})\n' +
      '    except context.MalformedContext as exc:\n' +
      '        out.append({"ok": False, "detail": str(exc)})\n' +
      'print(json.dumps(out))\n',
    documents,
  );
  documents.forEach((text, index) => {
    let actual;
    try {
      const parsed = parseContext(text);
      actual = { ok: true, context: parsed.context, body: parsed.body };
    } catch (error) {
      if (!(error instanceof MalformedContext)) throw error;
      actual = { ok: false, detail: error.message };
    }
    compare('context', text.slice(0, 60), expected[index], actual);
  });

  // Rejected shapes: both must refuse, and with the same explanation — this is the
  // one place the message text is compared, because a contributor whose context
  // file is rejected reads that message to find out what to change.
  const rejected = [
    'no frontmatter at all\n',
    '---\nkey: value\nno closing fence\n',
    '---\nblock: |\n  text\n---\n',
    '---\nflow: [1, 2]\n---\n',
    '---\nflowMap: {a: 1}\n---\n',
    '---\nanchor: &a value\n---\n',
    '---\nalias: *a\n---\n',
    '---\nkey: value\n\tbad: indent\n---\n',
    '---\njust some words\n---\n',
    '---\n: novalue\n---\n',
    '---\n- item at root\n---\n',
    '---\nlist:\n  - one\n  key: inside a sequence\n---\n',
  ];
  const expectedRejected = python(
    'import json,sys\n' +
      'from qa_analysis import context\n' +
      'out = []\n' +
      'for text in json.load(sys.stdin):\n' +
      '    try:\n' +
      '        context.parse(text)\n' +
      '        out.append({"refused": False})\n' +
      '    except context.MalformedContext as exc:\n' +
      '        out.append({"refused": True, "detail": str(exc)})\n' +
      'print(json.dumps(out))\n',
    rejected,
  );
  rejected.forEach((text, index) => {
    let actual;
    try {
      parseContext(text);
      actual = { refused: false };
    } catch (error) {
      if (!(error instanceof MalformedContext)) throw error;
      actual = { refused: true, detail: error.message };
    }
    compare('context.rejected', text.slice(0, 40), expectedRejected[index], actual);
    if (!actual.refused) {
      problems.push(`context.rejected: both sides ACCEPTED ${JSON.stringify(text)}`);
    }
  });

  // And validation against the real contract, which is the whole point of the
  // parser: the same document must be valid or invalid in both.
  const schema = JSON.parse(
    fs.readFileSync(path.join(root, 'shared/analysis/schemas/context.schema.json'), 'utf8'),
  );
  const validated = [
    fs.readFileSync(path.join(fixtures, 'valid-context.md'), 'utf8'),
    '---\nschemaVersion: 1\n---\n',
    '---\nschemaVersion: 1\npackageManager: "not-a-real-manager"\n---\n',
  ];
  const expectedValidation = python(
    'import json,sys\n' +
      'from qa_analysis import context, contracts\n' +
      'payload = json.load(sys.stdin)\n' +
      'schema = payload["schema"]\n' +
      'out = []\n' +
      'for text in payload["documents"]:\n' +
      '    parsed = context.parse(text, schema=schema)\n' +
      '    out.append({"valid": parsed["valid"], "hasErrors": len(parsed["errors"]) > 0})\n' +
      'print(json.dumps(out))\n',
    { schema, documents: validated },
  );
  validated.forEach((text, index) => {
    const parsed = parseContext(text, { schema });
    compare('context.validated', text.slice(0, 50), expectedValidation[index], {
      valid: parsed.valid,
      hasErrors: parsed.errors.length > 0,
    });
  });
}

if (problems.length) {
  console.error(`engine parity FAILED (${compared} comparisons):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `engine parity OK: ${compared} comparison(s) across ${MODULES.join(', ')} — ` +
    'Node output is identical to Python',
);
