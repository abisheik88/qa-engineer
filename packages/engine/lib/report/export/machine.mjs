// Machine-readable exports: SARIF, JUnit, and CSV.
//
// These exist so a QA run can enter systems that were never going to read an HTML
// page. SARIF puts findings in GitHub's Security tab and any code-scanning viewer;
// JUnit puts them on a CI dashboard beside the unit tests; CSV puts them in the
// spreadsheet a QA lead is already tracking the release from.
//
// ## Where the mapping is honest and where it is lossy
//
// SARIF and JUnit were designed for static analysis and unit tests respectively, and
// an exploratory QA finding is neither. Rather than pretend otherwise:
//
//   - A finding with no `page` has no meaningful file location, so SARIF gets the
//     target URL as its artifact URI rather than an invented source path. A reader
//     seeing `admin.example.com/users` knows it is a runtime finding, not line 12 of a
//     file that does not exist.
//   - JUnit's model has no severity, so severity travels in the failure `type` and the
//     dimension in the classname. Nothing is dropped silently; it is relocated and
//     documented.
//
// Anything that genuinely does not fit — evidence images, root-cause chains — stays in
// the JSON, which every one of these formats can point back to.

import { buildModel } from '../core/model.mjs';
import { SEVERITY } from '../theme/tokens.mjs';
import { dimensionLabel } from '../components/findings.mjs';

/** SARIF severity levels. SARIF has three; the pack has four, so medium and low share. */
const SARIF_LEVEL = Object.freeze({ critical: 'error', high: 'error', medium: 'warning', low: 'note' });

// SARIF's own 0–10 scale, so a viewer that ranks by score ranks the way the report does.
const SARIF_RANK = Object.freeze({ critical: 10, high: 8, medium: 5, low: 2 });

/** SARIF 2.1.0, one run, one rule per distinct dimension+severity pairing. */
export function renderSarif(result, options = {}) {
  const model = buildModel(result, { ...options, hash: false });

  const rules = new Map();
  const results = model.findings.map((finding) => {
    const ruleId = `qa-explore/${finding.dimension ?? 'general'}`;
    if (!rules.has(ruleId)) {
      rules.set(ruleId, {
        id: ruleId,
        name: `${dimensionLabel(finding.dimension)} finding`,
        shortDescription: { text: `${dimensionLabel(finding.dimension)} defect found by exploratory QA` },
        fullDescription: {
          text:
            'Reported by qa-explore, an AI-driven exploratory QA pass against a running application. ' +
            'Each result carries the observed behaviour, the expected behaviour, and reproduction steps.',
        },
        defaultConfiguration: { level: SARIF_LEVEL[finding.severity] ?? 'note' },
        properties: { tags: ['qa', 'exploratory', finding.dimension ?? 'general'] },
      });
    }

    const location = finding.page ?? model.url ?? 'unknown';
    const message = [
      finding.actual,
      `Expected: ${finding.expected}`,
      `Fix: ${finding.fixDirection}`,
    ].join('\n\n');

    return {
      ruleId,
      level: SARIF_LEVEL[finding.severity] ?? 'note',
      rank: SARIF_RANK[finding.severity] ?? 1,
      message: { text: message },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: location },
            region: { startLine: 1 },
          },
          message: { text: finding.title },
        },
      ],
      partialFingerprints: { findingId: String(finding.id) },
      properties: {
        findingId: finding.id,
        severity: finding.severity,
        dimension: finding.dimension,
        status: finding.status,
        businessImpact: finding.businessImpact ?? undefined,
        rootCause: finding.rootCause?.summary ?? undefined,
        regressionRisk: finding.regressionRisk?.level ?? undefined,
        confidence: finding.confidence ?? undefined,
        repro: finding.repro,
      },
    };
  });

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'qa-engineer',
            informationUri: 'https://github.com/abisheik88/qa-engineer',
            rules: [...rules.values()],
            version: model.skill?.version ?? undefined,
          },
        },
        invocations: [
          {
            executionSuccessful: model.classification !== 'blocked',
            endTimeUtc: model.generatedAt ?? undefined,
          },
        ],
        results,
      },
    ],
  };
}

/** XML-escape, for both text nodes and attribute values. */
function x(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // A control character is legal in a JSON string and illegal in XML 1.0, so a
    // console excerpt carrying one would produce a file no parser accepts.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}

/**
 * JUnit XML.
 *
 * Two suites: the executed test cases (when the run had any) and the findings. Keeping
 * them apart matters — a CI dashboard that mixes "the login case failed" with "the
 * login page leaks a token into localStorage" cannot tell a regression from a review
 * comment.
 */
export function renderJUnit(result, options = {}) {
  const model = buildModel(result, { ...options, hash: false });
  const suites = [];

  const cases = model.testCases?.cases ?? [];
  if (cases.length > 0) {
    const bodies = cases.map((testCase) => {
      const attributes =
        `name="${x(testCase.title)}" classname="${x(`qa-explore.cases.${testCase.id}`)}"`;
      if (testCase.status === 'pass') return `    <testcase ${attributes}/>`;
      if (testCase.status === 'skipped') {
        return `    <testcase ${attributes}><skipped/></testcase>`;
      }
      if (testCase.status === 'blocked') {
        return (
          `    <testcase ${attributes}><skipped message="Blocked: could not be executed"/></testcase>`
        );
      }
      const finding = model.findings.find((entry) => entry.id === testCase.findingId);
      const detail = finding
        ? `${finding.actual}\n\nExpected: ${finding.expected}`
        : (testCase.note ?? 'Case failed.');
      return (
        `    <testcase ${attributes}>` +
        `<failure type="case-failed" message="${x(testCase.title)}">${x(detail)}</failure>` +
        '</testcase>'
      );
    });
    suites.push(
      `  <testsuite name="qa-explore.cases" tests="${cases.length}" ` +
        `failures="${cases.filter((c) => c.status === 'fail').length}" ` +
        `skipped="${cases.filter((c) => c.status === 'skipped' || c.status === 'blocked').length}">\n` +
        `${bodies.join('\n')}\n  </testsuite>`,
    );
  }

  if (model.findings.length > 0) {
    const bodies = model.findings.map((finding) => {
      const detail = [
        finding.actual,
        `Expected: ${finding.expected}`,
        `Reproduction: ${finding.repro}`,
        `Fix: ${finding.fixDirection}`,
      ].join('\n\n');
      return (
        `    <testcase name="${x(`${finding.id} ${finding.title}`)}" ` +
        `classname="${x(`qa-explore.findings.${finding.dimension ?? 'general'}`)}">` +
        `<failure type="${x(finding.severity)}" message="${x(finding.title)}">${x(detail)}</failure>` +
        '</testcase>'
      );
    });
    suites.push(
      `  <testsuite name="qa-explore.findings" tests="${model.findings.length}" ` +
        `failures="${model.findings.length}">\n${bodies.join('\n')}\n  </testsuite>`,
    );
  }

  const totals = suites.length;
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<testsuites name="qa-explore" tests="${cases.length + model.findings.length}" ` +
    `failures="${cases.filter((c) => c.status === 'fail').length + model.findings.length}"` +
    (totals === 0 ? '/>\n' : `>\n${suites.join('\n')}\n</testsuites>\n`)
  );
}

/** RFC 4180 quoting: wrap when needed, double any embedded quote. */
function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Findings as CSV.
 *
 * Column order is triage order, so the sheet is usable unsorted: id, severity, the two
 * behaviours, then the context. A leading `﻿` because Excel opens a UTF-8 CSV
 * without one as mojibake, and a report that renders `â€"` in a stakeholder's
 * spreadsheet has failed regardless of how correct the bytes are.
 */
export function renderCsv(result, options = {}) {
  const model = buildModel(result, { ...options, hash: false });
  const headers = [
    'id', 'severity', 'dimension', 'status', 'title', 'page', 'actual', 'expected',
    'businessImpact', 'repro', 'fixDirection', 'rootCause', 'regressionRisk',
    'confidence', 'tags', 'affectedApis', 'evidenceCount',
  ];

  const rows = model.findings.map((finding) =>
    [
      finding.id,
      finding.severity,
      finding.dimension,
      finding.status,
      finding.title,
      finding.page ?? '',
      finding.actual,
      finding.expected,
      finding.businessImpact ?? '',
      finding.repro,
      finding.fixDirection,
      finding.rootCause?.summary ?? '',
      finding.regressionRisk?.level ?? '',
      finding.confidence ?? '',
      (finding.tags ?? []).join(' '),
      (finding.affectedApis ?? []).join(' '),
      (finding.evidence ?? []).length,
    ]
      .map(csvCell)
      .join(','),
  );

  return `\ufeff${[headers.join(','), ...rows].join('\r\n')}\r\n`;
}

/**
 * A manifest of everything a shareable bundle should contain.
 *
 * The pack writes no archive itself — zipping is the caller's job and every platform
 * already has a tool for it. What the pack owns is knowing *what belongs in the
 * archive*, which is the part that goes wrong: a bundle missing three screenshots is
 * indistinguishable from a complete one until someone opens it.
 */
export function bundleManifest(result, options = {}) {
  const model = buildModel(result, options);
  const files = model.registry
    .list()
    .filter((record) => record.declaredPath && !record.external)
    .map((record) => ({
      path: record.declaredPath,
      kind: record.kind,
      bytes: record.bytes,
      sha256: record.sha256,
      present: record.exists,
      reason: record.exists ? undefined : record.missingReason,
    }));

  return {
    subject: model.subject,
    generatedAt: model.generatedAt,
    complete: files.every((file) => file.present),
    counts: {
      total: files.length,
      present: files.filter((file) => file.present).length,
      missing: files.filter((file) => !file.present).length,
    },
    totalBytes: files.reduce((sum, file) => sum + (file.bytes ?? 0), 0),
    files,
  };
}

export { SEVERITY };
