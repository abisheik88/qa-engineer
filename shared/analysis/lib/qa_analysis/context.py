"""Deterministic parsing of `.qa/context.md`.

`qa-init` writes the project profile as a Markdown file whose frontmatter holds
the machine-readable facts, and every other skill reads it. The contract for
those facts is a JSON Schema (`shared/analysis/schemas/context.schema.json`) —
but nothing could check a *real* `.qa/context.md` against it, because the
toolkit is standard-library-only and the frontmatter is YAML. Validation ran
against a hand-written JSON fixture instead, so the contract was unenforced
exactly where it mattered.

This module closes that gap without adding a dependency or changing the file
format: it parses the **explicit subset** of YAML the context contract uses,
then hands the result to the existing contract validator.

## The supported subset

Deliberately small, and everything outside it is an error rather than a guess:

- `key: value` mappings, nested by two-space indentation
- block sequences (`- item`), including nested under a key
- flow collections only when empty: `[]` and `{}`
- scalars: double- or single-quoted strings, bare strings, integers, floats,
  `true`/`false`, `null`/`~`/empty
- `#` comments on their own line or after a value
- the leading/trailing `---` fences

Not supported, and rejected loudly: anchors/aliases, multi-line block scalars
(`|`, `>`), non-empty flow collections, multi-document streams, and tabs for
indentation. A generator that needs one of those has outgrown the contract, and
the right response is to change the contract deliberately — not to have a parser
quietly misread it.
"""

import re

from . import contracts

_FENCE = "---"
_TRUE = ("true", "True", "TRUE")
_FALSE = ("false", "False", "FALSE")
_NULL = ("null", "Null", "NULL", "~", "")
_UNSUPPORTED_SCALARS = ("|", ">")
_INT = re.compile(r"^-?\d+$")
_FLOAT = re.compile(r"^-?\d+\.\d+$")


class MalformedContext(ValueError):
    """Raised when `.qa/context.md` cannot be parsed or fails its contract."""


def split_frontmatter(text):
    """Return (frontmatter_text, body_text). Raises if the fences are missing."""
    lines = text.split("\n")
    start = None
    for index, line in enumerate(lines):
        if line.strip() == "":
            continue
        if line.rstrip() == _FENCE:
            start = index
        break
    if start is None:
        raise MalformedContext(
            "no frontmatter: the file must open with a '---' fence "
            "(see the qa-init context template)"
        )
    for index in range(start + 1, len(lines)):
        if lines[index].rstrip() == _FENCE:
            return "\n".join(lines[start + 1:index]), "\n".join(lines[index + 1:])
    raise MalformedContext("unterminated frontmatter: no closing '---' fence")


def _strip_comment(value):
    """Remove a trailing `#` comment that is not inside quotes."""
    quote = None
    for index, char in enumerate(value):
        if quote:
            if char == quote:
                quote = None
        elif char in ("'", '"'):
            quote = char
        elif char == "#" and (index == 0 or value[index - 1] in " \t"):
            return value[:index]
    return value


def _scalar(raw, line_number):
    text = _strip_comment(raw).strip()
    if text[:1] in _UNSUPPORTED_SCALARS:
        raise MalformedContext(
            f"line {line_number}: block scalars ('|', '>') are outside the supported subset"
        )
    if text[:1] in ("&", "*"):
        raise MalformedContext(
            f"line {line_number}: anchors and aliases are outside the supported subset"
        )
    if len(text) >= 2 and text[0] == text[-1] and text[0] in ("'", '"'):
        return text[1:-1]
    if text == "[]":
        return []
    if text == "{}":
        return {}
    if text.startswith("[") or text.startswith("{"):
        raise MalformedContext(
            f"line {line_number}: only empty flow collections ('[]', '{{}}') are supported; "
            "use a block sequence or mapping"
        )
    if text in _TRUE:
        return True
    if text in _FALSE:
        return False
    if text in _NULL:
        return None
    if _INT.match(text):
        return int(text)
    if _FLOAT.match(text):
        return float(text)
    return text


def _require_indent_matches(stack, indent, line_number):
    """A line must sit at exactly the indent of the container it lands in.

    Without this, a document YAML itself rejects was silently misread. Given

        list:
          - one
          key: inside a sequence

    PyYAML reports "expected <block end>, but found '?'" — a mapping key cannot
    share indentation with a sequence entry in the same block. This parser closed
    the sequence and put `key` in the *root* mapping, two levels out from where it
    was written, producing {"list": ["one"], "key": "..."} from an invalid file.

    Found by the Node port's parity gate, which agreed with Python and so caught it
    only because the corpus recorded the document as one that must be refused.
    """
    if stack[-1][0] != indent:
        raise MalformedContext(
            f"line {line_number}: indentation {indent} matches no open block "
            f"(the enclosing block starts at column {stack[-1][0]})"
        )


def parse_frontmatter(text):
    """Parse the supported YAML subset into a dict. Raises MalformedContext.

    The parser keeps a stack of `(key_indent, container)` frames. `key_indent` is
    the column at which that container's own entries start, so a line's indent
    alone decides which container it belongs to: pop every frame deeper than the
    line, and the top of the stack is the target.
    """
    root = {}
    stack = [(0, root)]
    pending = None  # (key, indent) — a key whose value is a block that follows

    def resolve_pending_as_null():
        """A key with no value and no nested block is a null field."""
        nonlocal pending
        if pending is not None:
            stack[-1][1][pending[0]] = None
            pending = None

    for number, raw_line in enumerate(text.split("\n"), start=1):
        leading = raw_line[: len(raw_line) - len(raw_line.lstrip())]
        if "\t" in leading:
            raise MalformedContext(f"line {number}: tab indentation is not supported")
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped == _FENCE:
            raise MalformedContext(f"line {number}: unexpected '---' inside frontmatter")

        indent = len(raw_line) - len(raw_line.lstrip(" "))

        # --- sequence item ---
        if stripped.startswith("- ") or stripped == "-":
            item = _scalar(stripped[2:] if len(stripped) > 1 else "", number)
            if pending is not None:
                # A sequence may sit at the key's indent or deeper.
                parent = stack[-1][1]
                parent[pending[0]] = []
                stack.append((indent, parent[pending[0]]))
                pending = None
            while len(stack) > 1 and stack[-1][0] > indent:
                stack.pop()
            container = stack[-1][1]
            if not isinstance(container, list):
                raise MalformedContext(f"line {number}: sequence item outside a sequence")
            _require_indent_matches(stack, indent, number)
            container.append(item)
            continue

        # --- mapping entry ---
        if ":" not in stripped:
            raise MalformedContext(
                f"line {number}: expected 'key: value' or '- item', got {stripped!r}"
            )

        if pending is not None:
            if indent > pending[1]:
                # The pending key opens a nested mapping at this indent.
                parent = stack[-1][1]
                parent[pending[0]] = {}
                stack.append((indent, parent[pending[0]]))
                pending = None
            else:
                resolve_pending_as_null()

        # Leave the frames this line does not belong to. A sequence frame at the
        # same indent as a key also ends here (`packages:` / `- a` / `ci:`).
        while len(stack) > 1 and (
            stack[-1][0] > indent
            or (isinstance(stack[-1][1], list) and stack[-1][0] >= indent)
        ):
            stack.pop()

        key, _, value = stripped.partition(":")
        key = key.strip()
        if not key:
            raise MalformedContext(f"line {number}: empty key")
        container = stack[-1][1]
        if not isinstance(container, dict):
            raise MalformedContext(f"line {number}: mapping key inside a sequence")
        _require_indent_matches(stack, indent, number)

        if _strip_comment(value).strip() == "":
            pending = (key, indent)  # a block or a null follows
        else:
            container[key] = _scalar(value, number)

    resolve_pending_as_null()
    return root


def parse(text, schema=None):
    """Parse `.qa/context.md` text and, when a schema is given, validate it.

    Returns {"context": <dict>, "body": <str>, "valid": bool, "errors": [...]}.
    Raises MalformedContext when the text cannot be parsed at all — a parse
    failure is not a validation result.
    """
    frontmatter, body = split_frontmatter(text)
    context = parse_frontmatter(frontmatter)
    result = {"context": context, "body": body, "valid": True, "errors": []}
    if schema is not None:
        ok, errors = contracts.validate(context, schema)
        result["valid"] = ok
        result["errors"] = errors
    return result


def parse_file(path, schema=None):
    """Read and parse a `.qa/context.md` file."""
    try:
        with open(path, "r", encoding="utf-8") as handle:
            text = handle.read()
    except OSError as exc:
        raise MalformedContext(f"could not read {path}: {exc}") from exc
    return parse(text, schema=schema)
