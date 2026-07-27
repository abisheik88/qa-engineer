// Loading, validating, and defaulting qa.config.json. The file is optional;
// when absent, DEFAULTS apply. When present, it is validated against the
// published schema and merged over the defaults.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_FILE } from '../constants.mjs';
import { QaError, usageError } from './errors.mjs';
import { validate } from './schema-validate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(here, '..', '..', 'schemas', 'qa.config.schema.json');

export const CONFIG_SCHEMA = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));

// Every documented default in one place. The effective configuration is these
// values with any qa.config.json overrides applied on top.
export const DEFAULTS = Object.freeze({
  version: 1,
  frameworks: {},
  browser: { default: 'chromium' },
  output: { directory: 'qa-artifacts' },
  logging: { level: 'info' },
  telemetry: { enabled: false },
  plugins: [],
  agents: [],
});

function deepMerge(base, override) {
  const result = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(override ?? {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof result[key] === 'object') {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** The starter config written by `qa init`. Minimal on purpose — only version. */
export function starterConfig() {
  return { version: 1 };
}

/** Validate a raw config object; throws a usage error listing every problem. */
export function validateConfig(raw, source = CONFIG_FILE) {
  const errors = validate(raw, CONFIG_SCHEMA);
  if (errors.length > 0) {
    throw usageError(`${source} is invalid:\n  - ${errors.join('\n  - ')}`);
  }
  return raw;
}

/**
 * Load the effective configuration for a project. Returns { config, source }
 * where source is the file path when one was read, or null for defaults.
 */
export function loadConfig(projectRoot) {
  const file = path.join(projectRoot, CONFIG_FILE);
  if (!fs.existsSync(file)) {
    return { config: structuredClone(DEFAULTS), source: null };
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new QaError(`${CONFIG_FILE} is not valid JSON: ${error.message}`);
  }
  validateConfig(raw, file);
  return { config: deepMerge(DEFAULTS, raw), source: file };
}
