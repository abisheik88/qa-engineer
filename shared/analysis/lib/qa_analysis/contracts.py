"""Deterministic contract validation.

A dependency-free validator for the subset of JSON Schema the pack's contracts
use. It exists so no skill ever emits a result that violates its own contract,
and so CI can gate on it without a third-party dependency.

The supported subset is declared once, in `SUPPORTED_KEYWORDS`, and is the
**same** subset the JavaScript twin implements
(`packages/installer/lib/core/schema-validate.mjs`). Two rules keep that promise
honest:

1. A keyword outside the subset is an **error**, never a silent no-op — a
   contract author cannot accidentally write a constraint that looks enforced
   and isn't.
2. `tests/parity/validator-cases.json` runs through both validators and both
   must agree on every case.

The subset includes `allOf` / `if` / `then` / `else` because the pack's safety
invariants are cross-field implications ("classification `passed` implies exit
code 0"). Those must be enforced at runtime by the contract itself, not only by
evaluation fixtures.

This validates the pack's own schemas; it is not a general-purpose JSON Schema
implementation, and it says so rather than pretending to be one.
"""

import json
import re

_TYPES = {
    "object": dict,
    "array": list,
    "string": str,
    "number": (int, float),
    "integer": int,
    "boolean": bool,
    "null": type(None),
}

# The complete supported subset. Anything else is reported as a schema error.
# Keep in sync with SUPPORTED in packages/installer/lib/core/schema-validate.mjs
# and the table in docs/skills/output-contracts.md (checked by
# scripts/check-spec-code-sync.mjs).
SUPPORTED_KEYWORDS = frozenset({
    "$schema", "$id", "title", "description", "type", "properties", "required",
    "additionalProperties", "items", "enum", "const", "pattern", "minimum",
    "maximum", "minItems", "maxItems", "minLength", "maxLength", "default",
    "examples", "format", "allOf", "if", "then", "else",
})

# RFC 3339 date-time. Defined here (rather than delegating to
# datetime.fromisoformat, which also accepts date-only strings and varies by
# interpreter version) so both validators accept exactly the same set.
_DATE_TIME = re.compile(
    r"^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$"
)


def load_schema(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def validate(instance, schema, path="$"):
    """Validate instance against schema. Returns (ok, errors) where errors is a
    list of human-readable "path: problem" strings."""
    errors = []
    _validate(instance, schema, path, errors)
    return (not errors, errors)


def _type_ok(value, expected):
    types = expected if isinstance(expected, list) else [expected]
    for name in types:
        py = _TYPES.get(name)
        if py is None:
            continue
        # bool is a subclass of int; keep them distinct.
        if name == "integer" and isinstance(value, bool):
            continue
        if name == "number" and isinstance(value, bool):
            continue
        if isinstance(value, py):
            return True
    return False


def _matches(value, schema):
    """True when value satisfies schema. Used for if/then branch selection, so
    it must not leak errors into the caller's list."""
    probe = []
    _validate(value, schema, "$", probe)
    return not probe


def _validate(value, schema, path, errors):
    for keyword in schema:
        if keyword not in SUPPORTED_KEYWORDS:
            errors.append(f"{path}: schema uses unsupported keyword \"{keyword}\"")

    if "type" in schema and not _type_ok(value, schema["type"]):
        errors.append(f"{path}: expected type {schema['type']}, got {type(value).__name__}")
        return  # further checks assume the type held

    if "const" in schema and value != schema["const"]:
        errors.append(f"{path}: expected const {schema['const']!r}, got {value!r}")

    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: {value!r} is not one of {schema['enum']}")

    if isinstance(value, str):
        if "pattern" in schema and not re.search(schema["pattern"], value):
            errors.append(f"{path}: {value!r} does not match pattern {schema['pattern']}")
        if schema.get("format") == "date-time" and not _DATE_TIME.match(value):
            errors.append(f"{path}: {value!r} is not a valid date-time")
        if "minLength" in schema and len(value) < schema["minLength"]:
            errors.append(f"{path}: shorter than minLength {schema['minLength']}")
        if "maxLength" in schema and len(value) > schema["maxLength"]:
            errors.append(f"{path}: longer than maxLength {schema['maxLength']}")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{path}: {value} < minimum {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            errors.append(f"{path}: {value} > maximum {schema['maximum']}")

    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            errors.append(f"{path}: fewer than minItems {schema['minItems']}")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errors.append(f"{path}: more than maxItems {schema['maxItems']}")
        if "items" in schema:
            for i, item in enumerate(value):
                _validate(item, schema["items"], f"{path}[{i}]", errors)

    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                errors.append(f"{path}: missing required property '{key}'")
        properties = schema.get("properties", {})
        for key, sub in properties.items():
            if key in value:
                _validate(value[key], sub, f"{path}.{key}", errors)
        if schema.get("additionalProperties") is False:
            for key in value:
                if key not in properties:
                    errors.append(f"{path}: additional property '{key}' is not allowed")

    # Applicators last: the invariant layer. `additionalProperties` deliberately
    # does not see properties introduced by these subschemas (same rule as
    # JSON Schema 2020-12, and the same as the JavaScript twin).
    for sub in schema.get("allOf", []):
        _validate(value, sub, path, errors)

    if "if" in schema:
        branch = schema.get("then") if _matches(value, schema["if"]) else schema.get("else")
        if branch is not None:
            _validate(value, branch, path, errors)
