// Deterministic parsing of `.qa/context.md`.
//
// `qa-init` writes the project profile as a Markdown file whose frontmatter holds
// the machine-readable facts, and every other skill reads it. The contract for
// those facts is a JSON Schema (shared/analysis/schemas/context.schema.json) — but
// nothing could check a *real* `.qa/context.md` against it, because the engine
// takes no dependencies and the frontmatter is YAML. Validation ran against a
// hand-written JSON fixture instead, so the contract was unenforced exactly where
// it mattered.
//
// This closes that gap without adding a dependency or changing the file format: it
// parses the **explicit subset** of YAML the context contract uses, then hands the
// result to the contract validator.
//
// ## The supported subset
//
// Deliberately small, and everything outside it is an error rather than a guess:
//
//   - `key: value` mappings, nested by two-space indentation
//   - block sequences (`- item`), including nested under a key
//   - flow collections only when empty: `[]` and `{}`
//   - scalars: double- or single-quoted strings, bare strings, integers, floats,
//     `true`/`false`, `null`/`~`/empty
//   - `#` comments on their own line or after a value
//   - the leading/trailing `---` fences
//
// Not supported, and rejected loudly: anchors/aliases, multi-line block scalars
// (`|`, `>`), non-empty flow collections, multi-document streams, and tabs for
// indentation. A generator that needs one of those has outgrown the contract, and
// the right response is to change the contract deliberately — not to have a parser
// quietly misread it.

import fs from 'node:fs';

import { validate } from './contracts.mjs';

const FENCE = '---';
const TRUE = new Set(['true', 'True', 'TRUE']);
const FALSE = new Set(['false', 'False', 'FALSE']);
const NULL = new Set(['null', 'Null', 'NULL', '~', '']);
const UNSUPPORTED_SCALARS = new Set(['|', '>']);
const INT = /^-?\d+$/;
const FLOAT = /^-?\d+\.\d+$/;

export class MalformedContext extends Error {}

/** Return `{frontmatter, body}`. Throws if the fences are missing. */
export function splitFrontmatter(text) {
  const lines = String(text).split('\n');
  let start = null;
  for (const [index, line] of lines.entries()) {
    if (line.trim() === '') continue;
    if (trimEnd(line) === FENCE) start = index;
    break;
  }
  if (start === null) {
    throw new MalformedContext(
      "no frontmatter: the file must open with a '---' fence " +
        '(see the qa-init context template)',
    );
  }
  for (let index = start + 1; index < lines.length; index += 1) {
    if (trimEnd(lines[index]) === FENCE) {
      return {
        frontmatter: lines.slice(start + 1, index).join('\n'),
        body: lines.slice(index + 1).join('\n'),
      };
    }
  }
  throw new MalformedContext("unterminated frontmatter: no closing '---' fence");
}

/** Remove a trailing `#` comment that is not inside quotes. */
function stripComment(value) {
  let quote = null;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (char === '#' && (index === 0 || value[index - 1] === ' ' || value[index - 1] === '\t')) {
      return value.slice(0, index);
    }
  }
  return value;
}

function scalar(raw, lineNumber) {
  const text = stripComment(raw).trim();
  const first = text.slice(0, 1);
  if (UNSUPPORTED_SCALARS.has(first)) {
    throw new MalformedContext(
      `line ${lineNumber}: block scalars ('|', '>') are outside the supported subset`,
    );
  }
  if (first === '&' || first === '*') {
    throw new MalformedContext(
      `line ${lineNumber}: anchors and aliases are outside the supported subset`,
    );
  }
  if (text.length >= 2 && text[0] === text[text.length - 1] && (text[0] === "'" || text[0] === '"')) {
    return text.slice(1, -1);
  }
  if (text === '[]') return [];
  if (text === '{}') return {};
  if (text.startsWith('[') || text.startsWith('{')) {
    throw new MalformedContext(
      `line ${lineNumber}: only empty flow collections ('[]', '{}') are supported; ` +
        'use a block sequence or mapping',
    );
  }
  if (TRUE.has(text)) return true;
  if (FALSE.has(text)) return false;
  if (NULL.has(text)) return null;
  if (INT.test(text)) return Number.parseInt(text, 10);
  if (FLOAT.test(text)) return Number.parseFloat(text);
  return text;
}

/**
 * A line must sit at exactly the indent of the container it lands in.
 *
 * Without this, a document YAML itself rejects was silently misread. Given
 *
 *     list:
 *       - one
 *       key: inside a sequence
 *
 * PyYAML reports "expected <block end>, but found '?'" — a mapping key cannot
 * share indentation with a sequence entry in the same block. The parser closed the
 * sequence and put `key` in the *root* mapping, two levels out from where it was
 * written, turning an invalid file into a plausible one.
 */
function requireIndentMatches(stack, indent, lineNumber) {
  if (stack[stack.length - 1][0] !== indent) {
    throw new MalformedContext(
      `line ${lineNumber}: indentation ${indent} matches no open block ` +
        `(the enclosing block starts at column ${stack[stack.length - 1][0]})`,
    );
  }
}

/**
 * Parse the supported YAML subset into an object.
 *
 * The parser keeps a stack of `[keyIndent, container]` frames. `keyIndent` is the
 * column at which that container's own entries start, so a line's indent alone
 * decides which container it belongs to: pop every frame deeper than the line, and
 * the top of the stack is the target.
 */
export function parseFrontmatter(text) {
  const root = {};
  const stack = [[0, root]];
  let pending = null; // [key, indent] — a key whose value is a block that follows

  const resolvePendingAsNull = () => {
    // A key with no value and no nested block is a null field.
    if (pending !== null) {
      stack[stack.length - 1][1][pending[0]] = null;
      pending = null;
    }
  };

  const lines = String(text).split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const number = index + 1;
    const leading = rawLine.slice(0, rawLine.length - trimStart(rawLine).length);
    if (leading.includes('\t')) {
      throw new MalformedContext(`line ${number}: tab indentation is not supported`);
    }
    const stripped = rawLine.trim();
    if (!stripped || stripped.startsWith('#')) continue;
    if (stripped === FENCE) {
      throw new MalformedContext(`line ${number}: unexpected '---' inside frontmatter`);
    }

    const indent = rawLine.length - trimStartSpaces(rawLine).length;

    // --- sequence item ---
    if (stripped.startsWith('- ') || stripped === '-') {
      const item = scalar(stripped.length > 1 ? stripped.slice(2) : '', number);
      if (pending !== null) {
        // A sequence may sit at the key's indent or deeper.
        const parent = stack[stack.length - 1][1];
        parent[pending[0]] = [];
        stack.push([indent, parent[pending[0]]]);
        pending = null;
      }
      while (stack.length > 1 && stack[stack.length - 1][0] > indent) stack.pop();
      const container = stack[stack.length - 1][1];
      if (!Array.isArray(container)) {
        throw new MalformedContext(`line ${number}: sequence item outside a sequence`);
      }
      requireIndentMatches(stack, indent, number);
      container.push(item);
      continue;
    }

    // --- mapping entry ---
    if (!stripped.includes(':')) {
      throw new MalformedContext(
        `line ${number}: expected 'key: value' or '- item', got '${stripped}'`,
      );
    }

    if (pending !== null) {
      if (indent > pending[1]) {
        // The pending key opens a nested mapping at this indent.
        const parent = stack[stack.length - 1][1];
        parent[pending[0]] = {};
        stack.push([indent, parent[pending[0]]]);
        pending = null;
      } else {
        resolvePendingAsNull();
      }
    }

    // Leave the frames this line does not belong to. A sequence frame at the same
    // indent as a key also ends here (`packages:` / `- a` / `ci:`).
    while (
      stack.length > 1 &&
      (stack[stack.length - 1][0] > indent ||
        (Array.isArray(stack[stack.length - 1][1]) && stack[stack.length - 1][0] >= indent))
    ) {
      stack.pop();
    }

    const separator = stripped.indexOf(':');
    const key = stripped.slice(0, separator).trim();
    const value = stripped.slice(separator + 1);
    if (!key) throw new MalformedContext(`line ${number}: empty key`);
    const container = stack[stack.length - 1][1];
    if (Array.isArray(container)) {
      throw new MalformedContext(`line ${number}: mapping key inside a sequence`);
    }
    requireIndentMatches(stack, indent, number);

    if (stripComment(value).trim() === '') {
      pending = [key, indent]; // a block or a null follows
    } else {
      container[key] = scalar(value, number);
    }
  }

  resolvePendingAsNull();
  return root;
}

/**
 * Parse `.qa/context.md` text and, when a schema is given, validate it.
 *
 * A parse failure throws: it is not a validation result. "This file is not
 * parseable" and "this file is parseable but wrong" are different answers, and
 * collapsing them would report a broken file as a merely invalid one.
 */
export function parse(text, { schema = null } = {}) {
  const { frontmatter, body } = splitFrontmatter(text);
  const context = parseFrontmatter(frontmatter);
  const result = { context, body, valid: true, errors: [] };
  if (schema !== null) {
    const errors = validate(context, schema);
    result.valid = errors.length === 0;
    result.errors = errors;
  }
  return result;
}

/** Read and parse a `.qa/context.md` file. */
export function parseFile(path, { schema = null } = {}) {
  let text;
  try {
    text = fs.readFileSync(path, 'utf8');
  } catch (error) {
    throw new MalformedContext(`could not read ${path}: ${error.message}`);
  }
  return parse(text, { schema });
}

// Python's str.rstrip()/lstrip() strip all whitespace; JavaScript's trimEnd and
// trimStart do the same, but the indent calculation needs spaces only — a line
// indented with a form feed is not indented two columns.
function trimEnd(value) {
  return value.replace(/\s+$/, '');
}

function trimStart(value) {
  return value.replace(/^\s+/, '');
}

function trimStartSpaces(value) {
  return value.replace(/^ +/, '');
}
