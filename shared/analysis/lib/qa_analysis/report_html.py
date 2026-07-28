"""Render a contract artifact as a presentation-grade HTML report.

## Why this is code

The first real `/qa-explore` run on a live application produced a valid artifact
and a *lossy* report. Every finding in the contract carries `repro`, `actual`,
`expected`, and `fixDirection` — all four required fields — and the hand-written
HTML collapsed them into a single sentence:

    EXP-1 · high — Double-click Login fires two GraphQL auth requests
    Two identical POSTs to /graphql. Disable Login while in flight.

The reader is left to infer what was expected, how to reproduce it, and what
"correct" would look like. The data existed; the rendering discarded it. It also
omitted the attribution footer entirely.

Both failures share one cause: the report was *typed* rather than *rendered*. So
it is rendered here. The contract is the input, every required field appears in
the output, and the footer is not optional. A report cannot silently drop what a
reader needs, because no one is retyping it.

## What it renders

`explore-result` and `report-result` today — the two artifacts a human reads. Each
finding becomes a card stating, in order: what is wrong, **what happens now**,
**what should happen instead**, how to reproduce it, and the fix direction. That
ordering is deliberate: a reader who stops after two lines still knows the defect
and the gap.

Standard library only, single self-contained file, no external assets — a report
must open from an email attachment on a plane.
"""

import html
import json
import re

from . import branding

# Severity drives colour, order, and the summary bar. Kept here rather than in the
# template so a new severity cannot render as an unstyled surprise.
_SEVERITY = {
    "critical": {"label": "Critical", "colour": "#8b0018", "tint": "#fdf0f2", "rank": 0},
    "high": {"label": "High", "colour": "#b3261e", "tint": "#fdf1f0", "rank": 1},
    "medium": {"label": "Medium", "colour": "#a15c00", "tint": "#fdf6ec", "rank": 2},
    "low": {"label": "Low", "colour": "#4a5568", "tint": "#f4f5f7", "rank": 3},
}

# Summary tiles for non-severity counts. Test totals are not severities, and
# rendering "failed" in the same neutral grey as "passed" is how a reader misses
# the number that matters.
_COUNT_STYLE = {
    "total": "#344054",
    "passed": "#116149",
    "failed": "#b3261e",
    "blocked": "#a15c00",
    "skipped": "#667085",
}

# What each evidence kind is called in the report. The contract guarantees `type`
# on every entry but `description` only on the top-level index, so the type is
# what a caption can always be built from.
_EVIDENCE_LABEL = {
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
}

_STATUS_LABEL = {
    "confirmed": "Confirmed",
    "validated-user-report": "Validated user report",
    "could-not-reproduce": "Could not reproduce",
    "partial": "Partially reproduced",
    "pass": "Passed",
    "fail": "Failed",
    "blocked": "Blocked",
    "skipped": "Skipped",
}

_VERDICT = {
    "pass": ("No defects found", "#116149", "#eaf7f1"),
    "issues-found": ("Issues found", "#a15c00", "#fdf6ec"),
    "blocked": ("Blocked", "#b3261e", "#fdf1f0"),
    "insufficient-data": ("Insufficient data", "#4a5568", "#f4f5f7"),
    "ready": ("Ready to ship", "#116149", "#eaf7f1"),
    "ready-with-risks": ("Ready with risks", "#a15c00", "#fdf6ec"),
    "not-ready": ("Not ready", "#b3261e", "#fdf1f0"),
}


class ReportError(ValueError):
    """Raised when an artifact cannot be rendered as a report."""


def _e(value):
    """Escape for HTML text and attribute contexts."""
    return html.escape("" if value is None else str(value), quote=True)


_CSS = """
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:#f7f8fa;color:#1a1d21;
  font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased}
.page{max-width:60rem;margin:0 auto;padding:2.5rem 1.5rem 3rem}
.card{background:#fff;border:1px solid #e4e7ec;border-radius:12px;
  box-shadow:0 1px 2px rgba(16,24,40,.04);margin-bottom:1.25rem;overflow:hidden}
.card-body{padding:1.5rem}
header.masthead{margin-bottom:1.75rem}
.eyebrow{font-size:.6875rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#667085}
h1{margin:.35rem 0 .5rem;font-size:1.875rem;line-height:1.25;letter-spacing:-.02em}
h2{margin:2rem 0 .875rem;font-size:1.125rem;letter-spacing:-.01em}
h3{margin:0;font-size:1.0625rem;letter-spacing:-.01em}
.meta{color:#667085;font-size:.8125rem}
.meta strong{color:#344054;font-weight:600}
.lead{margin:0 0 .25rem;font-size:1.0625rem;color:#475467;max-width:52rem}
.verdict{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;
  padding:1rem 1.25rem;border-radius:10px;font-weight:600;margin:1.25rem 0}
.counts{display:flex;flex-wrap:wrap;gap:.5rem;margin:1.25rem 0}
.count{flex:1 1 7rem;background:#fff;border:1px solid #e4e7ec;border-radius:10px;
  padding:.75rem .875rem;text-align:center}
.count .n{display:block;font-size:1.5rem;font-weight:700;line-height:1.2}
.count .l{font-size:.6875rem;text-transform:uppercase;letter-spacing:.07em;color:#667085}
.badge{display:inline-block;padding:.1875rem .5rem;border-radius:6px;
  font-size:.6875rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
  border:1px solid currentColor}
.chip{display:inline-block;padding:.1875rem .5rem;border-radius:6px;background:#f2f4f7;
  color:#475467;font-size:.75rem;font-weight:500}
.finding-head{display:flex;gap:.75rem;align-items:flex-start;
  padding:1.125rem 1.5rem;border-bottom:1px solid #eef0f3}
.finding-head .grow{flex:1;min-width:0}
.finding-id{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.75rem;color:#667085}
dl.behaviour{margin:0;display:grid;grid-template-columns:minmax(8.5rem,auto) 1fr;gap:.625rem 1.25rem}
dl.behaviour dt{font-size:.75rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#667085;padding-top:.15rem}
dl.behaviour dd{margin:0}
.now{border-left:3px solid #b3261e;padding-left:.75rem}
.want{border-left:3px solid #116149;padding-left:.75rem}
.fix{border-left:3px solid #3538cd;padding-left:.75rem}
table{border-collapse:collapse;width:100%;font-size:.875rem}
th,td{text-align:left;padding:.5625rem .75rem;border-bottom:1px solid #eef0f3;vertical-align:top}
th{font-size:.6875rem;text-transform:uppercase;letter-spacing:.06em;color:#667085;
  background:#fafbfc;font-weight:700}
tbody tr:last-child td{border-bottom:0}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.875em;
  background:#f2f4f7;padding:.1rem .3rem;border-radius:4px}
pre{margin:0;background:#1a1d21;color:#e4e7ec;padding:1rem;border-radius:8px;
  overflow-x:auto;font-size:.8125rem;line-height:1.55}
figure{margin:.875rem 0 0}
figure img{display:block;max-width:100%;height:auto;border:1px solid #e4e7ec;border-radius:8px}
figcaption{margin-top:.4rem;font-size:.75rem;color:#667085}
ul.clean{margin:0;padding-left:1.125rem}
ul.clean li{margin:.3rem 0}
ol.steps{margin:0;padding-left:1.25rem}
ol.steps li{margin:.15rem 0}
ol.order{margin:0;padding-left:1.25rem}
ol.order li{margin:.4rem 0}
.empty{color:#667085;font-style:italic}
@media print{body{background:#fff}.card{box-shadow:none;break-inside:avoid}.page{padding:0}}
@media (max-width:34rem){dl.behaviour{grid-template-columns:1fr;gap:.25rem}
  dl.behaviour dt{padding-top:.5rem}}
"""


def _severity_badge(severity):
    meta = _SEVERITY.get(severity, _SEVERITY["low"])
    return (
        f'<span class="badge" style="color:{meta["colour"]};background:{meta["tint"]}">'
        f'{_e(meta["label"])}</span>'
    )


def _subject(result):
    """What the report is about, short enough to be a heading.

    The contract has no title field, and the summary is a paragraph — using it as
    an `<h1>` produced a five-line heading. The target under test is the honest
    short answer, the way Lighthouse titles a report by its URL.
    """
    url = str(result.get("url") or "").strip()
    if url:
        return url.split("://", 1)[-1].rstrip("/") or url
    return str(result.get("summary") or "QA report").split(".")[0][:80]


def _repro_steps(repro):
    """Reproduction as steps when it is written as steps, as prose otherwise.

    Numbered steps are the part of a report a reader retypes into a browser, so
    they are rendered as a list rather than one dense line. The split is on the
    text's own numbering — nothing is invented, reordered, or dropped.
    """
    text = str(repro or "").strip()
    if not text:
        return '<dd class="empty">Not recorded</dd>'
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) == 1:
        lines = [part.strip() for part in re.split(r"\s+(?=\d+[.)]\s)", text) if part.strip()]
    steps = [re.sub(r"^\d+[.)]\s*", "", line) for line in lines]
    if len(steps) < 2 or not all(re.match(r"^\d+[.)]\s", line) for line in lines):
        return f"<dd>{_e(text)}</dd>"
    items = "".join(f"<li>{_e(step)}</li>" for step in steps)
    return f'<dd><ol class="steps">{items}</ol></dd>'


def _natural(identifier):
    """Sort TC-2 before TC-10, the way a reader expects a case list to run."""
    return [
        int(part) if part.isdigit() else part.lower()
        for part in re.split(r"(\d+)", str(identifier or ""))
    ]


def _anchor(finding_id):
    """A stable in-document id, so a failing test case can link to its finding."""
    safe = "".join(c if (c.isalnum() or c in "-_") else "-" for c in str(finding_id or ""))
    return f"f-{safe}" if safe else ""


def _is_image(item):
    source = str(item.get("source", "")).lower()
    return item.get("type") == "screenshot" or source.endswith(
        (".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif")
    )


def _evidence_caption(item):
    """A caption that is always meaningful.

    Finding-level evidence carries only `type` and `source` — `description` is
    required on the top-level index, not here — so the type label is the fallback
    rather than repeating the filename twice.
    """
    described = item.get("description")
    label = _EVIDENCE_LABEL.get(item.get("type"), item.get("type") or "Evidence")
    return f"{_e(described)} — {_e(label)}" if described else _e(label)


def _evidence_figures(items, indent="    "):
    parts = []
    for item in items or []:
        source = item.get("source", "")
        caption = _evidence_caption(item)
        parts.append(f"{indent}<figure>")
        if _is_image(item):
            parts.append(f'{indent}  <img src="{_e(source)}" alt="{caption}"/>')
        elif item.get("excerpt"):
            parts.append(f'{indent}  <pre>{_e(item["excerpt"])}</pre>')
        parts.append(f'{indent}  <figcaption>{caption} · <code>{_e(source)}</code></figcaption>')
        parts.append(f"{indent}</figure>")
    return parts


def _finding_card(finding):
    """One finding: the defect, then what happens now, then what should happen.

    Ordering is the point. `actual` and `expected` are required by the contract and
    are the two things a reader cannot reconstruct for themselves, so they come
    before reproduction and fix direction.
    """
    parts = [
        f'<article class="card" id="{_anchor(finding.get("id"))}">',
        '  <div class="finding-head">',
        f'    {_severity_badge(finding.get("severity"))}',
        '    <div class="grow">',
        f'      <h3>{_e(finding.get("title"))}</h3>',
        f'      <div class="finding-id">{_e(finding.get("id"))}</div>',
        '    </div>',
        f'    <span class="chip">{_e(finding.get("dimension", ""))}</span>',
        f'    <span class="chip">{_e(_STATUS_LABEL.get(finding.get("status"), finding.get("status", "")))}</span>',
        '  </div>',
        '  <div class="card-body">',
        '    <dl class="behaviour">',
        '      <dt>Current behaviour</dt>',
        f'      <dd class="now">{_e(finding.get("actual"))}</dd>',
        '      <dt>Expected behaviour</dt>',
        f'      <dd class="want">{_e(finding.get("expected"))}</dd>',
        '      <dt>Reproduction</dt>',
        f'      {_repro_steps(finding.get("repro"))}',
        '      <dt>Fix direction</dt>',
        f'      <dd class="fix">{_e(finding.get("fixDirection"))}</dd>',
        '    </dl>',
    ]
    parts += _evidence_figures(finding.get("evidence"))
    parts += ['  </div>', '</article>']
    return "\n".join(parts)


def _counts_block(counts, order):
    cells = []
    for key in order:
        if key not in counts:
            continue
        label = _SEVERITY.get(key, {}).get("label", key.replace("-", " ").title())
        colour = _SEVERITY.get(key, {}).get("colour") or _COUNT_STYLE.get(key, "#1a1d21")
        value = counts[key]
        cells.append(
            f'<div class="count"><span class="n" style="color:{colour}">{_e(value)}</span>'
            f'<span class="l">{_e(label)}</span></div>'
        )
    return f'<div class="counts">{"".join(cells)}</div>' if cells else ""


def _test_case_table(test_cases, finding_ids=()):
    """Executed cases, worst first, each failure linked to the finding it raised.

    A reader who starts from "which case failed?" should reach the explanation in
    one click, so `findingId` becomes a link into the finding card rather than a
    bare string they have to search for.
    """
    cases = test_cases.get("cases") or []
    if not cases:
        return ""
    order = {"fail": 0, "blocked": 1, "skipped": 2, "pass": 3}
    rows = []
    for case in sorted(cases, key=lambda c: (order.get(c.get("status"), 4), _natural(c.get("id")))):
        status = case.get("status", "")
        colour = _COUNT_STYLE.get({"fail": "failed", "pass": "passed"}.get(status, status), "#475467")
        finding_id = case.get("findingId")
        if finding_id and finding_id in finding_ids:
            link = f'<a href="#{_anchor(finding_id)}"><code>{_e(finding_id)}</code></a>'
        elif finding_id:
            link = f"<code>{_e(finding_id)}</code>"
        else:
            link = '<span class="empty">—</span>'
        rows.append(
            "<tr>"
            f'<td><code>{_e(case.get("id"))}</code></td>'
            f'<td>{_e(case.get("title"))}</td>'
            f'<td style="color:{colour};font-weight:600">'
            f'{_e(_STATUS_LABEL.get(status, status))}</td>'
            f"<td>{link}</td>"
            "</tr>"
        )
    return (
        '<div class="card"><table><thead><tr><th>ID</th><th>Test case</th>'
        "<th>Result</th><th>Finding</th></tr></thead><tbody>"
        + "".join(rows)
        + "</tbody></table></div>"
    )


def _evidence_index(evidence):
    """The run's evidence, listed once with its descriptions.

    The contract requires this array and the hand-written report reduced it to a
    line of prose, so a reader could not tell what proof the run actually holds.
    """
    if not evidence:
        return ""
    rows = "".join(
        "<tr>"
        f'<td>{_e(_EVIDENCE_LABEL.get(item.get("type"), item.get("type", "")))}</td>'
        f'<td>{_e(item.get("description", ""))}</td>'
        f'<td><code>{_e(item.get("source"))}</code></td>'
        "</tr>"
        for item in evidence
    )
    return (
        '<div class="card"><table><thead><tr><th>Kind</th><th>Shows</th>'
        f"<th>File</th></tr></thead><tbody>{rows}</tbody></table></div>"
    )


def render_explore(result):
    """Render an explore-result artifact."""
    findings = sorted(
        result.get("findings") or [],
        key=lambda f: _SEVERITY.get(f.get("severity"), _SEVERITY["low"])["rank"],
    )
    verdict_label, verdict_colour, verdict_tint = _VERDICT.get(
        result.get("classification"), ("Reported", "#4a5568", "#f4f5f7")
    )

    meta_bits = []
    if result.get("url"):
        meta_bits.append(f'<strong>Target</strong> <code>{_e(result["url"])}</code>')
    if result.get("generatedAt"):
        meta_bits.append(f'<strong>Generated</strong> {_e(result["generatedAt"])}')
    if result.get("browserAdapter"):
        meta_bits.append(f'<strong>Browser</strong> {_e(result["browserAdapter"])}')
    if result.get("dimensionsRun"):
        meta_bits.append(f'<strong>Dimensions</strong> {_e(", ".join(result["dimensionsRun"]))}')
    if result.get("reportVersion"):
        meta_bits.append(f'<strong>Report</strong> v{_e(result["reportVersion"])}')

    body = [
        '<header class="masthead">',
        '  <div class="eyebrow">Exploratory QA report</div>',
        f'  <h1>{_e(_subject(result))}</h1>',
        f'  <p class="meta">{" &middot; ".join(meta_bits)}</p>',
        '</header>',
        f'<p class="lead">{_e(result.get("summary", ""))}</p>',
        f'<div class="verdict" style="color:{verdict_colour};background:{verdict_tint}">'
        f'{_e(verdict_label)}</div>',
    ]

    counts = result.get("severityCounts") or {}
    body.append(_counts_block(counts, ["critical", "high", "medium", "low"]))

    tests = result.get("testCases") or {}
    if tests:
        body.append(
            _counts_block(
                {k: tests[k] for k in ("total", "passed", "failed", "blocked", "skipped") if k in tests},
                ["total", "passed", "failed", "blocked", "skipped"],
            )
        )

    body.append("<h2>Findings</h2>")
    if findings:
        body.extend(_finding_card(f) for f in findings)
    else:
        body.append('<div class="card"><div class="card-body empty">No findings recorded.</div></div>')

    if tests.get("cases"):
        body.append("<h2>Test case coverage</h2>")
        body.append(_test_case_table(tests, {f.get("id") for f in findings}))

    db = result.get("dbValidation") or {}
    if db.get("summary") or db.get("inScope") is not None:
        body.append("<h2>Data validation</h2>")
        note = db.get("summary") or (
            "In scope." if db.get("inScope") else "Not in scope for this run."
        )
        body.append(f'<div class="card"><div class="card-body">{_e(note)}</div></div>')
    if db.get("comparisons"):
        if not (db.get("summary") or db.get("inScope") is not None):
            body.append("<h2>Data validation</h2>")
        rows = "".join(
            "<tr>"
            f'<td>{_e(c.get("metric"))}</td><td><code>{_e(c.get("uiValue"))}</code></td>'
            f'<td><code>{_e(c.get("sourceValue"))}</code></td>'
            f'<td style="color:{"#116149" if c.get("match") else "#b3261e"};font-weight:600">'
            f'{"Match" if c.get("match") else "Mismatch"}</td></tr>'
            for c in db["comparisons"]
        )
        body.append(
            '<div class="card"><table><thead><tr><th>Metric</th><th>Shown in UI</th>'
            f"<th>Source of truth</th><th>Result</th></tr></thead><tbody>{rows}</tbody></table></div>"
        )

    if result.get("fixOrder"):
        body.append("<h2>Suggested fix order</h2>")
        items = "".join(f"<li>{_e(x)}</li>" for x in result["fixOrder"])
        body.append(f'<div class="card"><div class="card-body"><ol class="order">{items}</ol></div></div>')

    if result.get("recommendations"):
        body.append("<h2>Recommendations</h2>")
        rows = "".join(
            f'<tr><td>{_e(r.get("action"))}</td><td>{_e(r.get("priority"))}</td></tr>'
            for r in result["recommendations"]
        )
        body.append(
            '<div class="card"><table><thead><tr><th>Action</th><th>Priority</th></tr>'
            f"</thead><tbody>{rows}</tbody></table></div>"
        )

    if result.get("whatWorksWell"):
        body.append("<h2>Verified working</h2>")
        items = "".join(f"<li>{_e(x)}</li>" for x in result["whatWorksWell"])
        body.append(f'<div class="card"><div class="card-body"><ul class="clean">{items}</ul></div></div>')

    if result.get("evidence"):
        body.append("<h2>Evidence index</h2>")
        body.append(_evidence_index(result["evidence"]))

    return "\n".join(body)


def render_report(result):
    """Render a report-result artifact (qa-report's release rollup)."""
    verdict = (result.get("releaseReadiness") or {}).get("verdict", result.get("classification"))
    label, colour, tint = _VERDICT.get(verdict, ("Reported", "#4a5568", "#f4f5f7"))
    summaries = result.get("summaries") or {}

    body = [
        '<header class="masthead">',
        '  <div class="eyebrow">Release readiness report</div>',
        f'  <h1>{_e(_subject(result))}</h1>',
        f'  <p class="meta"><strong>Generated</strong> {_e(result.get("generatedAt", ""))}</p>',
        '</header>',
        f'<p class="lead">{_e(result.get("summary", ""))}</p>',
        f'<div class="verdict" style="color:{colour};background:{tint}">{_e(label)}</div>',
    ]
    rationale = (result.get("releaseReadiness") or {}).get("rationale")
    if rationale:
        body.append(f'<div class="card"><div class="card-body">{_e(rationale)}</div></div>')

    tests = result.get("testSummary") or {}
    body.append(
        _counts_block(
            {k: tests[k] for k in ("total", "passed", "failed", "skipped") if k in tests},
            ["total", "passed", "failed", "skipped"],
        )
    )

    for key, heading in (("executive", "Executive summary"), ("engineering", "Engineering summary")):
        if summaries.get(key):
            body.append(f"<h2>{heading}</h2>")
            body.append(f'<div class="card"><div class="card-body">{_e(summaries[key])}</div></div>')

    if result.get("failureSummary"):
        body.append("<h2>Failures</h2>")
        rows = "".join(
            f'<tr><td>{_e(f.get("test"))}</td><td>{_e(f.get("classification"))}</td>'
            f'<td>{_e(f.get("reason"))}</td></tr>'
            for f in result["failureSummary"]
        )
        body.append(
            '<div class="card"><table><thead><tr><th>Test</th><th>Classification</th>'
            f"<th>Reason</th></tr></thead><tbody>{rows}</tbody></table></div>"
        )

    if result.get("recommendations"):
        body.append("<h2>Recommendations</h2>")
        rows = "".join(
            f'<tr><td>{_e(r.get("action"))}</td><td>{_e(r.get("priority"))}</td></tr>'
            for r in result["recommendations"]
        )
        body.append(
            '<div class="card"><table><thead><tr><th>Action</th><th>Priority</th></tr>'
            f"</thead><tbody>{rows}</tbody></table></div>"
        )

    return "\n".join(body)


_RENDERERS = {
    "qa-explore/explore-result": render_explore,
    "qa-report/report-result": render_report,
}


def render(result, title=None):
    """Render a full standalone HTML document for a supported artifact."""
    contract = (result.get("contract") or {}).get("name")
    renderer = _RENDERERS.get(contract)
    if renderer is None:
        raise ReportError(
            f"no HTML renderer for contract {contract!r}; supported: "
            + ", ".join(sorted(_RENDERERS))
        )

    heading = title or f"QA report — {_subject(result)}"
    return (
        "<!DOCTYPE html>\n"
        '<html lang="en">\n<head>\n'
        '<meta charset="utf-8"/>\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1"/>\n'
        f"<title>{_e(heading)}</title>\n"
        f"<style>{_CSS}</style>\n"
        "</head>\n<body>\n"
        '<div class="page">\n'
        f"{renderer(result)}\n"
        # Attribution is part of the document, not an optional flourish.
        f"{branding.footer_html()}"
        "</div>\n</body>\n</html>\n"
    )


def render_file(path, title=None):
    """Read an artifact from disk and render it."""
    try:
        with open(path, "r", encoding="utf-8") as handle:
            result = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        raise ReportError(f"could not read artifact at {path}: {exc}") from exc
    if not isinstance(result, dict):
        raise ReportError(f"artifact at {path} is not a JSON object")
    return render(result, title=title)


def supported_contracts():
    return sorted(_RENDERERS)


__all__ = [
    "render", "render_file", "supported_contracts", "ReportError",
    "render_explore", "render_report",
]
