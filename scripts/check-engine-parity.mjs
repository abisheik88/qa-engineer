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
import { checkDiff } from '../packages/engine/lib/analysis/diff-guard.mjs';
import {
  render as renderHtml, supportedContracts, ReportError,
} from '../packages/engine/lib/analysis/report-html.mjs';
import { diagnose, planRepairs, summarize } from '../packages/engine/lib/diagnostics/engine.mjs';
import {
  parseReport as parsePlaywrightReport, analyzeTrace,
} from '../packages/engine/lib/frameworks/playwright.mjs';
import {
  RESULT_GLOBS, normalize as normalizeJUnitFramework,
  classifyFailure as classifyFrameworkFailure,
} from '../packages/engine/lib/frameworks/junit-frameworks.mjs';

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
  'context', 'diff-guard', 'report-html', 'diagnostics', 'frameworks',
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

// --- diff guard ----------------------------------------------------------------
// Every committed diff fixture, plus the cases each rule exists for. The guard is
// the thing standing between "the suite is green" and "the suite was made green",
// so a rule that stops firing in one implementation is a safety regression, and a
// rule that starts crying wolf trains people to override the guard entirely. Both
// directions are compared, rule for rule and severity for severity.
{
  const diffs = fs
    .readdirSync(fixtures)
    .filter((name) => name.endsWith('.diff'))
    .sort()
    .map((name) => fs.readFileSync(path.join(fixtures, name), 'utf8'));

  const synthetic = [
    // Nothing at all.
    '',
    '--- a/README.md\n+++ b/README.md\n+a documentation line\n',
    // Removal with no replacement.
    '--- a/t.spec.ts\n+++ b/t.spec.ts\n-expect(total).toBe(42)\n',
    // Replaced by something weaker.
    '--- a/t.spec.ts\n+++ b/t.spec.ts\n-expect(total).toBe(42)\n+expect(total).toBeTruthy()\n',
    // Same matcher, expected value dropped.
    '--- a/t.spec.ts\n+++ b/t.spec.ts\n-expect(page.locator("#total")).toHaveText("42")\n+expect(page.locator("#total")).toHaveText(value)\n',
    // A legitimate locator repair on the same expectation, in the style
    // Playwright is actually written — the case the committed fixtures missed.
    '--- a/e2e/c.spec.ts\n+++ b/e2e/c.spec.ts\n-  await expect(page.locator(\'#total\')).toHaveText(\'42\');\n+  await expect(page.getByTestId(\'total\')).toHaveText(\'42\');\n',
    '--- a/e2e/c.spec.ts\n+++ b/e2e/c.spec.ts\n-  await expect(page.locator(\'#total\')).toHaveText(\'42\');\n+  await expect(page.getByTestId(\'total\')).toHaveText(value);\n',
    // A legitimate locator repair on the same expectation.
    '--- a/t.spec.ts\n+++ b/t.spec.ts\n-expect(page.locator("#total")).toHaveText("42")\n+expect(page.getByTestId("total")).toHaveText("42")\n',
    // Hard assertion swapped for a soft one.
    '--- a/t.spec.ts\n+++ b/t.spec.ts\n-expect(total).toBe(42)\n+expect.soft(total).toBe(42)\n',
    // A move, not a change.
    '--- a/t.spec.ts\n+++ b/t.spec.ts\n-expect(total).toBe(42)\n+expect(total).toBe(42)\n',
    // Skips and forced passes.
    '--- a/t.spec.ts\n+++ b/t.spec.ts\n+test.skip("checkout", async () => {})\n',
    '--- a/t.spec.ts\n+++ b/t.spec.ts\n+test.only("checkout", async () => {})\n',
    '--- a/t_test.py\n+++ b/t_test.py\n+@pytest.mark.skip\n',
    '--- a/t.spec.ts\n+++ b/t.spec.ts\n+expect(true).toBe(true)\n',
    '--- a/t.spec.ts\n+++ b/t.spec.ts\n+  return;\n',
    '--- a/t.spec.ts\n+++ b/t.spec.ts\n+  if (!ready) return;\n',
    '--- a/src/app.ts\n+++ b/src/app.ts\n+  return;\n',
    // Config-level and pipeline-level evasion.
    '--- a/playwright.config.ts\n+++ b/playwright.config.ts\n+  testIgnore: ["**/checkout.spec.ts"],\n',
    '--- a/package.json\n+++ b/package.json\n+    "test": "playwright test || true"\n',
    '--- a/.github/workflows/ci.yml\n+++ b/.github/workflows/ci.yml\n+        continue-on-error: true\n',
    '--- a/jest.config.js\n+++ b/jest.config.js\n+  testPathIgnorePatterns: ["checkout"],\n',
    // Swallowed failures.
    '--- a/t.spec.ts\n+++ b/t.spec.ts\n+  try { await expect(x).toBe(1) } catch {}\n',
    '--- a/t_test.py\n+++ b/t_test.py\n+    except AssertionError: pass\n',
    '--- a/t.spec.ts\n+++ b/t.spec.ts\n+  } catch (error) {\n',
    // Waits and timeouts.
    '--- a/t.spec.ts\n+++ b/t.spec.ts\n-  await page.waitForSelector("#total")\n',
    '--- a/t.spec.ts\n+++ b/t.spec.ts\n-  timeout: 5000\n+  timeout: 30000\n',
    '--- a/t.spec.ts\n+++ b/t.spec.ts\n-  timeout: 5000\n+  timeout: 6000\n',
    '--- a/playwright.config.ts\n+++ b/playwright.config.ts\n-  retries: 1\n+  retries: 5\n',
    // Empty bodies.
    '--- a/t.spec.ts\n+++ b/t.spec.ts\n+test("checkout", async () => {})\n',
    '--- a/t_test.py\n+++ b/t_test.py\n+def test_checkout(): pass\n',
    // A deleted test file, and a deleted non-test file.
    '--- a/tests/checkout.spec.ts\n+++ /dev/null\n-expect(total).toBe(42)\n',
    '--- a/src/helper.ts\n+++ /dev/null\n-export const x = 1\n',
    // Mass deletion, just under and just over the threshold.
    `--- a/t.spec.ts\n+++ b/t.spec.ts\n${Array.from({ length: 14 }, (_, i) => `-line ${i}`).join('\n')}\n`,
    `--- a/t.spec.ts\n+++ b/t.spec.ts\n${Array.from({ length: 20 }, (_, i) => `-line ${i}`).join('\n')}\n`,
    // Locator changed.
    '--- a/t.spec.ts\n+++ b/t.spec.ts\n-  const el = page.locator("#old")\n+  const el = page.locator(".new")\n',
  ];

  const documents = [...diffs, ...synthetic];
  const expected = python(
    'import json,sys\n' +
      'from qa_analysis import diff_guard\n' +
      'print(json.dumps([diff_guard.check_diff(d) for d in json.load(sys.stdin)]))\n',
    documents,
  );
  documents.forEach((diff, index) => {
    compare('diff-guard', diff.slice(0, 80), expected[index], checkDiff(diff));
  });

  // Every rule the guard can emit must be exercised by the corpus above, or a rule
  // could be broken in both implementations and this gate would still pass.
  const emitted = new Set(expected.flat().map((issue) => issue.rule));
  const declared = [
    'removed-assertion', 'weakened-assertion', 'assertion-modified', 'removed-wait',
    'added-skip-or-only', 'forced-pass', 'empty-test-body', 'conditional-skip',
    'suite-exclusion', 'forced-pass-command', 'swallowed-failure', 'added-error-handling',
    'test-file-deleted', 'timeout-inflation', 'unsafe-retry-increase',
    'suspicious-locator-change', 'mass-deletion',
  ];
  const unexercised = declared.filter((rule) => !emitted.has(rule));
  if (unexercised.length > 0) {
    problems.push(
      `diff-guard: the corpus never triggers ${unexercised.join(', ')} — ` +
        'a rule nothing exercises is a rule this gate cannot protect',
    );
  }
}

// --- report html ---------------------------------------------------------------
// Byte-for-byte on the whole document. This is the one module whose output a person
// looks at, so "equivalent" is not the bar — a shifted space, a dropped chip, a
// section rendered in a different order is a visibly different report. The corpus
// covers the real artifact from a live run plus every branch: absent optional
// sections, an empty findings list, a run with no scope, hostile text, and the
// orderings (severity rank, natural case ids, failures first).
{
  const explore = (overrides = {}) => ({
    contract: { name: 'qa-explore/explore-result', version: '1.0.0' },
    skill: { name: 'qa-explore', version: '0.1.0' },
    generatedAt: '2026-07-28T00:00:00Z',
    url: 'http://localhost:4201/login',
    summary: 'Login page QA: one high-severity defect.',
    classification: 'issues-found',
    severityCounts: { critical: 0, high: 1, medium: 0, low: 0 },
    findings: [{
      id: 'EXP-1', severity: 'high', dimension: 'functional',
      title: 'Double-click fires two auth requests',
      repro: '1. Open /login  2. Enter credentials  3. Double-click Sign in',
      actual: 'Two identical POST requests are sent for one submit.',
      expected: 'One request per submit; the button is disabled while in flight.',
      fixDirection: 'Disable the control on click; re-enable when the request settles.',
      status: 'confirmed',
      evidence: [{ type: 'screenshot', source: 'screenshots/tc-16.png' }],
    }],
    evidence: [{ type: 'screenshot', description: 'Two requests', source: 'screenshots/tc-16.png' }],
    ...overrides,
  });

  const documents = [
    // The real artifact from the live run that motivated this renderer.
    JSON.parse(fs.readFileSync(path.join(root, 'tests/parity/explore-result.sample.json'), 'utf8')),
    explore(),
    // No findings at all — the empty state must still be a report.
    explore({ classification: 'pass', severityCounts: { critical: 0, high: 0, medium: 0, low: 0 }, findings: [] }),
    // Every severity, to pin the rank ordering and the badge colours.
    explore({
      severityCounts: { critical: 1, high: 1, medium: 1, low: 1 },
      findings: ['low', 'critical', 'medium', 'high'].map((severity, index) => ({
        id: `EXP-${index + 1}`, severity, dimension: 'ui', title: `${severity} one`,
        repro: 'r', actual: 'a', expected: 'x', fixDirection: 'f',
        status: 'confirmed', evidence: [{ type: 'dom', source: 'dom.html' }],
      })),
    }),
    // Every status label and every evidence kind.
    explore({
      findings: ['confirmed', 'validated-user-report', 'could-not-reproduce', 'partial'].map((status, index) => ({
        id: `EXP-${index + 1}`, severity: 'medium', dimension: 'api', title: `status ${status}`,
        repro: 'r', actual: 'a', expected: 'x', fixDirection: 'f', status,
        evidence: [
          { type: 'network', source: 'net.json', excerpt: 'POST /x 500' },
          { type: 'screenshot', source: 'shot.jpeg' },
          { type: 'command', source: 'npx playwright test', excerpt: '1 failed' },
        ],
      })),
    }),
    // Test cases: failures first, then natural id order, with and without links.
    explore({
      testCases: {
        total: 5, passed: 2, failed: 1, blocked: 1, skipped: 1,
        cases: [
          { id: 'TC-10', title: 'Tenth', status: 'pass' },
          { id: 'TC-2', title: 'Second', status: 'pass', findingId: 'EXP-1' },
          { id: 'TC-16', title: 'Sixteenth', status: 'fail', findingId: 'EXP-1' },
          { id: 'TC-1', title: 'First', status: 'blocked' },
          { id: 'TC-3', title: 'Third', status: 'skipped', findingId: 'EXP-99' },
        ],
      },
    }),
    // Scope in every combination.
    explore({ scope: { objective: 'Check sign-in.' } }),
    explore({ scope: { covered: ['The form', 'The toggle'] } }),
    explore({ scope: { notCovered: ['Signing in — needs real credentials'] } }),
    explore({ scope: { objective: 'o', covered: ['c'], notCovered: ['n'] }, dimensionsRun: ['functional', 'ux'] }),
    explore({ dimensionsRun: ['functional', 'api', 'performance', 'security', 'ui', 'ux', 'data'] }),
    // Every browser adapter phrasing, including the honest "no automation" one.
    ...['playwright-mcp', 'cursor-browser', 'cdp', 'cli-playwright', 'cli-other', 'unavailable'].map(
      (browserAdapter) => explore({ browserAdapter }),
    ),
    // Data validation, in and out of scope, with comparisons.
    explore({ dbValidation: { inScope: false } }),
    explore({ dbValidation: { inScope: true, summary: 'Compared against the read replica.' } }),
    explore({ dbValidation: { comparisons: [
      { metric: 'Order total', uiValue: '42', sourceValue: '42', match: true },
      { metric: 'Item count', uiValue: '3', sourceValue: '4', match: false },
    ] } }),
    // The trailing optional sections.
    explore({ fixOrder: ['EXP-1 first'], recommendations: [{ action: 'Guard the handler', priority: 'high' }], whatWorksWell: ['Validation blocks submit'] }),
    // Hostile text in every field a model fills in.
    explore({
      summary: '</h1><script>alert(1)</script>',
      url: 'http://x.test/"onload="alert(1)',
      findings: [{
        id: 'EXP<1>', severity: 'high', dimension: 'ui', title: '</h3><script>x</script>',
        repro: "1. it's  2. <b>bold</b>", actual: 'a & b', expected: '"quoted"',
        fixDirection: "don't", status: 'confirmed',
        evidence: [{ type: 'screenshot', source: 'a.png" onload="alert(1)' }],
      }],
      scope: { objective: '<script>o</script>', covered: ['<i>c</i>'], notCovered: ["n's"] },
    }),
    // Repro shapes: prose, newline-separated, and unnumbered.
    explore({ findings: [{ ...explore().findings[0], repro: 'Double-click the button while in flight.' }] }),
    explore({ findings: [{ ...explore().findings[0], repro: '1. one\n2. two\n3. three' }] }),
    explore({ findings: [{ ...explore().findings[0], repro: '' }] }),
    // No url, so the heading falls back to the summary.
    explore({ url: '' }),
    explore({ url: 'https://example.com/deep/path/' }),
  ];

  const reports = [
    {
      contract: { name: 'qa-report/report-result', version: '1.0.0' },
      generatedAt: '2026-07-28T00:00:00Z',
      summary: 'One suite failed.',
      releaseReadiness: { verdict: 'not-ready', rationale: 'A product defect blocks release.' },
      testSummary: { total: 10, passed: 9, failed: 1, skipped: 0 },
      summaries: { executive: 'Do not ship yet.', engineering: 'Fix the cart locator.' },
      failureSummary: [{ test: 'checkout', classification: 'product-bug', reason: 'cart empty' }],
      recommendations: [{ action: 'Fix the cart', priority: 'high' }],
    },
    {
      contract: { name: 'qa-report/report-result', version: '1.0.0' },
      generatedAt: '2026-07-28T00:00:00Z',
      summary: 'All green.',
      releaseReadiness: { verdict: 'ready' },
      testSummary: { total: 10, passed: 10, failed: 0, skipped: 0 },
    },
    // No readiness block: the verdict falls back to the envelope classification.
    {
      contract: { name: 'qa-report/report-result', version: '1.0.0' },
      generatedAt: '2026-07-28T00:00:00Z',
      summary: 'Insufficient signal.',
      classification: 'insufficient-data',
    },
  ];

  const all = [...documents, ...reports];
  const expected = python(
    'import json,sys\n' +
      'from qa_analysis import report_html\n' +
      'out = []\n' +
      'for result in json.load(sys.stdin):\n' +
      '    try:\n' +
      '        out.append({"ok": True, "html": report_html.render(result)})\n' +
      '    except report_html.ReportError as exc:\n' +
      '        out.append({"ok": False, "detail": str(exc)})\n' +
      'print(json.dumps(out))\n',
    all,
  );
  all.forEach((result, index) => {
    let actual;
    try {
      actual = { ok: true, html: renderHtml(result) };
    } catch (error) {
      if (!(error instanceof ReportError)) throw error;
      actual = { ok: false, detail: error.message };
    }
    const label = `${result.contract?.name ?? 'no contract'} #${index}`;
    if (expected[index].ok && actual.ok && expected[index].html !== actual.html) {
      // A whole document in an error message is unreadable; report the first line
      // that differs, which is what a reader needs to find it.
      const left = expected[index].html.split('\n');
      const right = actual.html.split('\n');
      const at = left.findIndex((line, i) => line !== right[i]);
      problems.push(
        `report-html: ${label} differs at line ${at + 1}\n` +
          `      python: ${JSON.stringify(left[at])}\n` +
          `      node:   ${JSON.stringify(right[at])}`,
      );
      compared += 1;
    } else {
      compare('report-html', label, expected[index], actual);
    }
  });

  // An unsupported contract must be refused by both, with the same explanation.
  const unsupported = [
    { contract: { name: 'qa-run/execution-result', version: '1.0.0' } },
    { contract: {} },
    {},
  ];
  const expectedRefusals = python(
    'import json,sys\n' +
      'from qa_analysis import report_html\n' +
      'out = []\n' +
      'for result in json.load(sys.stdin):\n' +
      '    try:\n' +
      '        report_html.render(result); out.append({"refused": False})\n' +
      '    except report_html.ReportError as exc:\n' +
      '        out.append({"refused": True, "detail": str(exc)})\n' +
      'print(json.dumps(out))\n',
    unsupported,
  );
  unsupported.forEach((result, index) => {
    let actual;
    try {
      renderHtml(result);
      actual = { refused: false };
    } catch (error) {
      if (!(error instanceof ReportError)) throw error;
      actual = { refused: true, detail: error.message };
    }
    compare('report-html.refused', JSON.stringify(result), expectedRefusals[index], actual);
  });

  compare('report-html.contracts', 'supported list', python(
    'import json\nfrom qa_analysis import report_html\nprint(json.dumps(report_html.supported_contracts()))\n',
    {},
  ), supportedContracts());
}

// --- diagnostics ---------------------------------------------------------------
// The engine decides who owns a failure, whether it may be repaired at all, and
// whether the build ships. Every one of those is a decision somebody acts on, so
// the corpus covers each classification end to end rather than sampling: fourteen
// classes through diagnose → planRepairs → summarize, plus the orderings and the
// readiness verdicts.
{
  const failing = (message, extra = {}) => ({
    tests: { total: 1, passed: 0, failed: 1, skipped: 0 },
    executed: [{ title: 'checkout', status: 'failed', message, file: 'e2e/checkout.spec.ts', retries: 0, ...extra }],
  });

  const executions = [
    // One per classification, driven through the message taxonomy.
    failing('Error: element(s) not found\nCall log: waiting for locator("#cart")'),
    failing('Expected: 5\nReceived: 3'),
    failing('Test timeout of 30000ms exceeded.'),
    failing('connect ECONNREFUSED 127.0.0.1:3000'),
    failing('401 Unauthorized'),
    failing('403 Forbidden'),
    failing('baseURL not set'),
    failing("Cannot find module '@playwright/test'"),
    failing('out of memory'),
    failing('duplicate key value violates unique constraint'),
    failing('internal error in playwright'),
    failing('something nobody has ever seen'),
    // Flaky comes from metadata, not the message.
    { tests: { total: 1, passed: 1, failed: 0, skipped: 0 }, executed: [{ title: 'checkout', status: 'flaky', message: '', file: 'a.spec.ts', retries: 2 }] },
    { tests: { total: 1, passed: 1, failed: 0, skipped: 0 }, executed: [{ title: 'checkout', status: 'passed', message: '', file: 'a.spec.ts', retries: 1 }] },
    // Clean run: ready, with no entries at all.
    { tests: { total: 3, passed: 3, failed: 0, skipped: 0 }, executed: [{ title: 'a', status: 'passed', message: '', file: 'a.spec.ts', retries: 0 }] },
    // Several failures at once, to pin the priority ordering and dedup.
    {
      tests: { total: 4, passed: 1, failed: 3, skipped: 0 },
      executed: [
        { title: 'locator', status: 'failed', message: 'no such element: #cart', file: 'a.spec.ts', retries: 0 },
        { title: 'network', status: 'failed', message: 'fetch failed', file: 'b.spec.ts', retries: 0 },
        { title: 'another locator', status: 'failed', message: 'no such element: #total', file: 'c.spec.ts', retries: 0 },
      ],
    },
    // Timeline: start and finish timestamps present.
    {
      tests: { total: 1, passed: 0, failed: 1, skipped: 0 },
      execution: { startedAt: '2026-07-28T10:00:00Z', finishedAt: '2026-07-28T10:01:00Z' },
      executed: [{ title: 'checkout', status: 'failed', message: 'no such element', file: 'a.spec.ts', retries: 0 }],
    },
    // Empty everything.
    { tests: { total: 0, passed: 0, failed: 0, skipped: 0 }, executed: [] },
  ];

  const withAnalysis = [
    // The analysis platform's classification is trusted over the message.
    [failing('this message would classify as a timeout'), {
      findings: [{
        classification: 'application-bug', confidence: 0.95,
        reason: 'The API returned a 500 for a valid request.',
        affectedTests: ['checkout'],
        evidence: [{ type: 'network', description: 'POST /pay 500', source: 'net.har' }],
      }],
    }],
    // Evidence types that each contribute a timeline phase.
    [failing('no such element'), {
      findings: [{
        classification: 'locator-failure', confidence: 0.8, reason: 'Locator did not resolve.',
        affectedTests: ['checkout'],
        evidence: [
          { type: 'trace', description: 'navigated', source: 'trace.zip' },
          { type: 'console', description: 'console error', source: 'console.log' },
          { type: 'junit', description: 'assertion', source: 'results.xml' },
          { type: 'report', description: 'report', source: 'results.json' },
          { type: 'file', description: 'not a phase', source: 'x' },
        ],
      }],
    }],
    // A finding with an unknown classification falls back to the message.
    [failing('403 Forbidden'), { findings: [{ classification: 'not-a-real-class', reason: '403 Forbidden' }] }],
  ];

  const payload = {
    executions,
    withAnalysis: withAnalysis.map(([execution, analysis]) => ({ execution, analysis })),
  };

  const expected = python(
    'import json,sys\n' +
      'sys.path.insert(0, "shared/diagnostics/lib")\n' +
      'from qa_diagnostics import engine\n' +
      'payload = json.load(sys.stdin)\n' +
      'out = {"plain": [], "withAnalysis": []}\n' +
      'for execution in payload["executions"]:\n' +
      '    diagnosis = engine.diagnose(execution)\n' +
      '    out["plain"].append({\n' +
      '        "diagnosis": diagnosis,\n' +
      '        "plans": engine.plan_repairs(diagnosis),\n' +
      '        "summary": engine.summarize(execution, diagnosis),\n' +
      '    })\n' +
      'for case in payload["withAnalysis"]:\n' +
      '    diagnosis = engine.diagnose(case["execution"], analysis_result=case["analysis"])\n' +
      '    out["withAnalysis"].append({\n' +
      '        "diagnosis": diagnosis,\n' +
      '        "plans": engine.plan_repairs(diagnosis),\n' +
      '        "summary": engine.summarize(case["execution"], diagnosis),\n' +
      '    })\n' +
      'print(json.dumps(out))\n',
    payload,
  );

  executions.forEach((execution, index) => {
    const diagnosis = diagnose(execution);
    compare('diagnostics', `execution #${index}`, expected.plain[index], {
      diagnosis,
      plans: planRepairs(diagnosis),
      summary: summarize(execution, diagnosis),
    });
  });
  withAnalysis.forEach(([execution, analysis], index) => {
    const diagnosis = diagnose(execution, { analysisResult: analysis });
    compare('diagnostics.withAnalysis', `case #${index}`, expected.withAnalysis[index], {
      diagnosis,
      plans: planRepairs(diagnosis),
      summary: summarize(execution, diagnosis),
    });
  });

  // Every readiness verdict must be reachable, or the gate is not testing the one
  // output a release decision is made from.
  const verdicts = new Set([
    ...expected.plain.map((r) => r.summary.releaseReadiness),
    ...expected.withAnalysis.map((r) => r.summary.releaseReadiness),
  ]);
  for (const verdict of ['ready', 'not-ready', 'ready-with-risks', 'insufficient-data']) {
    if (!verdicts.has(verdict)) {
      problems.push(`diagnostics: the corpus never produces the "${verdict}" verdict`);
    }
  }

  // And every classification must appear, so no ownership or repair mapping is
  // left unexercised.
  const seen = new Set(
    [...expected.plain, ...expected.withAnalysis]
      .flatMap((r) => r.diagnosis.entries.map((e) => e.rootCause.classification)),
  );
  const expectedClasses = [
    'locator-failure', 'assertion-failure', 'timeout', 'network', 'authentication',
    'authorization', 'environment', 'configuration', 'infrastructure', 'test-data',
    'framework-failure', 'flaky', 'unknown', 'application-bug',
  ];
  const missing = expectedClasses.filter((cls) => !seen.has(cls));
  if (missing.length > 0) {
    problems.push(`diagnostics: the corpus never classifies as ${missing.join(', ')}`);
  }
}

// --- frameworks ----------------------------------------------------------------
// The Playwright adapter is the only place the engine reads a binary format, and
// the ZIP reader replacing `zipfile` is hand-written, so real archives are built
// here — stored *and* deflated, because Node's zlib path and the stored path are
// different code — and compared against Python reading the same bytes.
{
  const reports = [
    // A full report: pass, fail with an error, flaky via a retry, skipped.
    {
      suites: [{
        file: 'e2e/checkout.spec.ts',
        specs: [
          { title: 'adds to cart', tests: [{ results: [{ status: 'passed', duration: 120 }] }] },
          { title: 'completes a purchase', tests: [{ results: [{ status: 'failed', duration: 900, errors: [{ message: 'Expected: 42\nReceived: 0\npassword=hunter2' }] }] }] },
          { title: 'retries once', tests: [{ results: [{ status: 'failed', duration: 10 }, { status: 'passed', duration: 20 }] }] },
          { title: 'is skipped', tests: [{ results: [{ status: 'skipped', duration: 0 }] }] },
          { title: 'has no results', tests: [{ results: [] }] },
        ],
        suites: [{
          file: 'e2e/nested.spec.ts',
          specs: [{ title: 'nested case', tests: [{ results: [{ status: 'expected', duration: 5 }] }] }],
        }],
      }],
    },
    { suites: [] },
    {},
    // A failure whose error list is empty, and one with no errors key at all.
    { suites: [{ file: 'a.spec.ts', specs: [{ title: 'x', tests: [{ results: [{ status: 'failed', duration: 1, errors: [] }] }] }] }] },
    { suites: [{ file: 'a.spec.ts', specs: [{ title: 'x', tests: [{ results: [{ status: 'timedOut', duration: 1 }] }] }] }] },
  ];

  const scratch = fs.mkdtempSync(path.join(root, '.qa-parity-fw-'));
  try {
    const reportPaths = reports.map((report, index) => {
      const file = path.join(scratch, `report-${index}.json`);
      fs.writeFileSync(file, JSON.stringify(report));
      return file;
    });

    const expectedReports = python(
      'import json,sys\n' +
        'sys.path.insert(0, "shared/frameworks/playwright/lib")\n' +
        'import playwright_analysis\n' +
        'from qa_analysis.junit import MalformedArtifact\n' +
        'out = []\n' +
        'for p in json.load(sys.stdin):\n' +
        '    try:\n' +
        '        out.append({"ok": True, "result": playwright_analysis.parse_report(p)})\n' +
        '    except MalformedArtifact as exc:\n' +
        '        out.append({"ok": False})\n' +
        'print(json.dumps(out))\n',
      reportPaths,
    );
    reportPaths.forEach((file, index) => {
      let actual;
      try {
        actual = { ok: true, result: parsePlaywrightReport(file) };
      } catch (error) {
        if (!(error instanceof MalformedArtifact)) throw error;
        actual = { ok: false };
      }
      compare('frameworks.playwright.report', `report #${index}`, expectedReports[index], actual);
    });

    // Traces. Written with Python's zipfile so the bytes are a real archive rather
    // than something this port also produced — a self-built archive would prove
    // only that the reader agrees with the writer.
    const traceEvents = [
      // Actions, console, network, and an error object.
      [
        '{"type":"before","apiName":"page.goto"}',
        '{"type":"action","method":"click"}',
        '{"type":"console","text":"warning"}',
        '{"type":"resource","url":"https://x.test/a"}',
        '{"type":"error","error":{"message":"no such element: #cart"}}',
        'not json at all',
        '',
        '{"type":"action","apiName":"expect.toHaveText"}',
      ],
      // An error carried as a bare message, and a secret to redact.
      ['{"type":"error","message":"password=hunter2 leaked"}'],
      // No error at all: the classification must be unknown, not a guess.
      ['{"type":"action","apiName":"page.click"}'],
      // Completely empty.
      [],
    ];
    const traceSpecs = [];
    traceEvents.forEach((lines, index) => {
      for (const compress of [true, false]) {
        traceSpecs.push({
          path: path.join(scratch, `trace-${index}-${compress ? 'deflated' : 'stored'}.zip`),
          lines,
          compress,
        });
      }
    });
    // And two archives that are not traces at all.
    const brokenTrace = path.join(scratch, 'broken.zip');
    fs.writeFileSync(brokenTrace, Buffer.concat([Buffer.from('PK\u0003\u0004'), Buffer.alloc(64)]));
    const notAZip = path.join(scratch, 'plain.txt');
    fs.writeFileSync(notAZip, 'just text');

    const expectedTraces = python(
      'import json,sys,zipfile\n' +
        'sys.path.insert(0, "shared/frameworks/playwright/lib")\n' +
        'import playwright_analysis\n' +
        'from qa_analysis.junit import MalformedArtifact\n' +
        'payload = json.load(sys.stdin)\n' +
        'for spec in payload["specs"]:\n' +
        '    mode = zipfile.ZIP_DEFLATED if spec["compress"] else zipfile.ZIP_STORED\n' +
        '    with zipfile.ZipFile(spec["path"], "w", mode) as archive:\n' +
        '        archive.writestr("test.trace", "\\n".join(spec["lines"]))\n' +
        '        archive.writestr("resources/other.txt", "ignored")\n' +
        'out = []\n' +
        'for p in [s["path"] for s in payload["specs"]] + payload["invalid"]:\n' +
        '    try:\n' +
        '        out.append({"ok": True, "result": playwright_analysis.analyze_trace(p)})\n' +
        '    except MalformedArtifact:\n' +
        '        out.append({"ok": False})\n' +
        'print(json.dumps(out))\n',
      { specs: traceSpecs, invalid: [brokenTrace, notAZip] },
    );

    [...traceSpecs.map((s) => s.path), brokenTrace, notAZip].forEach((file, index) => {
      let actual;
      try {
        actual = { ok: true, result: analyzeTrace(file) };
      } catch (error) {
        if (!(error instanceof MalformedArtifact)) throw error;
        actual = { ok: false };
      }
      compare('frameworks.playwright.trace', path.basename(file), expectedTraces[index], actual);
    });

    // The three thin JUnit adapters must each still normalize to the shared shape.
    const junitFixture = path.join(fixtures, 'selenium-junit.xml');
    const expectedThin = python(
      'import json,sys\n' +
        'for lib in ("selenium", "cypress", "webdriverio"):\n' +
        '    sys.path.insert(0, f"shared/frameworks/{lib}/lib")\n' +
        'import selenium_analysis, cypress_analysis, webdriverio_analysis\n' +
        'path = json.load(sys.stdin)["path"]\n' +
        'out = {}\n' +
        'for name, mod in (("selenium", selenium_analysis), ("cypress", cypress_analysis), ("webdriverio", webdriverio_analysis)):\n' +
        '    c, conf, reason = mod.classify_failure("no such element: #cart")\n' +
        '    out[name] = {\n' +
        '        "framework": mod.FRAMEWORK,\n' +
        '        "globs": mod.RESULT_GLOBS,\n' +
        '        "normalized": mod.normalize(path),\n' +
        '        "classified": {"classification": c, "confidence": conf, "reason": reason},\n' +
        '    }\n' +
        'print(json.dumps(out))\n',
      { path: junitFixture },
    );
    for (const framework of ['selenium', 'cypress', 'webdriverio']) {
      compare('frameworks.junit', framework, expectedThin[framework], {
        framework,
        globs: RESULT_GLOBS[framework],
        normalized: normalizeJUnitFramework(framework, junitFixture),
        classified: classifyFrameworkFailure('no such element: #cart'),
      });
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
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
