// The report stylesheet, emitted as one inline <style>.
//
// Inline and self-contained is a hard requirement, not a preference: a QA report is
// forwarded as an attachment and opened on a plane, from a `file://` path, inside a
// corporate mail client that blocks remote content. A CDN stylesheet or a web font
// turns a premium report into unstyled text at exactly the moment it is being read
// by the person who matters most.
//
// So: system font stack, no @import, no external asset, and every colour derived
// from tokens.mjs so the badges, the charts, and the score gauges cannot disagree.
//
// ## Three renderings, one document
//
//   screen light — the default, driven by prefers-color-scheme
//   screen dark  — the same tokens at a different luminance
//   print        — glass and shadow removed, cards forced open, links given their href
//
// The theme toggle writes `data-theme` on <html>, and those rules are last so a
// reader's explicit choice beats their OS setting in both directions.

import { SEVERITY, STATUS, TONE, SEVERITY_ORDER } from './tokens.mjs';

/** Per-severity badge and accent rules, generated so a new severity cannot be missed. */
function severityRules() {
  const out = [];
  for (const key of SEVERITY_ORDER) {
    const { light, dark } = SEVERITY[key];
    out.push(
      `.sev-${key}{--sev-fg:${light.fg};--sev-bg:${light.bg};--sev-border:${light.border};--sev-solid:${light.solid}}`,
    );
    out.push(
      `[data-theme="dark"] .sev-${key}{--sev-fg:${dark.fg};--sev-bg:${dark.bg};--sev-border:${dark.border};--sev-solid:${dark.solid}}`,
    );
  }
  out.push('@media (prefers-color-scheme:dark){');
  for (const key of SEVERITY_ORDER) {
    const { dark } = SEVERITY[key];
    out.push(
      `:root:not([data-theme="light"]) .sev-${key}{--sev-fg:${dark.fg};--sev-bg:${dark.bg};--sev-border:${dark.border};--sev-solid:${dark.solid}}`,
    );
  }
  out.push('}');
  return out.join('');
}

/** The same treatment for pass/fail/blocked/skipped chips. */
function statusRules() {
  const out = [];
  for (const [key, value] of Object.entries(STATUS)) {
    out.push(`.st-${key}{--st-fg:${value.light.fg};--st-bg:${value.light.bg};--st-solid:${value.light.solid}}`);
    out.push(`[data-theme="dark"] .st-${key}{--st-fg:${value.dark.fg};--st-bg:${value.dark.bg};--st-solid:${value.dark.solid}}`);
  }
  out.push('@media (prefers-color-scheme:dark){');
  for (const [key, value] of Object.entries(STATUS)) {
    out.push(`:root:not([data-theme="light"]) .st-${key}{--st-fg:${value.dark.fg};--st-bg:${value.dark.bg};--st-solid:${value.dark.solid}}`);
  }
  out.push('}');
  return out.join('');
}

/** Tone rules for scores, gauges, and the verdict surface. */
function toneRules() {
  const out = [];
  for (const [key, value] of Object.entries(TONE)) {
    out.push(`.tone-${key}{--tone:${value.light}}`);
    out.push(`[data-theme="dark"] .tone-${key}{--tone:${value.dark}}`);
  }
  out.push('@media (prefers-color-scheme:dark){');
  for (const [key, value] of Object.entries(TONE)) {
    out.push(`:root:not([data-theme="light"]) .tone-${key}{--tone:${value.dark}}`);
  }
  out.push('}');
  return out.join('');
}

const LIGHT_TOKENS = `
  --bg:#f4f5f8;
  --bg-mesh-a:rgba(83,68,232,.10);
  --bg-mesh-b:rgba(11,165,236,.09);
  --bg-mesh-c:rgba(238,70,188,.06);
  --surface:rgba(255,255,255,.76);
  --surface-solid:#ffffff;
  --surface-raised:rgba(255,255,255,.92);
  --surface-sunken:rgba(16,24,40,.03);
  --border:rgba(16,24,40,.09);
  --border-strong:rgba(16,24,40,.16);
  --text:#0d1117;
  --text-soft:#3c4658;
  --text-muted:#667085;
  --accent:#5344e8;
  --accent-soft:rgba(83,68,232,.10);
  --accent-contrast:#ffffff;
  --shadow-sm:0 1px 2px rgba(16,24,40,.05);
  --shadow-md:0 4px 16px -4px rgba(16,24,40,.10),0 2px 4px -2px rgba(16,24,40,.05);
  --shadow-lg:0 20px 44px -12px rgba(16,24,40,.16);
  --code-bg:rgba(16,24,40,.05);
  --pre-bg:#10141c;
  --pre-fg:#dfe4ec;
  --glass-blur:saturate(180%) blur(18px);
`;

const DARK_TOKENS = `
  --bg:#080b12;
  --bg-mesh-a:rgba(83,68,232,.22);
  --bg-mesh-b:rgba(11,165,236,.16);
  --bg-mesh-c:rgba(238,70,188,.10);
  --surface:rgba(20,26,38,.68);
  --surface-solid:#111725;
  --surface-raised:rgba(28,35,50,.82);
  --surface-sunken:rgba(255,255,255,.035);
  --border:rgba(255,255,255,.10);
  --border-strong:rgba(255,255,255,.20);
  --text:#eef1f7;
  --text-soft:#b9c2d3;
  --text-muted:#8792a8;
  --accent:#9b8afb;
  --accent-soft:rgba(155,138,251,.16);
  --accent-contrast:#0b0e16;
  --shadow-sm:0 1px 2px rgba(0,0,0,.4);
  --shadow-md:0 8px 24px -8px rgba(0,0,0,.6);
  --shadow-lg:0 24px 56px -16px rgba(0,0,0,.7);
  --code-bg:rgba(255,255,255,.07);
  --pre-bg:#05070c;
  --pre-fg:#d5dcea;
  --glass-blur:saturate(150%) blur(18px);
`;

/** The complete stylesheet. */
export function stylesheet() {
  return `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:1.5rem}
:root{
${LIGHT_TOKENS}
  --radius-sm:8px;--radius:14px;--radius-lg:20px;
  --sp-1:.25rem;--sp-2:.5rem;--sp-3:.75rem;--sp-4:1rem;--sp-5:1.5rem;--sp-6:2rem;--sp-7:3rem;
  --font:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,"Helvetica Neue",Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
  --ease:cubic-bezier(.22,.61,.36,1);
  --sidebar-w:16rem;
  color-scheme:light dark;
}
[data-theme="dark"]{${DARK_TOKENS}}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${DARK_TOKENS}}}
${severityRules()}
${statusRules()}
${toneRules()}

body{
  margin:0;background:var(--bg);color:var(--text);
  font:400 15px/1.65 var(--font);letter-spacing:-.005em;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  text-rendering:optimizeLegibility;
}
/* A single painted mesh rather than three stacked elements: it is decorative, it
  must not intercept a click, and it must vanish for print. */
body::before{
  content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;
  background:
    radial-gradient(60rem 40rem at 12% -8%,var(--bg-mesh-a),transparent 60%),
    radial-gradient(50rem 36rem at 96% 4%,var(--bg-mesh-b),transparent 58%),
    radial-gradient(44rem 34rem at 50% 108%,var(--bg-mesh-c),transparent 62%);
}

/* ── Layout ─────────────────────────────────────────────────────────────── */
.shell{display:grid;grid-template-columns:var(--sidebar-w) minmax(0,1fr);gap:var(--sp-6);
  max-width:96rem;margin:0 auto;padding:var(--sp-5) var(--sp-5) var(--sp-7)}
.main{min-width:0}
.section{scroll-margin-top:1.5rem;margin-bottom:var(--sp-7)}
.section:last-child{margin-bottom:var(--sp-5)}

/* ── Sidebar ────────────────────────────────────────────────────────────── */
.sidebar{position:sticky;top:var(--sp-5);align-self:start;max-height:calc(100vh - 3rem);
  display:flex;flex-direction:column;gap:var(--sp-4);overflow:auto;padding-bottom:var(--sp-4)}
.sidebar-brand{display:flex;align-items:center;gap:.625rem;padding:0 .375rem}
.sidebar-mark{width:1.75rem;height:1.75rem;border-radius:9px;flex:none;
  background:linear-gradient(135deg,var(--accent),#0ba5ec);
  display:grid;place-items:center;color:#fff;font-weight:800;font-size:.75rem;letter-spacing:0}
.sidebar-name{font-weight:650;font-size:.875rem;letter-spacing:-.01em}
.sidebar-sub{font-size:.6875rem;color:var(--text-muted)}
nav.toc{display:flex;flex-direction:column;gap:1px}
nav.toc a{display:flex;align-items:center;justify-content:space-between;gap:.5rem;
  padding:.4375rem .625rem;border-radius:var(--radius-sm);color:var(--text-soft);
  text-decoration:none;font-size:.8125rem;font-weight:500;
  transition:background .16s var(--ease),color .16s var(--ease)}
nav.toc a:hover{background:var(--surface-sunken);color:var(--text)}
nav.toc a.active{background:var(--accent-soft);color:var(--accent);font-weight:600}
nav.toc .n{font-variant-numeric:tabular-nums;font-size:.6875rem;color:var(--text-muted);
  background:var(--surface-sunken);border-radius:20px;padding:.0625rem .375rem;min-width:1.375rem;text-align:center}
nav.toc a.active .n{background:transparent;color:inherit}

/* ── Glass surfaces ─────────────────────────────────────────────────────── */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  box-shadow:var(--shadow-sm);backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur)}
.card+.card{margin-top:var(--sp-3)}
.card-body{padding:var(--sp-5)}
.card-tight{padding:var(--sp-4)}

/* ── Masthead ───────────────────────────────────────────────────────────── */
.masthead{position:relative;overflow:hidden;border-radius:var(--radius-lg);
  border:1px solid var(--border);background:var(--surface-raised);
  backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);
  box-shadow:var(--shadow-md);padding:var(--sp-6);margin-bottom:var(--sp-5)}
.masthead::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(120deg,var(--accent-soft),transparent 42%)}
.masthead>*{position:relative;z-index:1}
.eyebrow{display:inline-flex;align-items:center;gap:.5rem;font-size:.6875rem;font-weight:700;
  letter-spacing:.1em;text-transform:uppercase;color:var(--accent)}
.eyebrow::before{content:"";width:.4375rem;height:.4375rem;border-radius:50%;background:currentColor;
  box-shadow:0 0 0 3px var(--accent-soft)}
h1{margin:.75rem 0 .5rem;font-size:clamp(1.75rem,3.4vw,2.75rem);line-height:1.08;
  letter-spacing:-.033em;font-weight:750}
.subject{color:var(--text-soft);font-size:1.0625rem;margin:0 0 var(--sp-4);max-width:56ch}
.subject a{color:var(--accent);text-decoration:none;border-bottom:1px solid var(--accent-soft)}
.subject a:hover{border-bottom-color:currentColor}
.factbar{display:flex;flex-wrap:wrap;gap:var(--sp-5) var(--sp-6);
  padding-top:var(--sp-4);border-top:1px solid var(--border)}
.fact{min-width:7rem}
.fact dt{font-size:.625rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;
  color:var(--text-muted);margin:0 0 .1875rem}
.fact dd{margin:0;font-size:.9375rem;font-weight:600;letter-spacing:-.01em}

/* ── Verdict ────────────────────────────────────────────────────────────── */
.verdict{display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-4);
  margin:var(--sp-5) 0 0;padding:var(--sp-4) var(--sp-5);border-radius:var(--radius);
  border:1px solid color-mix(in srgb,var(--tone) 38%,transparent);
  background:color-mix(in srgb,var(--tone) 10%,transparent)}
.verdict-label{display:flex;align-items:center;gap:.5rem;font-size:1.0625rem;font-weight:750;
  letter-spacing:-.015em;color:var(--tone)}
.verdict-dot{width:.625rem;height:.625rem;border-radius:50%;background:var(--tone);flex:none;
  box-shadow:0 0 0 4px color-mix(in srgb,var(--tone) 22%,transparent)}
.verdict-blurb{color:var(--text-soft);font-size:.9375rem;flex:1 1 16rem;min-width:0}
.verdict-confidence{font-size:.75rem;color:var(--text-muted);font-variant-numeric:tabular-nums}

/* ── KPI grid ───────────────────────────────────────────────────────────── */
.kpis{display:grid;gap:var(--sp-3);grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))}
.kpi{position:relative;overflow:hidden;padding:var(--sp-4);border-radius:var(--radius);
  border:1px solid var(--border);background:var(--surface);
  backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);
  transition:transform .18s var(--ease),box-shadow .18s var(--ease),border-color .18s var(--ease)}
.kpi:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);border-color:var(--border-strong)}
.kpi::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;
  background:var(--kpi-accent,var(--border-strong))}
.kpi.sev .kpi-n{color:var(--sev-solid)}
.kpi.sev{--kpi-accent:var(--sev-solid)}
.kpi.st .kpi-n{color:var(--st-solid)}
.kpi.st{--kpi-accent:var(--st-solid)}
.kpi-n{display:block;font-size:1.875rem;font-weight:750;line-height:1.05;letter-spacing:-.03em;
  font-variant-numeric:tabular-nums}
.kpi-l{display:block;margin-top:.25rem;font-size:.6875rem;font-weight:650;letter-spacing:.07em;
  text-transform:uppercase;color:var(--text-muted)}
.kpi-sub{display:block;margin-top:.1875rem;font-size:.75rem;color:var(--text-muted)}
.kpi-zero .kpi-n{color:var(--text-muted);opacity:.55}

/* ── Score gauges ───────────────────────────────────────────────────────── */
.scores{display:grid;gap:var(--sp-3);grid-template-columns:repeat(auto-fill,minmax(10rem,1fr))}
.score{display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-4);
  border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);
  backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur)}
.score svg{flex:none}
.score-l{font-size:.8125rem;font-weight:600}
.score-b{font-size:.6875rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em}

/* ── Headings ───────────────────────────────────────────────────────────── */
h2{margin:0 0 var(--sp-4);font-size:1.25rem;font-weight:700;letter-spacing:-.022em;
  display:flex;align-items:baseline;gap:.625rem;flex-wrap:wrap}
h2 .count{font-size:.75rem;font-weight:600;color:var(--text-muted);
  background:var(--surface-sunken);border:1px solid var(--border);
  border-radius:20px;padding:.125rem .5rem;letter-spacing:0}
h3{margin:0;font-size:1rem;font-weight:650;letter-spacing:-.014em;line-height:1.4}
h4{margin:0 0 var(--sp-2);font-size:.6875rem;font-weight:700;letter-spacing:.09em;
  text-transform:uppercase;color:var(--text-muted)}
.section-note{margin:calc(var(--sp-4) * -1 + .25rem) 0 var(--sp-4);color:var(--text-muted);
  font-size:.875rem;max-width:70ch}
p{margin:0 0 var(--sp-3);max-width:78ch}
p:last-child{margin-bottom:0}
a{color:var(--accent)}

/* ── Badges & chips ─────────────────────────────────────────────────────── */
.badge{display:inline-flex;align-items:center;gap:.3125rem;padding:.1875rem .5rem;
  border-radius:6px;font-size:.6875rem;font-weight:750;letter-spacing:.045em;
  text-transform:uppercase;white-space:nowrap;
  color:var(--sev-fg);background:var(--sev-bg);border:1px solid var(--sev-border)}
.badge::before{content:"";width:.375rem;height:.375rem;border-radius:50%;background:var(--sev-solid)}
.pill{display:inline-flex;align-items:center;gap:.3125rem;padding:.1875rem .5rem;border-radius:20px;
  font-size:.6875rem;font-weight:650;white-space:nowrap;
  color:var(--st-fg);background:var(--st-bg);border:1px solid transparent}
.chip{display:inline-flex;align-items:center;gap:.3125rem;padding:.1875rem .5rem;
  border-radius:6px;background:var(--surface-sunken);border:1px solid var(--border);
  color:var(--text-muted);font-size:.6875rem;font-weight:600;white-space:nowrap}

/* ── Toolbar ────────────────────────────────────────────────────────────── */
.toolbar{position:sticky;top:0;z-index:20;display:flex;flex-wrap:wrap;gap:var(--sp-2);
  align-items:center;margin-bottom:var(--sp-4);padding:var(--sp-3);
  border:1px solid var(--border);border-radius:var(--radius);background:var(--surface-raised);
  backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);box-shadow:var(--shadow-sm)}
.search{flex:1 1 14rem;min-width:0;display:flex;align-items:center;gap:.5rem;
  padding:.4375rem .625rem;border-radius:var(--radius-sm);
  border:1px solid var(--border);background:var(--surface-sunken)}
.search svg{flex:none;color:var(--text-muted)}
.search input{flex:1;min-width:0;border:0;background:transparent;color:inherit;
  font:inherit;font-size:.875rem;outline:none}
.search input::placeholder{color:var(--text-muted)}
.filters{display:flex;flex-wrap:wrap;gap:.25rem}
.filter{display:inline-flex;align-items:center;gap:.3125rem;padding:.3125rem .5625rem;
  border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-soft);
  font:inherit;font-size:.75rem;font-weight:600;cursor:pointer;
  transition:background .14s var(--ease),border-color .14s var(--ease),color .14s var(--ease)}
.filter:hover{border-color:var(--border-strong);background:var(--surface-sunken)}
.filter[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--accent-contrast)}
.filter .dot{width:.4375rem;height:.4375rem;border-radius:50%;background:var(--sev-solid,var(--text-muted))}
.filter[aria-pressed="true"] .dot{background:currentColor}
.iconbtn{display:inline-grid;place-items:center;width:2rem;height:2rem;flex:none;
  border-radius:var(--radius-sm);border:1px solid var(--border);background:transparent;
  color:var(--text-soft);cursor:pointer;transition:background .14s var(--ease),color .14s var(--ease)}
.iconbtn:hover{background:var(--surface-sunken);color:var(--text)}
.match-count{font-size:.75rem;color:var(--text-muted);font-variant-numeric:tabular-nums;
  margin-left:auto;padding-left:.5rem}

/* ── Findings ───────────────────────────────────────────────────────────── */
.finding{border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);
  backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);
  margin-bottom:var(--sp-3);overflow:hidden;scroll-margin-top:5rem;
  transition:border-color .18s var(--ease),box-shadow .18s var(--ease)}
.finding:hover{border-color:var(--border-strong)}
.finding[open]{box-shadow:var(--shadow-md);border-color:var(--border-strong)}
.finding[hidden]{display:none}
.finding>summary{display:flex;align-items:flex-start;gap:var(--sp-3);padding:var(--sp-4);
  cursor:pointer;list-style:none;user-select:none}
.finding>summary::-webkit-details-marker{display:none}
.finding>summary:focus-visible{outline:2px solid var(--accent);outline-offset:-2px;border-radius:var(--radius)}
.finding-grow{flex:1;min-width:0}
.finding-title{display:block;font-size:1rem;font-weight:650;letter-spacing:-.014em;line-height:1.4}
.finding-meta{display:flex;flex-wrap:wrap;align-items:center;gap:.375rem;margin-top:.4375rem}
.finding-id{font-family:var(--mono);font-size:.6875rem;color:var(--text-muted);letter-spacing:0}
.caret{flex:none;margin-top:.1875rem;color:var(--text-muted);transition:transform .2s var(--ease)}
.finding[open] .caret{transform:rotate(90deg)}
.finding-body{padding:0 var(--sp-4) var(--sp-4);border-top:1px solid var(--border)}
.finding-body>*:first-child{margin-top:var(--sp-4)}

.behaviour{margin:0;display:grid;grid-template-columns:minmax(7.5rem,auto) minmax(0,1fr);
  gap:var(--sp-3) var(--sp-5)}
.behaviour dt{font-size:.625rem;font-weight:750;letter-spacing:.09em;text-transform:uppercase;
  color:var(--text-muted);padding-top:.1875rem}
.behaviour dd{margin:0;min-width:0}
.rail{border-left:2px solid var(--rail,var(--border-strong));padding-left:var(--sp-3)}
.rail-now{--rail:var(--tone-bad,#f04438)}
.rail-want{--rail:#17b26a}
.rail-fix{--rail:var(--accent)}
.rail-impact{--rail:#f79009}
.rail-cause{--rail:#0ba5ec}
[data-theme="dark"] .rail-now{--rail:#f97066}
[data-theme="dark"] .rail-want{--rail:#47cd89}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]) .rail-now{--rail:#f97066}
  :root:not([data-theme="light"]) .rail-want{--rail:#47cd89}
}
ol.steps,ol.chain{margin:0;padding-left:1.25rem}
ol.steps li,ol.chain li{margin:.1875rem 0}
ol.chain li::marker{color:var(--text-muted);font-variant-numeric:tabular-nums}
ul.clean{margin:0;padding-left:1.125rem}
ul.clean li{margin:.25rem 0}
.subgrid{display:grid;gap:var(--sp-3);grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));
  margin-top:var(--sp-4)}
.panel{border:1px solid var(--border);border-radius:var(--radius-sm);padding:var(--sp-3);
  background:var(--surface-sunken)}
.panel p{font-size:.875rem}

/* ── Tables ─────────────────────────────────────────────────────────────── */
.table-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius);
  background:var(--surface);backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur)}
table{border-collapse:collapse;width:100%;font-size:.8125rem;min-width:26rem}
th,td{text-align:left;padding:.625rem .75rem;border-bottom:1px solid var(--border);vertical-align:top}
th{font-size:.625rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);
  font-weight:750;background:var(--surface-sunken);position:sticky;top:0;white-space:nowrap}
tbody tr:last-child td{border-bottom:0}
tbody tr{transition:background .12s var(--ease)}
tbody tr:hover{background:var(--surface-sunken)}
td.num{text-align:right;font-variant-numeric:tabular-nums}
tr[hidden]{display:none}
.bar-cell{min-width:8rem}
.bar{height:.375rem;border-radius:3px;background:var(--surface-sunken);overflow:hidden}
.bar>span{display:block;height:100%;border-radius:3px;background:var(--bar,var(--accent))}

code{font-family:var(--mono);font-size:.8125em;background:var(--code-bg);
  padding:.0625rem .3125rem;border-radius:5px;word-break:break-word}
pre{margin:0;background:var(--pre-bg);color:var(--pre-fg);padding:var(--sp-4);
  border-radius:var(--radius-sm);overflow-x:auto;font:.75rem/1.6 var(--mono);
  border:1px solid var(--border)}
pre code{background:none;padding:0;font-size:inherit;color:inherit}

/* ── Charts ─────────────────────────────────────────────────────────────── */
.chart-grid{display:grid;gap:var(--sp-3);grid-template-columns:repeat(auto-fit,minmax(18rem,1fr))}
.chart{padding:var(--sp-4);border:1px solid var(--border);border-radius:var(--radius);
  background:var(--surface);backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur)}
.chart h4{margin-bottom:var(--sp-3)}
.chart svg{display:block;width:100%;height:auto;overflow:visible}
.legend{display:flex;flex-wrap:wrap;gap:.5rem .875rem;margin-top:var(--sp-3);font-size:.75rem}
.legend span{display:inline-flex;align-items:center;gap:.375rem;color:var(--text-soft)}
.legend i{width:.625rem;height:.625rem;border-radius:3px;flex:none}
.legend b{font-weight:650;font-variant-numeric:tabular-nums;color:var(--text)}
.axis{font-size:10px;fill:var(--text-muted)}
.gridline{stroke:var(--border);stroke-width:1}

/* ── Timeline ───────────────────────────────────────────────────────────── */
.timeline{position:relative;margin:0;padding:0 0 0 1.375rem;list-style:none}
.timeline::before{content:"";position:absolute;left:.3125rem;top:.375rem;bottom:.375rem;width:2px;
  background:linear-gradient(180deg,var(--accent),transparent)}
.timeline li{position:relative;padding:0 0 var(--sp-4)}
.timeline li:last-child{padding-bottom:0}
.timeline li::before{content:"";position:absolute;left:-1.375rem;top:.4375rem;width:.75rem;height:.75rem;
  border-radius:50%;background:var(--surface-solid);border:2px solid var(--tl,var(--accent))}
.tl-ok{--tl:#17b26a}.tl-warned{--tl:#f79009}.tl-failed{--tl:#f04438}.tl-skipped{--tl:#98a2b3}
.tl-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:.5rem}
.tl-label{font-weight:600;font-size:.9375rem}
.tl-dur{font-size:.75rem;color:var(--text-muted);font-variant-numeric:tabular-nums}
.tl-detail{font-size:.8125rem;color:var(--text-muted);margin-top:.125rem}

/* ── Evidence ───────────────────────────────────────────────────────────── */
.evidence{display:grid;gap:var(--sp-3);grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));
  margin-top:var(--sp-4)}
figure.shot{margin:0;border:1px solid var(--border);border-radius:var(--radius-sm);
  overflow:hidden;background:var(--surface-sunken)}
figure.shot img,figure.shot video{display:block;width:100%;height:auto;background:var(--surface-sunken)}
figure.shot img{cursor:zoom-in;transition:opacity .16s var(--ease)}
figure.shot img:hover{opacity:.92}
figcaption{padding:.5rem .625rem;font-size:.6875rem;color:var(--text-muted);
  border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:.375rem;align-items:center}
figcaption .name{font-weight:650;color:var(--text-soft)}
figcaption code{font-size:.6875rem}
.shot-actions{margin-left:auto;display:flex;gap:.375rem}
.shot-actions a{font-size:.6875rem;font-weight:650;text-decoration:none;color:var(--accent)}
.shot-actions a:hover{text-decoration:underline}
/* The whole reason this module exists: a file that is not there is stated, never
  left to a browser's broken-image glyph. */
.artifact-missing{display:flex;align-items:flex-start;gap:.625rem;padding:var(--sp-4);
  border:1px dashed var(--border-strong);border-radius:var(--radius-sm);
  background:var(--surface-sunken);color:var(--text-muted);font-size:.8125rem}
.artifact-missing svg{flex:none;margin-top:.125rem;opacity:.7}
.artifact-missing .why{display:block;font-weight:650;color:var(--text-soft);margin-bottom:.125rem}
.artifact-missing code{font-size:.6875rem}
.compare{display:grid;gap:var(--sp-2);grid-template-columns:1fr 1fr;align-items:start}
.compare figcaption .name::before{content:attr(data-side) " · ";color:var(--accent)}

/* ── Lightbox ───────────────────────────────────────────────────────────── */
.lightbox{position:fixed;inset:0;z-index:100;display:none;place-items:center;
  padding:var(--sp-5);background:rgba(6,9,14,.86);backdrop-filter:blur(8px)}
.lightbox[open],.lightbox.on{display:grid}
.lightbox img{max-width:100%;max-height:86vh;border-radius:var(--radius);
  box-shadow:var(--shadow-lg);cursor:zoom-out;transition:transform .2s var(--ease);transform-origin:center}
.lightbox.zoomed img{cursor:move;transform:scale(2)}
.lightbox-bar{position:absolute;top:var(--sp-4);left:var(--sp-5);right:var(--sp-5);
  display:flex;align-items:center;gap:var(--sp-3);color:#e8ecf4;font-size:.8125rem}
.lightbox-bar .grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lightbox-bar button,.lightbox-bar a{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);
  color:#fff;border-radius:var(--radius-sm);padding:.3125rem .625rem;font:inherit;font-size:.75rem;
  font-weight:600;cursor:pointer;text-decoration:none}
.lightbox-bar button:hover,.lightbox-bar a:hover{background:rgba(255,255,255,.2)}

/* ── Misc ───────────────────────────────────────────────────────────────── */
.empty{color:var(--text-muted);font-style:italic}
.muted{color:var(--text-muted)}
.tabular{font-variant-numeric:tabular-nums}
.no-results{display:none;padding:var(--sp-6);text-align:center;color:var(--text-muted)}
.no-results.on{display:block}
.skip{position:absolute;left:-9999px;top:0;padding:.5rem .875rem;background:var(--accent);
  color:var(--accent-contrast);border-radius:0 0 var(--radius-sm) 0;z-index:200;font-weight:650}
.skip:focus{left:0}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
.qa-pack-attribution{margin-top:var(--sp-6)}

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width:72rem){
  .shell{grid-template-columns:1fr;gap:var(--sp-4);padding:var(--sp-4)}
  .sidebar{position:static;max-height:none;flex-direction:row;flex-wrap:wrap;align-items:center;
    gap:var(--sp-3);padding:var(--sp-3);border:1px solid var(--border);
    border-radius:var(--radius);background:var(--surface)}
  nav.toc{flex-direction:row;flex-wrap:wrap;gap:.25rem}
  nav.toc .n{display:none}
  .sidebar-sub{display:none}
}
@media (max-width:40rem){
  .shell{padding:var(--sp-3)}
  .masthead{padding:var(--sp-4);border-radius:var(--radius)}
  .card-body{padding:var(--sp-4)}
  .behaviour{grid-template-columns:1fr;gap:.375rem}
  .behaviour dt{padding-top:.625rem}
  .kpis{grid-template-columns:repeat(auto-fill,minmax(7.5rem,1fr))}
  .evidence,.compare{grid-template-columns:1fr}
  .factbar{gap:var(--sp-4)}
  .toolbar{position:static}
}

/* ── Motion ─────────────────────────────────────────────────────────────── */
@media (prefers-reduced-motion:no-preference){
  .reveal{opacity:0;transform:translateY(8px);animation:rise .5s var(--ease) forwards}
  @keyframes rise{to{opacity:1;transform:none}}
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.001ms !important;animation-iteration-count:1 !important;
    transition-duration:.001ms !important;scroll-behavior:auto !important}
}

/* ── Print ──────────────────────────────────────────────────────────────── */
@media print{
  @page{margin:14mm}
  html{scroll-behavior:auto}
  body{background:#fff;color:#000;font-size:10.5pt}
  body::before,.sidebar,.toolbar,.lightbox,.skip,.shot-actions,.caret{display:none !important}
  .shell{display:block;max-width:none;padding:0}
  .card,.finding,.chart,.kpi,.masthead,.score,.table-wrap{
    background:#fff !important;box-shadow:none !important;backdrop-filter:none !important;
    -webkit-backdrop-filter:none !important;border-color:#d0d5dd !important;break-inside:avoid}
  .masthead::after{display:none}
  /* Collapsed findings print as headings with no content, which is how a printed
    report loses the half of itself that matters. */
  .finding>.finding-body{display:block !important}
  .finding{break-inside:avoid}
  .section{break-before:auto;margin-bottom:1.25rem}
  h1{font-size:22pt}h2{font-size:13pt;break-after:avoid}h3{font-size:11pt;break-after:avoid}
  .reveal{opacity:1 !important;transform:none !important;animation:none !important}
  figure.shot img{max-height:9cm;object-fit:contain}
  /* A printed link that only says "here" is a dead end. */
  .subject a[href]::after{content:" (" attr(href) ")";font-size:8pt;color:#475467;word-break:break-all}
  thead{display:table-header-group}
  tr,img,figure{break-inside:avoid}
}
`.trim();
}
