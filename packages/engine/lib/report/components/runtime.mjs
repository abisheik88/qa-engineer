// The report's client-side behaviour, emitted as one inline <script>.
//
// ## Rules this script lives by
//
// 1. **The report works without it.** Findings are real `<details>`, navigation is
//    real anchors, every image is a real `<img>`. This adds search, filtering, the
//    lightbox, and the theme toggle — it is not what makes the document readable.
// 2. **It never throws.** A report that logs an error to the console is a report the
//    reader stops trusting, and one uncaught exception stops every later listener from
//    binding. Every entry point is guarded and every optional element is null-checked.
// 3. **No storage assumptions.** A report opened from `file://` may have `localStorage`
//    blocked outright, so persistence is best-effort and its absence changes nothing.
//
// It is written as plain ES5-compatible ES2017 — no modules, no optional chaining in
// the emitted source — because a report gets opened in whatever browser the recipient
// has, including the embedded one in a mail client.

/** The inline script, as source text. */
export function runtimeScript() {
  return `
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function all(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

  /* ── Theme ──────────────────────────────────────────────────────────────
    The OS preference is the default; an explicit choice overrides it and is
    remembered when storage allows. */
  var THEME_KEY = 'qa-report-theme';
  function storedTheme() {
    try { return window.localStorage.getItem(THEME_KEY); } catch (err) { return null; }
  }
  function storeTheme(value) {
    try { window.localStorage.setItem(THEME_KEY, value); } catch (err) { /* private mode, file:// */ }
  }
  function systemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme(value) {
    document.documentElement.setAttribute('data-theme', value);
    var button = $('toggle-theme');
    if (button) {
      button.setAttribute('aria-label', value === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      button.setAttribute('title', value === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }
  }
  var initial = storedTheme();
  if (initial === 'dark' || initial === 'light') applyTheme(initial);
  var themeButton = $('toggle-theme');
  if (themeButton) {
    themeButton.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme') || systemTheme();
      var next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      storeTheme(next);
    });
  }

  var printButton = $('print-report');
  if (printButton) printButton.addEventListener('click', function () { window.print(); });

  /* ── Search and filtering ───────────────────────────────────────────────
    The DOM is the index: every finding carries its searchable text and its facets
    as data attributes, so there is no second copy to fall out of step. */
  var findings = all('.finding');
  var searchBox = $('finding-search');
  var matchCount = $('match-count');
  var noResults = $('no-results');
  var filterButtons = all('.filter');
  var query = '';

  function activeValues(kind) {
    var pressed = [];
    var any = false;
    filterButtons.forEach(function (button) {
      if (button.getAttribute('data-filter') !== kind) return;
      any = true;
      if (button.getAttribute('aria-pressed') === 'true') pressed.push(button.getAttribute('data-value'));
    });
    return any ? pressed : null;
  }

  function apply() {
    var severities = activeValues('severity');
    var dimensions = activeValues('dimension');
    var shown = 0;

    findings.forEach(function (finding) {
      var text = finding.getAttribute('data-search') || '';
      var matchesQuery = !query || text.indexOf(query) !== -1;
      var matchesSeverity = !severities || severities.indexOf(finding.getAttribute('data-severity')) !== -1;
      var matchesDimension = !dimensions || dimensions.indexOf(finding.getAttribute('data-dimension')) !== -1;
      var visible = matchesQuery && matchesSeverity && matchesDimension;
      finding.hidden = !visible;
      if (visible) shown++;
      /* A search that matches text inside a collapsed card should show that text. */
      if (visible && query && !finding.open) finding.open = true;
    });

    if (matchCount) {
      matchCount.textContent = shown === findings.length
        ? ''
        : shown + ' of ' + findings.length + ' shown';
    }
    if (noResults) noResults.className = shown === 0 && findings.length > 0 ? 'no-results on' : 'no-results';
  }

  if (searchBox) {
    var debounce = null;
    searchBox.addEventListener('input', function () {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(function () {
        query = searchBox.value.trim().toLowerCase();
        apply();
      }, 120);
    });
    /* Escape clears, which is what every search box a reader has ever used does. */
    searchBox.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { searchBox.value = ''; query = ''; apply(); }
    });
  }

  filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var pressed = button.getAttribute('aria-pressed') === 'true';
      button.setAttribute('aria-pressed', pressed ? 'false' : 'true');
      apply();
    });
  });

  var toggleAll = $('toggle-all');
  if (toggleAll && findings.length) {
    toggleAll.addEventListener('click', function () {
      var anyClosed = findings.some(function (finding) { return !finding.open && !finding.hidden; });
      findings.forEach(function (finding) { if (!finding.hidden) finding.open = anyClosed; });
    });
  }

  /* ── Lightbox ───────────────────────────────────────────────────────────
    Screenshots are the evidence most often examined closely, and a report that
    makes the reader open a file manager to see one at full size is not evidence
    they will check. */
  var box = $('lightbox');
  var boxImage = $('lightbox-img');
  var boxName = $('lightbox-name');
  var boxOpen = $('lightbox-open');
  var boxZoom = $('lightbox-zoom');
  var lastFocus = null;

  function closeBox() {
    if (!box) return;
    box.classList.remove('on', 'zoomed');
    box.hidden = true;
    if (boxImage) boxImage.removeAttribute('src');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function openBox(image) {
    if (!box || !boxImage) return;
    lastFocus = image;
    boxImage.src = image.getAttribute('data-full') || image.src;
    boxImage.alt = image.alt || '';
    if (boxName) boxName.textContent = image.getAttribute('data-name') || image.alt || '';
    if (boxOpen) boxOpen.href = image.getAttribute('data-full') || image.src;
    box.hidden = false;
    box.classList.add('on');
    box.classList.remove('zoomed');
    var close = $('lightbox-close');
    if (close && close.focus) close.focus();
  }

  all('img.js-zoom').forEach(function (image) {
    image.addEventListener('click', function () { openBox(image); });
    /* Keyboard parity: an image that only opens on click is evidence a keyboard user
      cannot examine. */
    image.setAttribute('tabindex', '0');
    image.setAttribute('role', 'button');
    image.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openBox(image); }
    });
  });

  if (box) {
    box.addEventListener('click', function (event) {
      if (event.target === box || event.target === boxImage) {
        if (event.target === boxImage && !box.classList.contains('zoomed')) return closeBox();
        closeBox();
      }
    });
    var closeButton = $('lightbox-close');
    if (closeButton) closeButton.addEventListener('click', closeBox);
    if (boxZoom) {
      boxZoom.addEventListener('click', function (event) {
        event.stopPropagation();
        box.classList.toggle('zoomed');
        boxZoom.textContent = box.classList.contains('zoomed') ? 'Fit' : 'Zoom';
      });
    }
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !box.hidden) closeBox();
    });
  }

  /* ── Scroll spy ─────────────────────────────────────────────────────────
    Which section the reader is in, reflected in the sidebar. IntersectionObserver
    rather than a scroll listener: no layout thrash, and it degrades to "no active
    highlight" on a browser that lacks it rather than to a broken page. */
  var links = all('nav.toc a');
  if (links.length && 'IntersectionObserver' in window) {
    var byId = {};
    links.forEach(function (link) { byId[link.getAttribute('data-target')] = link; });
    var visible = {};
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { visible[entry.target.id] = entry.isIntersecting; });
      var current = null;
      all('section.section').forEach(function (section) {
        if (!current && visible[section.id]) current = section.id;
      });
      links.forEach(function (link) {
        link.classList.toggle('active', link.getAttribute('data-target') === current);
      });
    }, { rootMargin: '-72px 0px -60% 0px', threshold: 0 });
    all('section.section').forEach(function (section) { spy.observe(section); });
  }

  /* ── Entrance ───────────────────────────────────────────────────────────
    Staggered only on first paint, capped so a long report does not spend two
    seconds animating content the reader is already scrolling past. */
  if (window.matchMedia && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    all('.reveal').forEach(function (element, index) {
      element.style.animationDelay = Math.min(index * 40, 320) + 'ms';
    });
  }

  /* A deep link to a finding must land on it open, not on a collapsed row. */
  function openHashTarget() {
    if (!window.location.hash) return;
    var target = document.getElementById(window.location.hash.slice(1));
    if (target && target.tagName === 'DETAILS') target.open = true;
  }
  openHashTarget();
  window.addEventListener('hashchange', openHashTarget);
})();
`.trim();
}
