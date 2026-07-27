// Detect project characteristics: GraphQL, REST, Docker, CI, monorepo, React.

import fs from 'node:fs';
import path from 'node:path';

function readPackageJson(root) {
  const p = path.join(root, 'package.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function depsOf(pkg) {
  if (!pkg) return new Set();
  return new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ]);
}

function anyExists(root, names) {
  return names.some((n) => fs.existsSync(path.join(root, n)));
}

function hasGraphqlFiles(root) {
  try {
    const entries = fs.readdirSync(root);
    if (entries.some((n) => n.endsWith('.graphql') || n.endsWith('.gql'))) return true;
  } catch {
    /* ignore */
  }
  return anyExists(root, ['schema.graphql', 'schema.gql']);
}

function isMonorepo(root) {
  return anyExists(root, [
    'pnpm-workspace.yaml',
    'lerna.json',
    'nx.json',
    'turbo.json',
    'rush.json',
  ]);
}

function hasDocker(root) {
  return anyExists(root, [
    'Dockerfile',
    'Dockerfile.dev',
    'docker-compose.yml',
    'docker-compose.yaml',
    'compose.yml',
  ]);
}

function hasGithubActions(root) {
  const dir = path.join(root, '.github', 'workflows');
  if (!fs.existsSync(dir)) return false;
  try {
    return fs.readdirSync(dir).some((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  } catch {
    return false;
  }
}

/**
 * @param {string} projectRoot
 * @returns {{
 *   name: string,
 *   graphql: boolean,
 *   rest: boolean,
 *   docker: boolean,
 *   githubActions: boolean,
 *   monorepo: boolean,
 *   react: boolean,
 *   features: string[],
 * }}
 */
export function detectProject(projectRoot) {
  const pkg = readPackageJson(projectRoot);
  const deps = depsOf(pkg);
  const name = pkg?.name || path.basename(projectRoot);

  const graphql =
    hasGraphqlFiles(projectRoot) ||
    deps.has('graphql') ||
    deps.has('@apollo/client') ||
    deps.has('apollo-server') ||
    deps.has('@nestjs/graphql');

  const rest =
    deps.has('express') ||
    deps.has('fastify') ||
    deps.has('@nestjs/core') ||
    deps.has('hono') ||
    deps.has('koa') ||
    anyExists(projectRoot, ['openapi.yaml', 'openapi.yml', 'swagger.yaml', 'swagger.json']);

  const react =
    deps.has('react') || deps.has('next') || deps.has('@angular/core') || deps.has('vue');
  const docker = hasDocker(projectRoot);
  const githubActions = hasGithubActions(projectRoot);
  const monorepo = isMonorepo(projectRoot);

  const features = [];
  if (react) features.push('ui');
  if (graphql) features.push('graphql');
  if (rest) features.push('rest');
  if (docker) features.push('docker');
  if (githubActions) features.push('github-actions');
  if (monorepo) features.push('monorepo');

  return {
    name,
    graphql,
    rest,
    docker,
    githubActions,
    monorepo,
    react,
    features,
  };
}
