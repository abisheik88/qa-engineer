// Validate internal Analysis → Diagnostics seam payloads.
//
// Uses the dependency-free contract validator against the schemas under
// shared/diagnostics/schemas/internal/.
//
// The schemas must be reachable in both layouts this code runs in: beside the
// engine when it ships inside the package, and at the canonical repository path
// during development. Missing schemas raise InternalContractError naming the
// locations tried, rather than a bare ENOENT from deep inside a diagnosis.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../analysis/contracts.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// Ordered candidates: package-local data first, then the repository layout.
const SCHEMA_DIRS = [
  path.join(here, 'schemas', 'internal'),
  path.resolve(here, '../../../../shared/diagnostics/schemas/internal'),
];

export class InternalContractError extends Error {}

/** The directory holding the internal schemas, whichever layout applies. */
export function schemaDir() {
  for (const candidate of SCHEMA_DIRS) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
  }
  throw new InternalContractError(
    `internal schemas not found; tried: ${SCHEMA_DIRS.join(', ')}. ` +
      'A package that ships the engine must carry diagnostics/schemas/internal/.',
  );
}

function load(name) {
  const file = path.join(schemaDir(), name);
  if (!fs.existsSync(file)) throw new InternalContractError(`internal schema missing: ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function require_(payload, schemaName) {
  const errors = validate(payload, load(schemaName));
  if (errors.length > 0) {
    throw new InternalContractError(`${schemaName}: ${errors.join('; ')}`);
  }
  return payload;
}

export const validateAnalysisResult = (payload) => require_(payload, 'analysis-result.schema.json');
export const validateExecutionResultMin = (payload) => require_(payload, 'execution-result-min.schema.json');
export const validateDiagnosis = (payload) => require_(payload, 'diagnosis.schema.json');
