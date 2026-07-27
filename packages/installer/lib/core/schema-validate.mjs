// A dependency-free validator for the JSON Schema subset this project uses.
// It is the JavaScript twin of the Python contract validator in
// shared/analysis/lib/qa_analysis/contracts.py: same supported subset, same
// semantics, so a document that passes one passes the other. That promise is
// tested, not asserted — tests/parity/validator-cases.json runs through both.
//
// Anything outside the subset is a programming error in the schema, reported
// rather than silently ignored. `allOf`/`if`/`then`/`else` are in the subset
// because the pack's safety invariants are cross-field implications.

// Keep in sync with SUPPORTED_KEYWORDS in
// shared/analysis/lib/qa_analysis/contracts.py and the table in
// docs/skills/output-contracts.md (checked by scripts/check-spec-code-sync.mjs).
const SUPPORTED = new Set([
  '$schema', '$id', 'title', 'description', 'type', 'properties', 'required',
  'additionalProperties', 'items', 'enum', 'const', 'pattern', 'minimum',
  'maximum', 'minItems', 'maxItems', 'minLength', 'maxLength', 'default',
  'examples', 'format', 'allOf', 'if', 'then', 'else',
]);

// RFC 3339 date-time — the same rule as the Python twin.
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value; // string | number | boolean | object
}

function matchesType(value, type) {
  if (type === 'integer') return Number.isInteger(value) && typeof value !== 'boolean';
  if (type === 'number') return typeof value === 'number';
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'array') return Array.isArray(value);
  return typeOf(value) === type;
}

/** True when value satisfies schema; used for if/then branch selection. */
function satisfies(value, schema) {
  const probe = [];
  validateNode(value, schema, '', probe);
  return probe.length === 0;
}

function validateNode(value, schema, pointer, errors) {
  for (const key of Object.keys(schema)) {
    if (!SUPPORTED.has(key)) {
      errors.push(`${pointer || '/'}: schema uses unsupported keyword "${key}"`);
    }
  }

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      errors.push(`${pointer || '/'}: expected ${types.join(' | ')}, got ${typeOf(value)}`);
      return; // further checks assume the type held
    }
  }

  if (Object.prototype.hasOwnProperty.call(schema, 'const') && JSON.stringify(value) !== JSON.stringify(schema.const)) {
    errors.push(`${pointer || '/'}: must equal ${JSON.stringify(schema.const)}`);
  }

  if (schema.enum && !schema.enum.some((option) => JSON.stringify(option) === JSON.stringify(value))) {
    errors.push(`${pointer || '/'}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
  }

  if (typeof value === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${pointer || '/'}: "${value}" does not match /${schema.pattern}/`);
    }
    if (schema.format === 'date-time' && !DATE_TIME.test(value)) {
      errors.push(`${pointer || '/'}: "${value}" is not a valid date-time`);
    }
    if (schema.minLength != null && value.length < schema.minLength) {
      errors.push(`${pointer || '/'}: shorter than minLength ${schema.minLength}`);
    }
    if (schema.maxLength != null && value.length > schema.maxLength) {
      errors.push(`${pointer || '/'}: longer than maxLength ${schema.maxLength}`);
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) {
      errors.push(`${pointer || '/'}: ${value} is below minimum ${schema.minimum}`);
    }
    if (schema.maximum != null && value > schema.maximum) {
      errors.push(`${pointer || '/'}: ${value} is above maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) {
      errors.push(`${pointer || '/'}: has ${value.length} items, needs at least ${schema.minItems}`);
    }
    if (schema.maxItems != null && value.length > schema.maxItems) {
      errors.push(`${pointer || '/'}: has ${value.length} items, allows at most ${schema.maxItems}`);
    }
    if (schema.items) {
      value.forEach((item, index) => validateNode(item, schema.items, `${pointer}/${index}`, errors));
    }
  }

  if (matchesType(value, 'object') && (schema.properties || schema.required || schema.additionalProperties === false)) {
    const properties = schema.properties ?? {};
    for (const name of schema.required ?? []) {
      if (!Object.prototype.hasOwnProperty.call(value, name)) {
        errors.push(`${pointer || '/'}: missing required property "${name}"`);
      }
    }
    for (const [name, child] of Object.entries(value)) {
      if (properties[name]) {
        validateNode(child, properties[name], `${pointer}/${name}`, errors);
      } else if (schema.additionalProperties === false) {
        errors.push(`${pointer || '/'}: unexpected property "${name}"`);
      }
    }
  }

  // Applicators last: the invariant layer. `additionalProperties` deliberately
  // does not see properties introduced by these subschemas (JSON Schema
  // 2020-12 rule, matching the Python twin).
  for (const sub of schema.allOf ?? []) {
    validateNode(value, sub, pointer, errors);
  }

  if (Object.prototype.hasOwnProperty.call(schema, 'if')) {
    const branch = satisfies(value, schema.if) ? schema.then : schema.else;
    if (branch != null) validateNode(value, branch, pointer, errors);
  }
}

/** Validate `value` against `schema`; returns an array of error strings (empty = valid). */
export function validate(value, schema) {
  const errors = [];
  validateNode(value, schema, '', errors);
  return errors;
}

/** The supported keyword subset, exported so tooling can assert parity. */
export const SUPPORTED_KEYWORDS = Object.freeze([...SUPPORTED].sort());
