// Assembling the HTML document.
//
// One file, no external request. The stylesheet, the script, and the attribution are
// inlined; images are the only thing that stays on disk, and they sit beside the
// report in the same run folder so the whole directory moves as a unit.
//
// The order below is the document's argument, and it is deliberately front-loaded:
// masthead, verdict, then the numbers. Everything a reader needs to make a decision is
// above the fold; everything they need to *check* the decision is below it.

import { footerHtml } from '../../analysis/branding.mjs';
import { stylesheet } from '../theme/css.mjs';
import { runtimeScript } from '../components/runtime.mjs';
import { sidebar, toolbar, lightbox } from '../components/nav.mjs';
import { buildModel } from '../core/model.mjs';
import { buildSections, renderSections, filterSections, MODES } from '../core/sections.mjs';
import { supportedContracts as normalizerContracts, SchemaError } from '../core/normalize.mjs';
import { e, formatDuration } from '../components/primitives.mjs';
import { versionStamp, versionLine } from '../version.mjs';

// `name` is set explicitly: without it every one of these serializes and prints as
// plain "Error", which is exactly the wrong thing to read in a CI log.
export class ReportError extends Error {
  name = 'ReportError';
}

/**
 * The masthead: what this is, what it is about, and when it was produced.
 *
 * The URL is a link because the first thing a reader does with a QA report is open the
 * thing being reported on. `rel="noopener noreferrer"` because a report is opened from
 * anywhere and a tab that can reach back into `window.opener` is a real hazard.
 */
function masthead(model) {
  const facts = [
    model.generatedAt ? { label: 'Generated', value: model.generatedAt.slice(0, 10) } : null,
    model.environment ? { label: 'Environment', value: model.environment } : null,
    model.pages.length > 0 ? { label: 'Pages', value: String(model.pages.length) } : null,
    model.testCases?.total ? { label: 'Test cases', value: String(model.testCases.total) } : null,
    { label: 'Findings', value: String(model.totalFindings) },
    model.durationMs !== null ? { label: 'Duration', value: formatDuration(model.durationMs) } : null,
    model.reportVersion ? { label: 'Report', value: `v${model.reportVersion}` } : null,
  ].filter(Boolean);

  const target = model.url
    ? `<a href="${e(model.url)}" target="_blank" rel="noopener noreferrer">${e(model.url)}</a>`
    : '';

  const verdict = model.verdict;
  const confidence =
    verdict.confidence !== null
      ? `<span class="verdict-confidence">${Math.round(verdict.confidence * 100)}% confidence</span>`
      : '';

  return (
    '<header class="masthead">' +
    '<div class="eyebrow">Exploratory QA report</div>' +
    `<h1>${e(model.subject)}</h1>` +
    (target || model.title ? `<p class="subject">${target}</p>` : '') +
    `<dl class="factbar">${facts
      .map((fact) => `<div class="fact"><dt>${e(fact.label)}</dt><dd>${e(fact.value)}</dd></div>`)
      .join('')}</dl>` +
    `<div class="verdict tone-${e(verdict.tone)}">` +
    `<span class="verdict-label"><span class="verdict-dot"></span>${e(verdict.label)}</span>` +
    `<span class="verdict-blurb">${e(verdict.blurb)}</span>` +
    confidence +
    '</div>' +
    '</header>'
  );
}

/** Render the body of a report from a model, filtered to a mode. */
export function renderBody(model, { mode = 'full' } = {}) {
  // The search-and-filter bar is only meaningful over a list worth filtering, and the
  // executive rendering has no findings list at all.
  const toolbarHtml =
    model.findings.length >= 2 && mode !== 'executive'
      ? toolbar(model.severityCounts, { dimensions: model.dimensions })
      : '';

  const sections = filterSections(buildSections(model, { toolbarHtml }), mode);

  return (
    '<a class="skip" href="#findings">Skip to findings</a>' +
    '<div class="shell">' +
    sidebar(sections, {
      productName: model.subject,
      subtitle: model.generatedAt ? model.generatedAt.slice(0, 10) : 'QA report',
    }) +
    '<main class="main" id="main">' +
    masthead(model) +
    renderSections(sections) +
    footerHtml() +
    '</main>' +
    '</div>' +
    lightbox()
  );
}

/**
 * A full standalone HTML document.
 *
 * `resultPath` and `outPath` are what make evidence links work: the first says where
 * declared paths are relative to, the second says what the hrefs must be relative to.
 * Passing neither still renders — every artifact simply reports as missing, which is
 * the honest outcome for a result rendered with no idea where its files are.
 *
 * `mode` selects the audience. `artifact` returns the page *without* the document
 * wrapper, for a host that supplies its own `<head>` — Claude Artifacts, a wiki, a
 * dashboard iframe. It is the same markup and the same stylesheet, so an embedded
 * report and a standalone one are visually identical.
 */
export function render(result, options = {}) {
  const mode = options.mode ?? 'full';
  if (!(mode in MODES)) {
    throw new ReportError(
      `unknown rendering mode '${mode}'; expected one of: ${Object.keys(MODES).join(', ')}`,
    );
  }

  let model;
  try {
    model = buildModel(result, options);
  } catch (error) {
    // The normalizer's refusals are report errors from a caller's point of view; the
    // CLI maps ReportError to a clean exit code and a readable message.
    if (error instanceof SchemaError) throw new ReportError(error.message);
    throw error;
  }

  const heading = options.title ?? `QA report — ${model.subject}`;
  const versions = versionStamp();

  // `assets` moves the stylesheet and the script into sibling files, for the bundle
  // layout. Everything else about the document is identical, and both remain
  // dependency-free — a local file reference is not an external dependency.
  const assets = options.assets ?? null;
  const styleTag = assets
    ? `<link rel="stylesheet" href="${e(assets.css)}"/>\n`
    : `<style>${stylesheet()}</style>\n`;
  const scriptTag = assets
    ? `<script src="${e(assets.js)}"></script>\n`
    : `<script>${runtimeScript()}</script>\n`;

  const body = `${renderBody(model, { mode })}\n${scriptTag}`;

  if (mode === 'artifact') {
    // No <html>/<head>/<body>: the host provides them. The <title> and the styling are
    // still emitted, because both are legal in a body and both are needed for the
    // page to be recognisably the same report.
    return `<title>${e(heading)}</title>\n${styleTag}${body}`;
  }

  return (
    '<!DOCTYPE html>\n' +
    '<html lang="en">\n<head>\n' +
    '<meta charset="utf-8"/>\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"/>\n' +
    '<meta name="color-scheme" content="light dark"/>\n' +
    `<meta name="description" content="${e(String(model.summary).slice(0, 200))}"/>\n` +
    '<meta name="generator" content="qa-engineer"/>\n' +
    `<meta name="qa-schema-version" content="${e(versions.schemaVersion)}"/>\n` +
    `<meta name="qa-theme-version" content="${e(versions.themeName)} v${e(versions.themeVersion)}"/>\n` +
    `<meta name="qa-renderer-version" content="${e(versions.rendererVersion)}"/>\n` +
    `<title>${e(heading)}</title>\n` +
    styleTag +
    '</head>\n<body>\n' +
    body +
    '</body>\n</html>\n'
  );
}

/** Contract names the renderer accepts, from the normalizer registry. */
export function supportedContracts() {
  return normalizerContracts();
}

/** The rendering modes, for `--help` and for validation. */
export function supportedModes() {
  return Object.keys(MODES);
}

export { versionStamp, versionLine };
