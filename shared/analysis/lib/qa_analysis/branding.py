"""Product attribution for human-readable reports.

One renderer, one metadata file, three output formats. Every report the pack
produces for a human ends with the same footer, and changing it means editing
`branding.json` — nothing else.

## Why this is code and not a string in each skill

A footer typed by a model is a footer that drifts: the tagline gains a word, the
URL loses a scheme, one report says "Developed by" and the next says "Built by".
Rendering it deterministically makes every report byte-identical, and makes a
change to the branding a one-file edit that CI can verify
(`scripts/check-branding.mjs` fails if any branding string is hardcoded elsewhere).

## What gets a footer, and what must not

Attribution belongs on documents a person reads. It is noise — or worse, a parsing
hazard — anywhere else.

| Branded | Not branded |
| --- | --- |
| HTML reports | JSON and YAML artifacts (`qa-artifacts/*.json`) |
| PDF reports | CLI stdout, progress output, `--json` output |
| Rendered Markdown reports meant for people | Markdown written for machine consumption |
| Generated documentation | Log files, API responses |
| Evaluation and audit report renderings | The system under test, and anything in a user's own source tree |

The rule behind the table: **if a program will parse it, it gets no footer.** A
contract artifact is an interface, and appending prose to an interface breaks it.

## Formats

- `footer_html()` — a `<footer>` element with inline styling (so a standalone
  report file needs no external stylesheet) and the author's site as a link that
  opens in a new tab with `rel="noopener noreferrer"`.
- `footer_markdown()` — a thematic break, the four lines, the site as a link.
- `footer_text()` — rule-separated plain text for PDF writers and terminals-of-last-resort.
  A PDF library that supports hyperlinks should link the URL; one that does not
  renders this as-is, which is why the URL appears in full rather than as anchor text.

Standard library only, like the rest of `qa_analysis`.
"""

import html
import json
import pathlib

_METADATA_PATH = pathlib.Path(__file__).resolve().parent / "branding.json"

# The visual width of the plain-text rules. Wide enough to frame the four lines,
# narrow enough to survive an 80-column terminal or a PDF margin.
_RULE_WIDTH = 60

_ALLOWED_SCHEMES = ("https://", "http://")


class BrandingError(ValueError):
    """Raised when the branding metadata is missing or unusable."""


def metadata():
    """The branding metadata, as a dict. Read fresh so a change needs no reinstall."""
    try:
        with open(_METADATA_PATH, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        raise BrandingError(f"could not read branding metadata at {_METADATA_PATH}: {exc}") from exc

    required = ("projectName", "tagline", "author", "website", "attributionPrefix", "authorPrefix")
    missing = [key for key in required if not data.get(key)]
    if missing:
        raise BrandingError(f"branding metadata is missing: {', '.join(missing)}")
    if not data["website"].startswith(_ALLOWED_SCHEMES):
        # A footer is rendered into HTML, so a non-http scheme here would be an
        # injection vector rather than a typo.
        raise BrandingError(
            f"branding website must start with http:// or https://, got {data['website']!r}"
        )
    return data


def _lines(data):
    """The four footer lines, in order, as plain strings."""
    return [
        f"{data['attributionPrefix']} {data['projectName']}",
        data["tagline"],
        f"{data['authorPrefix']} {data['author']}",
        data["website"],
    ]


def footer_text(width=_RULE_WIDTH):
    """Rule-separated plain text. Used for PDF and any non-markup rendering."""
    data = metadata()
    rule = "-" * width
    body = "\n".join(line.center(width).rstrip() for line in _lines(data))
    return f"{rule}\n{body}\n{rule}\n"


def footer_markdown():
    """A thematic break and the four lines, with the site as a link."""
    data = metadata()
    return (
        "---\n\n"
        f"<sub>{data['attributionPrefix']} **{data['projectName']}** — "
        f"{data['tagline']}<br>\n"
        f"{data['authorPrefix']} "
        f"[{data['author']}]({data['website']})</sub>\n"
    )


def footer_html(class_name="qa-pack-attribution"):
    """A self-contained `<footer>`: inline styles, muted, centered, small.

    The author's site opens in a new tab. `rel="noopener noreferrer"` is not
    optional — a report may be opened from anywhere, and a new tab that can reach
    back into `window.opener` is a real hazard.
    """
    data = metadata()
    site = html.escape(data["website"], quote=True)
    project = html.escape(data["projectName"])
    tagline = html.escape(data["tagline"])
    author = html.escape(data["author"])
    attribution_prefix = html.escape(data["attributionPrefix"])
    author_prefix = html.escape(data["authorPrefix"])
    css_class = html.escape(class_name, quote=True)

    return (
        f'<footer class="{css_class}" style="margin-top:2.5rem;padding-top:1rem;'
        'border-top:1px solid rgba(128,128,128,0.25);font-size:0.75rem;line-height:1.6;'
        'color:#6b7280;text-align:center;font-family:system-ui,-apple-system,'
        'Segoe UI,Roboto,sans-serif;">\n'
        f'  <div>{attribution_prefix} <strong>{project}</strong></div>\n'
        f'  <div>{tagline}</div>\n'
        f'  <div>{author_prefix} '
        f'<a href="{site}" target="_blank" rel="noopener noreferrer" '
        'style="color:inherit;text-decoration:underline;">'
        f'{author}</a></div>\n'
        '</footer>\n'
    )


_RENDERERS = {
    "html": footer_html,
    "markdown": footer_markdown,
    "md": footer_markdown,
    "text": footer_text,
    "txt": footer_text,
    "pdf": footer_text,  # what a PDF writer embeds when it cannot render markup
}

FORMATS = ("html", "markdown", "text")


def footer(fmt="text"):
    """Render the footer in `fmt`. Raises BrandingError on an unknown format."""
    renderer = _RENDERERS.get(fmt.lower())
    if renderer is None:
        raise BrandingError(
            f"unknown branding format {fmt!r}; expected one of: {', '.join(FORMATS)}"
        )
    return renderer()


def append_to(document, fmt="markdown"):
    """Return `document` with the footer appended, idempotently.

    Idempotence matters: a report assembled in stages, or regenerated over its own
    output, must not accumulate footers.
    """
    rendered = footer(fmt)
    if rendered.strip() and rendered.strip() in document:
        return document
    separator = "" if document.endswith("\n") else "\n"
    return f"{document}{separator}\n{rendered}"
