// Render a contract artifact as a presentation-grade HTML report.
//
// ## Why this is code
//
// The first real `/qa-explore` run on a live application produced a valid artifact
// and a *lossy* report. Every finding in the contract carries `repro`, `actual`,
// `expected`, and `fixDirection` — all four required fields — and the hand-written
// HTML collapsed them into a single sentence:
//
//     EXP-1 · high — Double-click Login fires two GraphQL auth requests
//     Two identical POSTs to /graphql. Disable Login while in flight.
//
// The reader is left to infer what was expected, how to reproduce it, and what
// "correct" would look like. The data existed; the rendering discarded it. It also
// omitted the attribution footer entirely.
//
// Both failures share one cause: the report was *typed* rather than *rendered*. So
// it is rendered here. The contract is the input, every required field appears in
// the output, and the footer is not optional. A report cannot silently drop what a
// reader needs, because no one is retyping it.
//
// ## What it renders
//
// `explore-result` and `report-result` today — the two artifacts a human reads.
// Each finding becomes a card stating, in order: what is wrong, **what happens
// now**, **what should happen instead**, how to reproduce it, and the fix
// direction. That ordering is deliberate: a reader who stops after two lines still
// knows the defect and the gap.
//
// Ahead of the findings comes the orientation a forwarded report needs — what kind
// of document this is, how the application was observed, what each area checked
// means, what the severity labels claim, and what the run did *not* cover.
//
// No dependencies, single self-contained file, no external assets — a report must
// open from an email attachment on a plane.

import fs from 'node:fs';

import { footerHtml } from './branding.mjs';

export class ReportError extends Error {}

// Severity drives colour, order, and the summary bar. Kept here rather than in the
// template so a new severity cannot render as an unstyled surprise.
const SEVERITY = {
  critical: { label: "Critical", colour: "#8b0018", tint: "#fdf0f2", rank: 0 },
  high: { label: "High", colour: "#b3261e", tint: "#fdf1f0", rank: 1 },
  medium: { label: "Medium", colour: "#a15c00", tint: "#fdf6ec", rank: 2 },
  low: { label: "Low", colour: "#4a5568", tint: "#f4f5f7", rank: 3 },
};

// Summary tiles for non-severity counts. Test totals are not severities, and
// rendering "failed" in the same neutral grey as "passed" is how a reader misses
// the number that matters.
const COUNT_STYLE = {
  "total": "#344054",
  "passed": "#116149",
  "failed": "#b3261e",
  "blocked": "#a15c00",
  "skipped": "#667085",
};

// What each evidence kind is called in the report. The contract guarantees `type`
// on every entry but `description` only on the top-level index, so the type is
// what a caption can always be built from.
const EVIDENCE_LABEL = {
  "screenshot": "Screenshot",
  "network": "Network capture",
  "console": "Console output",
  "dom": "DOM snapshot",
  "har": "HAR archive",
  "db": "Database query",
  "file": "File",
  "report": "Report",
  "command": "Command output",
  "trace": "Trace",
  "log": "Log",
  "diff": "Diff",
};

// What each QA dimension means to someone who has never read a QA report. The
// contract stores dimension *names*, which are jargon: "ux" tells a reader nothing.
const DIMENSION_LABEL = {
  "functional": "Functionality",
  "api": "API",
  "performance": "Performance",
  "security": "Security (client-side)",
  "ui": "UI",
  "ux": "UX",
  "data": "Data",
};

const DIMENSION_PLAIN = {
  "functional": "Does the feature do what it is supposed to do, including when the input is wrong?",
  "api": "The network requests the page makes — whether they are correct, and how the page handles a bad response",
  "performance": "How much the page downloads and how quickly it becomes usable",
  "security": "Client-side exposure only: where credentials and tokens are stored, what leaks into URLs and error messages",
  "ui": "Layout and visual states — empty, loading, error — including a narrow mobile screen",
  "ux": "Whether the flow makes sense to a person using it, and whether the wording helps them",
  "data": "Whether the numbers and text on screen match the system of record behind them",
};

// What each severity is claiming, so a reader can calibrate without asking.
const SEVERITY_MEANING = {
  "critical": "Blocks release. Data loss, a security hole, or a core flow that cannot be completed.",
  "high": "Fix before release. A user hits this on a normal path and the product does the wrong thing.",
  "medium": "Fix soon. Real but survivable — a workaround exists, or the path is less common.",
  "low": "Worth fixing. Polish, hygiene, or a measurement that needs confirming before it is acted on.",
};

// How each browser adapter observed the application, in one honest phrase. A
// reader deciding how much to trust a finding needs to know what watched the page.
const ADAPTER_PLAIN = {
  "playwright-mcp": "a real browser driven by Playwright",
  "cursor-browser": "the editor's built-in browser",
  "cdp": "a real browser over the Chrome DevTools Protocol",
  "cli-playwright": "a real browser driven by the Playwright CLI",
  "cli-other": "a real browser driven from the command line",
  "unavailable": "no browser automation — findings come from artifacts supplied to the run",
};

const STATUS_LABEL = {
  "confirmed": "Confirmed",
  "validated-user-report": "Validated user report",
  "could-not-reproduce": "Could not reproduce",
  "partial": "Partially reproduced",
  "pass": "Passed",
  "fail": "Failed",
  "blocked": "Blocked",
  "skipped": "Skipped",
};

const VERDICT = {
  "pass": ["No defects found", "#116149", "#eaf7f1"],
  "issues-found": ["Issues found", "#a15c00", "#fdf6ec"],
  "blocked": ["Blocked", "#b3261e", "#fdf1f0"],
  "insufficient-data": ["Insufficient data", "#4a5568", "#f4f5f7"],
  "ready": ["Ready to ship", "#116149", "#eaf7f1"],
  "ready-with-risks": ["Ready with risks", "#a15c00", "#fdf6ec"],
  "not-ready": ["Not ready", "#b3261e", "#fdf1f0"],
};

const CSS = "\n*,*::before,*::after{box-sizing:border-box}\nbody{margin:0;background:#f7f8fa;color:#1a1d21;\n  font:16px/1.6 -apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif;\n  -webkit-font-smoothing:antialiased}\n.page{max-width:60rem;margin:0 auto;padding:2.5rem 1.5rem 3rem}\n.card{background:#fff;border:1px solid #e4e7ec;border-radius:12px;\n  box-shadow:0 1px 2px rgba(16,24,40,.04);margin-bottom:1.25rem;overflow:hidden}\n.card-body{padding:1.5rem}\nheader.masthead{margin-bottom:1.75rem}\n.eyebrow{font-size:.6875rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#667085}\nh1{margin:.35rem 0 .5rem;font-size:1.875rem;line-height:1.25;letter-spacing:-.02em}\nh2{margin:2rem 0 .875rem;font-size:1.125rem;letter-spacing:-.01em}\nh3{margin:0;font-size:1.0625rem;letter-spacing:-.01em}\n.meta{color:#667085;font-size:.8125rem}\n.meta strong{color:#344054;font-weight:600}\n.lead{margin:0 0 .25rem;font-size:1.0625rem;color:#475467;max-width:52rem}\n.intro p{margin:0 0 .75rem;max-width:52rem}\n.intro p:last-child{margin-bottom:0}\n.objective{margin:0 0 .875rem;max-width:52rem}\n.objective:last-child{margin-bottom:0}\n.verdict{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;\n  padding:1rem 1.25rem;border-radius:10px;font-weight:600;margin:1.25rem 0}\n.counts{display:flex;flex-wrap:wrap;gap:.5rem;margin:1.25rem 0}\n.count{flex:1 1 7rem;background:#fff;border:1px solid #e4e7ec;border-radius:10px;\n  padding:.75rem .875rem;text-align:center}\n.count .n{display:block;font-size:1.5rem;font-weight:700;line-height:1.2}\n.count .l{font-size:.6875rem;text-transform:uppercase;letter-spacing:.07em;color:#667085}\n.badge{display:inline-block;padding:.1875rem .5rem;border-radius:6px;\n  font-size:.6875rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;\n  border:1px solid currentColor}\n.chip{display:inline-block;padding:.1875rem .5rem;border-radius:6px;background:#f2f4f7;\n  color:#475467;font-size:.75rem;font-weight:500}\n.finding-head{display:flex;gap:.75rem;align-items:flex-start;\n  padding:1.125rem 1.5rem;border-bottom:1px solid #eef0f3}\n.finding-head .grow{flex:1;min-width:0}\n.finding-id{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.75rem;color:#667085}\ndl.behaviour{margin:0;display:grid;grid-template-columns:minmax(8.5rem,auto) 1fr;gap:.625rem 1.25rem}\ndl.behaviour dt{font-size:.75rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#667085;padding-top:.15rem}\ndl.behaviour dd{margin:0}\n.now{border-left:3px solid #b3261e;padding-left:.75rem}\n.want{border-left:3px solid #116149;padding-left:.75rem}\n.fix{border-left:3px solid #3538cd;padding-left:.75rem}\ntable{border-collapse:collapse;width:100%;font-size:.875rem}\nth,td{text-align:left;padding:.5625rem .75rem;border-bottom:1px solid #eef0f3;vertical-align:top}\nth{font-size:.6875rem;text-transform:uppercase;letter-spacing:.06em;color:#667085;\n  background:#fafbfc;font-weight:700}\ntbody tr:last-child td{border-bottom:0}\ncode{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.875em;\n  background:#f2f4f7;padding:.1rem .3rem;border-radius:4px}\npre{margin:0;background:#1a1d21;color:#e4e7ec;padding:1rem;border-radius:8px;\n  overflow-x:auto;font-size:.8125rem;line-height:1.55}\nfigure{margin:.875rem 0 0}\nfigure img{display:block;max-width:100%;height:auto;border:1px solid #e4e7ec;border-radius:8px}\nfigcaption{margin-top:.4rem;font-size:.75rem;color:#667085}\nul.clean{margin:0;padding-left:1.125rem}\nul.clean li{margin:.3rem 0}\nol.steps{margin:0;padding-left:1.25rem}\nol.steps li{margin:.15rem 0}\nol.order{margin:0;padding-left:1.25rem}\nol.order li{margin:.4rem 0}\n.empty{color:#667085;font-style:italic}\n@media print{body{background:#fff}.card{box-shadow:none;break-inside:avoid}.page{padding:0}}\n@media (max-width:34rem){dl.behaviour{grid-template-columns:1fr;gap:.25rem}\n  dl.behaviour dt{padding-top:.5rem}}\n";

/** HTML-escape, matching Python's `html.escape(s, quote=True)`. */
function e(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function severityBadge(severity) {
  const meta = SEVERITY[severity] ?? SEVERITY.low;
  return (
    `<span class="badge" style="color:${meta.colour};background:${meta.tint}">` +
    `${e(meta.label)}</span>`
  );
}

/**
 * What the report is about, short enough to be a heading.
 *
 * The contract has no title field, and the summary is a paragraph — using it as an
 * `<h1>` produced a five-line heading. The target under test is the honest short
 * answer, the way Lighthouse titles a report by its URL.
 */
function subject(result) {
  const url = String(result.url ?? '').trim();
  if (url) {
    const withoutScheme = url.includes('://') ? url.slice(url.indexOf('://') + 3) : url;
    return withoutScheme.replace(/\/+$/, '') || url;
  }
  return String(result.summary ?? 'QA report').split('.')[0].slice(0, 80);
}

/**
 * Reproduction as steps when it is written as steps, as prose otherwise.
 *
 * Numbered steps are the part of a report a reader retypes into a browser, so they
 * are rendered as a list rather than one dense line. The split is on the text's own
 * numbering — nothing is invented, reordered, or dropped.
 */
function reproSteps(repro) {
  const text = String(repro ?? '').trim();
  if (!text) return '<dd class="empty">Not recorded</dd>';
  let lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 1) {
    lines = text.split(/\s+(?=\d+[.)]\s)/).map((part) => part.trim()).filter(Boolean);
  }
  const steps = lines.map((line) => line.replace(/^\d+[.)]\s*/, ''));
  if (steps.length < 2 || !lines.every((line) => /^\d+[.)]\s/.test(line))) {
    return `<dd>${e(text)}</dd>`;
  }
  return `<dd><ol class="steps">${steps.map((step) => `<li>${e(step)}</li>`).join('')}</ol></dd>`;
}

/** Sort TC-2 before TC-10, the way a reader expects a case list to run. */
function naturalKey(identifier) {
  return String(identifier ?? '')
    .split(/(\d+)/)
    .map((part) => (/^\d+$/.test(part) ? Number.parseInt(part, 10) : part.toLowerCase()));
}

function compareNatural(a, b) {
  const left = naturalKey(a);
  const right = naturalKey(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const x = left[i];
    const y = right[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    // Python compares int to int and str to str; a mixed pair cannot occur here
    // because the split alternates text and digits from position 0 in both.
    if (x === y) continue;
    return x < y ? -1 : 1;
  }
  return 0;
}

/** A stable in-document id, so a failing test case can link to its finding. */
function anchor(findingId) {
  const safe = [...String(findingId ?? '')]
    .map((char) => (/[\p{L}\p{N}]/u.test(char) || char === '-' || char === '_' ? char : '-'))
    .join('');
  return safe ? `f-${safe}` : '';
}

function isImage(item) {
  const source = String(item.source ?? '').toLowerCase();
  return (
    item.type === 'screenshot' ||
    ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'].some((ext) => source.endsWith(ext))
  );
}

/**
 * A caption that is always meaningful.
 *
 * Finding-level evidence carries only `type` and `source` — `description` is
 * required on the top-level index, not here — so the type label is the fallback
 * rather than repeating the filename twice.
 */
function evidenceCaption(item) {
  const described = item.description;
  const label = EVIDENCE_LABEL[item.type] ?? item.type ?? 'Evidence';
  return described ? `${e(described)} — ${e(label)}` : e(label);
}

function evidenceFigures(items, indent = '    ') {
  const parts = [];
  for (const item of items ?? []) {
    const source = item.source ?? '';
    const caption = evidenceCaption(item);
    parts.push(`${indent}<figure>`);
    if (isImage(item)) {
      parts.push(`${indent}  <img src="${e(source)}" alt="${caption}"/>`);
    } else if (item.excerpt) {
      parts.push(`${indent}  <pre>${e(item.excerpt)}</pre>`);
    }
    parts.push(`${indent}  <figcaption>${caption} · <code>${e(source)}</code></figcaption>`);
    parts.push(`${indent}</figure>`);
  }
  return parts;
}

/**
 * One finding: the defect, then what happens now, then what should happen.
 *
 * Ordering is the point. `actual` and `expected` are required by the contract and
 * are the two things a reader cannot reconstruct for themselves, so they come
 * before reproduction and fix direction.
 */
function findingCard(finding) {
  const parts = [
    `<article class="card" id="${anchor(finding.id)}">`,
    '  <div class="finding-head">',
    `    ${severityBadge(finding.severity)}`,
    '    <div class="grow">',
    `      <h3>${e(finding.title)}</h3>`,
    `      <div class="finding-id">${e(finding.id)}</div>`,
    '    </div>',
    `    <span class="chip">${e(finding.dimension ?? '')}</span>`,
    `    <span class="chip">${e(STATUS_LABEL[finding.status] ?? finding.status ?? '')}</span>`,
    '  </div>',
    '  <div class="card-body">',
    '    <dl class="behaviour">',
    '      <dt>Current behaviour</dt>',
    `      <dd class="now">${e(finding.actual)}</dd>`,
    '      <dt>Expected behaviour</dt>',
    `      <dd class="want">${e(finding.expected)}</dd>`,
    '      <dt>Reproduction</dt>',
    `      ${reproSteps(finding.repro)}`,
    '      <dt>Fix direction</dt>',
    `      <dd class="fix">${e(finding.fixDirection)}</dd>`,
    '    </dl>',
  ];
  parts.push(...evidenceFigures(finding.evidence));
  parts.push('  </div>', '</article>');
  return parts.join('\n');
}

function titleCase(key) {
  return key
    .replace(/-/g, ' ')
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ');
}

function countsBlock(counts, order) {
  const cells = [];
  for (const key of order) {
    if (!(key in counts)) continue;
    const label = SEVERITY[key]?.label ?? titleCase(key);
    const colour = SEVERITY[key]?.colour ?? COUNT_STYLE[key] ?? '#1a1d21';
    cells.push(
      `<div class="count"><span class="n" style="color:${colour}">${e(counts[key])}</span>` +
        `<span class="l">${e(label)}</span></div>`,
    );
  }
  return cells.length > 0 ? `<div class="counts">${cells.join('')}</div>` : '';
}

/**
 * Executed cases, worst first, each failure linked to the finding it raised.
 *
 * A reader who starts from "which case failed?" should reach the explanation in one
 * click, so `findingId` becomes a link into the finding card rather than a bare
 * string they have to search for.
 */
function testCaseTable(testCases, findingIds = new Set()) {
  const cases = testCases.cases ?? [];
  if (cases.length === 0) return '';
  const order = { fail: 0, blocked: 1, skipped: 2, pass: 3 };
  const rank = (status) => order[status] ?? 4;
  const sorted = [...cases].sort(
    (a, b) => rank(a.status) - rank(b.status) || compareNatural(a.id, b.id),
  );
  const rows = sorted.map((testCase) => {
    const status = testCase.status ?? '';
    const styleKey = { fail: 'failed', pass: 'passed' }[status] ?? status;
    const colour = COUNT_STYLE[styleKey] ?? '#475467';
    const findingId = testCase.findingId;
    let link;
    if (findingId && findingIds.has(findingId)) {
      link = `<a href="#${anchor(findingId)}"><code>${e(findingId)}</code></a>`;
    } else if (findingId) {
      link = `<code>${e(findingId)}</code>`;
    } else {
      link = '<span class="empty">—</span>';
    }
    return (
      '<tr>' +
      `<td><code>${e(testCase.id)}</code></td>` +
      `<td>${e(testCase.title)}</td>` +
      `<td style="color:${colour};font-weight:600">` +
      `${e(STATUS_LABEL[status] ?? status)}</td>` +
      `<td>${link}</td>` +
      '</tr>'
    );
  });
  return (
    '<div class="card"><table><thead><tr><th>ID</th><th>Test case</th>' +
    '<th>Result</th><th>Finding</th></tr></thead><tbody>' +
    rows.join('') +
    '</tbody></table></div>'
  );
}

/**
 * Open the report for a reader who has never seen this product.
 *
 * A QA report is forwarded to people who were not in the room: a founder, a
 * designer, the developer who owns one of the six findings. Landing straight on
 * "EXP-1 · high" asks them to work out what kind of document this is, who produced
 * it, how it was produced, and how much to trust it. So it says so. Everything here
 * is derived from the artifact — nothing is asserted about work that was not
 * recorded.
 */
function orientation(result) {
  const cases = result.testCases ?? {};
  const executed = cases.total;
  const adapter = ADAPTER_PLAIN[result.browserAdapter];

  let how = ['opened the application'];
  if (adapter) how = [`opened the application in ${adapter}`];
  if (executed) how.push(`worked through ${executed} test case${executed !== 1 ? 's' : ''}`);
  how.push('captured proof for every defect it reports');

  const sentences = [
    'This is an <strong>exploratory QA report</strong>. An AI QA engineer ' +
      how.slice(0, -1).join(', ') +
      `, and ${how[how.length - 1]}.`,
    'Each finding below says what happens today, what should happen instead, ' +
      'and how to see it for yourself — so nothing here has to be taken on trust.',
  ];
  return (
    '<div class="card intro"><div class="card-body">' +
    sentences.map((sentence) => `<p>${sentence}</p>`).join('') +
    '</div></div>'
  );
}

/**
 * What was tested and what was not, in plain language.
 *
 * Dimension names are jargon and coverage counts are not scope: "18 cases" does not
 * tell a reader whether sign-up was looked at. The model supplies the feature-level
 * prose in `scope`; the dimension table and the not-covered derivations are
 * computed, so a run that omits `scope` still explains itself.
 */
function scopeBlock(result) {
  const scope = result.scope ?? {};
  const dimensions = result.dimensionsRun ?? [];
  const parts = [];

  if (scope.objective) parts.push(`<p class="objective">${e(scope.objective)}</p>`);
  if (scope.covered && scope.covered.length > 0) {
    parts.push(`<ul class="clean">${scope.covered.map((x) => `<li>${e(x)}</li>`).join('')}</ul>`);
  }
  if (parts.length === 0 && dimensions.length === 0) return '';

  let body = parts.length > 0
    ? `<div class="card"><div class="card-body">${parts.join('')}</div></div>`
    : '';

  if (dimensions.length > 0) {
    const rows = dimensions
      .map(
        (d) =>
          `<tr><td><strong>${e(DIMENSION_LABEL[d] ?? d)}</strong></td>` +
          `<td>${e(DIMENSION_PLAIN[d] ?? '')}</td></tr>`,
      )
      .join('');
    body +=
      '<div class="card"><table><thead><tr><th>Area checked</th>' +
      `<th>What that means</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  return body;
}

/**
 * The boundary of the run, stated rather than left to inference.
 *
 * An unstated boundary reads as "everything was checked". Blocked cases and skipped
 * dimensions are the two boundaries the artifact already knows about, so they are
 * added to whatever the run declared.
 */
function notCoveredBlock(result) {
  const scope = result.scope ?? {};
  const items = (scope.notCovered ?? []).map((x) => String(x));

  const ran = new Set(result.dimensionsRun ?? []);
  if (ran.size > 0) {
    for (const dimension of Object.keys(DIMENSION_PLAIN)) {
      if (ran.has(dimension)) continue;
      // Named with its plain-language meaning: "Data" alone tells a reader who does
      // not work in QA nothing about what went unchecked.
      const plain = DIMENSION_PLAIN[dimension];
      items.push(
        `${DIMENSION_LABEL[dimension] ?? dimension} was not examined — ` +
          `${plain[0].toLowerCase()}${plain.slice(1)}`,
      );
    }
  }

  const db = result.dbValidation ?? {};
  if (db.inScope === false && !db.summary) {
    items.push('Data was not compared against the system of record — no access was provided.');
  }

  const blocked = (result.testCases?.cases ?? []).filter((c) => c.status === 'blocked');
  if (blocked.length > 0) {
    const listed = blocked.map((c) => `${c.id} (${c.title})`).join(', ');
    items.push(`Could not be run: ${listed}`);
  }

  if (items.length === 0) return '';
  const listing = items.map((x) => `<li>${e(x)}</li>`).join('');
  return (
    '<h2>Not covered in this run</h2>' +
    `<div class="card"><div class="card-body"><ul class="clean">${listing}</ul></div></div>`
  );
}

/** What the severity labels mean, so nobody has to ask. */
function legendBlock() {
  const rows = Object.entries(SEVERITY_MEANING)
    .map(([key, meaning]) => `<tr><td>${severityBadge(key)}</td><td>${e(meaning)}</td></tr>`)
    .join('');
  return (
    '<div class="card"><table><thead><tr><th>Severity</th><th>What it means</th></tr>' +
    `</thead><tbody>${rows}</tbody></table></div>`
  );
}

/**
 * The run's evidence, listed once with its descriptions.
 *
 * The contract requires this array and the hand-written report reduced it to a line
 * of prose, so a reader could not tell what proof the run actually holds.
 */
function evidenceIndex(evidence) {
  if (!evidence || evidence.length === 0) return '';
  const rows = evidence
    .map(
      (item) =>
        '<tr>' +
        `<td>${e(EVIDENCE_LABEL[item.type] ?? item.type ?? '')}</td>` +
        `<td>${e(item.description ?? '')}</td>` +
        `<td><code>${e(item.source)}</code></td>` +
        '</tr>',
    )
    .join('');
  return (
    '<div class="card"><table><thead><tr><th>Kind</th><th>Shows</th>' +
    `<th>File</th></tr></thead><tbody>${rows}</tbody></table></div>`
  );
}

/** Render an explore-result artifact. */
export function renderExplore(result) {
  const findings = [...(result.findings ?? [])].sort(
    (a, b) =>
      (SEVERITY[a.severity] ?? SEVERITY.low).rank - (SEVERITY[b.severity] ?? SEVERITY.low).rank,
  );
  const [verdictLabel, verdictColour, verdictTint] =
    VERDICT[result.classification] ?? ['Reported', '#4a5568', '#f4f5f7'];

  const metaBits = [];
  if (result.url) metaBits.push(`<strong>Target</strong> <code>${e(result.url)}</code>`);
  if (result.generatedAt) metaBits.push(`<strong>Generated</strong> ${e(result.generatedAt)}`);
  if (result.browserAdapter) metaBits.push(`<strong>Browser</strong> ${e(result.browserAdapter)}`);
  if (result.reportVersion) metaBits.push(`<strong>Report</strong> v${e(result.reportVersion)}`);

  const body = [
    '<header class="masthead">',
    '  <div class="eyebrow">Exploratory QA report</div>',
    `  <h1>${e(subject(result))}</h1>`,
    `  <p class="meta">${metaBits.join(' &middot; ')}</p>`,
    '</header>',
    `<p class="lead">${e(result.summary ?? '')}</p>`,
    `<div class="verdict" style="color:${verdictColour};background:${verdictTint}">` +
      `${e(verdictLabel)}</div>`,
  ];

  body.push(countsBlock(result.severityCounts ?? {}, ['critical', 'high', 'medium', 'low']));

  const tests = result.testCases ?? {};
  if (Object.keys(tests).length > 0) {
    const picked = {};
    for (const key of ['total', 'passed', 'failed', 'blocked', 'skipped']) {
      if (key in tests) picked[key] = tests[key];
    }
    body.push(countsBlock(picked, ['total', 'passed', 'failed', 'blocked', 'skipped']));
  }

  // Orientation before detail. A reader who has never seen this product needs to
  // know what the document is, what was looked at, what was not, and what the
  // labels mean — before the first finding, not in an appendix.
  body.push('<h2>About this report</h2>');
  body.push(orientation(result));

  const scope = scopeBlock(result);
  if (scope) {
    body.push('<h2>What was tested</h2>');
    body.push(scope);
  }

  const notCovered = notCoveredBlock(result);
  if (notCovered) body.push(notCovered);

  body.push('<h2>How to read the findings</h2>');
  body.push(legendBlock());

  body.push('<h2>Findings</h2>');
  if (findings.length > 0) {
    body.push(...findings.map((finding) => findingCard(finding)));
  } else {
    body.push('<div class="card"><div class="card-body empty">No findings recorded.</div></div>');
  }

  if ((tests.cases ?? []).length > 0) {
    body.push('<h2>Test case coverage</h2>');
    body.push(testCaseTable(tests, new Set(findings.map((f) => f.id))));
  }

  const db = result.dbValidation ?? {};
  const dbHeaded = Boolean(db.summary) || db.inScope !== undefined;
  if (dbHeaded) {
    body.push('<h2>Data validation</h2>');
    const note = db.summary || (db.inScope ? 'In scope.' : 'Not in scope for this run.');
    body.push(`<div class="card"><div class="card-body">${e(note)}</div></div>`);
  }
  if (db.comparisons && db.comparisons.length > 0) {
    if (!dbHeaded) body.push('<h2>Data validation</h2>');
    const rows = db.comparisons
      .map(
        (c) =>
          '<tr>' +
          `<td>${e(c.metric)}</td><td><code>${e(c.uiValue)}</code></td>` +
          `<td><code>${e(c.sourceValue)}</code></td>` +
          `<td style="color:${c.match ? '#116149' : '#b3261e'};font-weight:600">` +
          `${c.match ? 'Match' : 'Mismatch'}</td></tr>`,
      )
      .join('');
    body.push(
      '<div class="card"><table><thead><tr><th>Metric</th><th>Shown in UI</th>' +
        `<th>Source of truth</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    );
  }

  if (result.fixOrder && result.fixOrder.length > 0) {
    body.push('<h2>Suggested fix order</h2>');
    const items = result.fixOrder.map((x) => `<li>${e(x)}</li>`).join('');
    body.push(`<div class="card"><div class="card-body"><ol class="order">${items}</ol></div></div>`);
  }

  if (result.recommendations && result.recommendations.length > 0) {
    body.push('<h2>Recommendations</h2>');
    const rows = result.recommendations
      .map((r) => `<tr><td>${e(r.action)}</td><td>${e(r.priority)}</td></tr>`)
      .join('');
    body.push(
      '<div class="card"><table><thead><tr><th>Action</th><th>Priority</th></tr>' +
        `</thead><tbody>${rows}</tbody></table></div>`,
    );
  }

  if (result.whatWorksWell && result.whatWorksWell.length > 0) {
    body.push('<h2>Verified working</h2>');
    const items = result.whatWorksWell.map((x) => `<li>${e(x)}</li>`).join('');
    body.push(`<div class="card"><div class="card-body"><ul class="clean">${items}</ul></div></div>`);
  }

  if (result.evidence && result.evidence.length > 0) {
    body.push('<h2>Evidence index</h2>');
    body.push(evidenceIndex(result.evidence));
  }

  return body.join('\n');
}

/** Render a report-result artifact (qa-report's release rollup). */
export function renderReport(result) {
  const readiness = result.releaseReadiness ?? {};
  const verdict = 'verdict' in readiness ? readiness.verdict : result.classification;
  const [label, colour, tint] = VERDICT[verdict] ?? ['Reported', '#4a5568', '#f4f5f7'];
  const summaries = result.summaries ?? {};

  const body = [
    '<header class="masthead">',
    '  <div class="eyebrow">Release readiness report</div>',
    `  <h1>${e(subject(result))}</h1>`,
    `  <p class="meta"><strong>Generated</strong> ${e(result.generatedAt ?? '')}</p>`,
    '</header>',
    `<p class="lead">${e(result.summary ?? '')}</p>`,
    `<div class="verdict" style="color:${colour};background:${tint}">${e(label)}</div>`,
  ];
  if (readiness.rationale) {
    body.push(`<div class="card"><div class="card-body">${e(readiness.rationale)}</div></div>`);
  }

  const tests = result.testSummary ?? {};
  const picked = {};
  for (const key of ['total', 'passed', 'failed', 'skipped']) {
    if (key in tests) picked[key] = tests[key];
  }
  body.push(countsBlock(picked, ['total', 'passed', 'failed', 'skipped']));

  for (const [key, heading] of [
    ['executive', 'Executive summary'],
    ['engineering', 'Engineering summary'],
  ]) {
    if (summaries[key]) {
      body.push(`<h2>${heading}</h2>`);
      body.push(`<div class="card"><div class="card-body">${e(summaries[key])}</div></div>`);
    }
  }

  if (result.failureSummary && result.failureSummary.length > 0) {
    body.push('<h2>Failures</h2>');
    const rows = result.failureSummary
      .map(
        (f) =>
          `<tr><td>${e(f.test)}</td><td>${e(f.classification)}</td>` +
          `<td>${e(f.reason)}</td></tr>`,
      )
      .join('');
    body.push(
      '<div class="card"><table><thead><tr><th>Test</th><th>Classification</th>' +
        `<th>Reason</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    );
  }

  if (result.recommendations && result.recommendations.length > 0) {
    body.push('<h2>Recommendations</h2>');
    const rows = result.recommendations
      .map((r) => `<tr><td>${e(r.action)}</td><td>${e(r.priority)}</td></tr>`)
      .join('');
    body.push(
      '<div class="card"><table><thead><tr><th>Action</th><th>Priority</th></tr>' +
        `</thead><tbody>${rows}</tbody></table></div>`,
    );
  }

  return body.join('\n');
}

const RENDERERS = {
  'qa-explore/explore-result': renderExplore,
  'qa-report/report-result': renderReport,
};

/** Render a full standalone HTML document for a supported artifact. */
export function render(result, { title = null } = {}) {
  const contract = result.contract?.name;
  const renderer = RENDERERS[contract];
  if (!renderer) {
    throw new ReportError(
      `no HTML renderer for contract ${contract === undefined ? 'None' : `'${contract}'`}; supported: ` +
        Object.keys(RENDERERS).sort().join(', '),
    );
  }

  const heading = title ?? `QA report — ${subject(result)}`;
  return (
    '<!DOCTYPE html>\n' +
    '<html lang="en">\n<head>\n' +
    '<meta charset="utf-8"/>\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"/>\n' +
    `<title>${e(heading)}</title>\n` +
    `<style>${CSS}</style>\n` +
    '</head>\n<body>\n' +
    '<div class="page">\n' +
    `${renderer(result)}\n` +
    // Attribution is part of the document, not an optional flourish.
    `${footerHtml()}` +
    '</div>\n</body>\n</html>\n'
  );
}

/** Read an artifact from disk and render it. */
export function renderFile(path, { title = null } = {}) {
  let result;
  try {
    result = JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (error) {
    throw new ReportError(`could not read artifact at ${path}: ${error.message}`);
  }
  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    throw new ReportError(`artifact at ${path} is not a JSON object`);
  }
  return render(result, { title });
}

export function supportedContracts() {
  return Object.keys(RENDERERS).sort();
}
