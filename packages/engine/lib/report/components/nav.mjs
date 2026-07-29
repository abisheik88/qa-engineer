// The sticky sidebar and the findings toolbar.
//
// A twelve-section report needs a map, and a report shared with six audiences needs a
// way for each of them to reach their part of it: an engineering manager wants
// Findings, a CTO wants Overview and Security, a designer wants Screenshots.
//
// Both controls degrade honestly. The sidebar is a list of in-page anchors, so it
// works with scripting disabled and it prints as nothing (deliberately hidden). The
// toolbar's search and filters need script, so they are rendered only when the report
// has enough findings to be worth filtering, and the findings themselves are always
// present in the document whether or not the toolbar ever runs.

import { e, icon } from './primitives.mjs';
import { SEVERITY, SEVERITY_ORDER } from '../theme/tokens.mjs';

/** The sidebar: brand, then one anchor per section that has content. */
export function sidebar(sections, { productName, subtitle }) {
  const links = sections
    .filter((section) => section.body)
    .map(
      (section) =>
        `<a href="#${e(section.id)}" data-target="${e(section.id)}">` +
        `<span>${e(section.navLabel ?? section.title)}</span>` +
        (section.count === null || section.count === undefined
          ? ''
          : `<span class="n">${e(section.count)}</span>`) +
        '</a>',
    )
    .join('');

  return (
    '<aside class="sidebar" aria-label="Report sections">' +
    '<div class="sidebar-brand">' +
    '<span class="sidebar-mark" aria-hidden="true">QA</span>' +
    `<span><span class="sidebar-name">${e(productName)}</span>` +
    `<br><span class="sidebar-sub">${e(subtitle)}</span></span>` +
    '</div>' +
    `<nav class="toc" aria-label="Sections">${links}</nav>` +
    '</aside>'
  );
}

/**
 * Search, severity filters, expand/collapse, theme, print.
 *
 * The severity buttons start pressed — the default view is everything, and a filter
 * that hides findings before the reader asks is how a report loses a critical.
 */
export function toolbar(counts, { dimensions = [] } = {}) {
  const severityFilters = SEVERITY_ORDER.filter((key) => (counts[key] ?? 0) > 0)
    .map(
      (key) =>
        `<button type="button" class="filter sev-${key}" data-filter="severity" data-value="${key}" ` +
        `aria-pressed="true"><span class="dot"></span>${e(SEVERITY[key].label)} ` +
        `<span class="tabular">${e(counts[key] ?? 0)}</span></button>`,
    )
    .join('');

  const dimensionFilters = dimensions
    .map(
      (dimension) =>
        `<button type="button" class="filter" data-filter="dimension" data-value="${e(dimension.key)}" ` +
        `aria-pressed="true">${e(dimension.label)} <span class="tabular">${e(dimension.count)}</span></button>`,
    )
    .join('');

  return (
    '<div class="toolbar" role="search">' +
    '<label class="search">' +
    icon('search', 16) +
    '<input type="search" id="finding-search" placeholder="Search findings, APIs, pages, root causes…" ' +
    'autocomplete="off" aria-label="Search findings">' +
    '</label>' +
    `<div class="filters">${severityFilters}${dimensionFilters}</div>` +
    '<span class="match-count" id="match-count" aria-live="polite"></span>' +
    '<button type="button" class="iconbtn" id="toggle-all" title="Expand or collapse every finding" ' +
    `aria-label="Expand or collapse every finding">${icon('expand', 16)}</button>` +
    '<button type="button" class="iconbtn" id="toggle-theme" title="Switch between light and dark" ' +
    `aria-label="Switch between light and dark">${icon('moon', 16)}</button>` +
    '<button type="button" class="iconbtn" id="print-report" title="Print or save as PDF" ' +
    `aria-label="Print or save as PDF">${icon('print', 16)}</button>` +
    '</div>'
  );
}

/** The lightbox shell. Empty until a screenshot is clicked. */
export function lightbox() {
  return (
    '<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Screenshot viewer" hidden>' +
    '<div class="lightbox-bar">' +
    '<span class="grow" id="lightbox-name"></span>' +
    '<button type="button" id="lightbox-zoom">Zoom</button>' +
    '<a id="lightbox-open" href="#" target="_blank" rel="noopener noreferrer">Open file</a>' +
    `<button type="button" id="lightbox-close" aria-label="Close viewer">${icon('close', 16)}</button>` +
    '</div>' +
    '<img id="lightbox-img" alt="">' +
    '</div>'
  );
}
