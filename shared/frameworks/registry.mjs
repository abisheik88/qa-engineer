// Load the canonical framework registry. All detection and matrix checks
// derive from shared/frameworks/registry.json — do not duplicate framework lists.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

let cached = null;

export function registryPath() {
  return path.join(here, 'registry.json');
}

export function loadFrameworkRegistry() {
  if (cached) return cached;
  const raw = JSON.parse(fs.readFileSync(registryPath(), 'utf8'));
  cached = raw;
  return raw;
}

export function listFrameworks() {
  return loadFrameworkRegistry().frameworks;
}

export function getFramework(id) {
  return listFrameworks().find((f) => f.id === id) ?? null;
}

export function liveExecutionFrameworks() {
  return listFrameworks().filter((f) => f.liveExecution).map((f) => f.id);
}

export function supportedFrameworks() {
  return listFrameworks().filter((f) => f.supportLevel !== 'Planning');
}
