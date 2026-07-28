// Run the engine over the shared corpus and return its output.
//
// One function, used by both the snapshot test and the regenerator, so the recorded
// baseline and the thing being compared cannot drift apart.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { redactText, detectSecrets, redactHeaders } from '../../lib/analysis/redaction.mjs';
import { classify } from '../../lib/analysis/taxonomy.mjs';
import { parseJUnitText, MalformedArtifact } from '../../lib/analysis/junit.mjs';
import { checkDiff } from '../../lib/analysis/diff-guard.mjs';
import { render as renderHtml, ReportError } from '../../lib/analysis/report-html.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(fs.readFileSync(path.join(here, 'cases.json'), 'utf8'));
const fixtures = path.join(here, '..', 'fixtures');

const attempt = (fn, ErrorType) => {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    if (!(error instanceof ErrorType)) throw error;
    return { ok: false };
  }
};

export function record() {
  const junitDocuments = [
    ...cases.junit,
    ...fs.readdirSync(fixtures).filter((f) => f.endsWith('.xml')).sort()
      .map((name) => fs.readFileSync(path.join(fixtures, name), 'utf8')),
  ];

  return {
    redaction: cases.redaction.map((input) => ({
      redacted: redactText(input),
      found: detectSecrets(input),
    })),
    headers: [
      { Authorization: 'Bearer abc', 'X-Api-Key': 'k', Accept: 'application/json' },
      [{ name: 'Cookie', value: 'a=1' }, { name: 'Accept', value: 'text/html' }],
    ].map((headers) => redactHeaders(headers)),
    classify: cases.classify.map((input) => classify(input.message, input.httpStatus ?? null)),
    junit: junitDocuments.map((doc) => attempt(() => parseJUnitText(doc), MalformedArtifact)),
    junitMalformed: cases.junitMalformed.map((doc) =>
      attempt(() => parseJUnitText(doc), MalformedArtifact).ok ? 'parsed' : 'refused'),
    diffGuard: fs.readdirSync(fixtures).filter((f) => f.endsWith('.diff')).sort()
      .map((name) => checkDiff(fs.readFileSync(path.join(fixtures, name), 'utf8'))),
    reportHtml: attempt(
      () => renderHtml(JSON.parse(fs.readFileSync(path.join(here, 'explore-result.sample.json'), 'utf8'))),
      ReportError,
    ),
  };
}
