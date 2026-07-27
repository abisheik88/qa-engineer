// Map environment detections to recommended pack capabilities (existing skills only).

/**
 * @param {{
 *   frameworks: string[],
 *   languages: string[],
 *   project: { graphql: boolean, rest: boolean, react: boolean },
 *   agents: string[],
 * }} scan
 * @returns {Array<{ id: string, label: string, reason: string, recommended: boolean }>}
 */
export function recommendCapabilities(scan) {
  const hasPw = scan.frameworks.includes('playwright');
  const hasAnyFw = scan.frameworks.length > 0;
  const { graphql, rest, react } = scan.project;

  /** @type {Array<{ id: string, label: string, reason: string, recommended: boolean }>} */
  const items = [
    {
      id: 'skills',
      label: 'QA Skills',
      reason: 'Installs /qa-* Agent Skills into your coding assistant',
      recommended: true,
    },
    {
      id: 'playwright',
      label: 'Playwright Integration',
      reason: hasPw
        ? 'Playwright detected — live run and generate are Production-ready'
        : 'No Playwright yet — /qa-generate can bootstrap a suite when you are ready',
      recommended: hasPw || !hasAnyFw,
    },
    {
      id: 'repo-analysis',
      label: 'Repository Analysis',
      reason: '/qa-init profiles the project for every later command',
      recommended: true,
    },
    {
      id: 'ui-bugs',
      label: 'UI Bug Detection',
      reason: react
        ? 'UI stack detected — /qa-explore and /qa-audit cover live pages'
        : 'Use /qa-explore against any URL for product QA',
      recommended: react || hasPw,
    },
    {
      id: 'api',
      label: 'API Validation',
      reason: rest
        ? 'REST stack detected — /qa-api validates HTTP behavior'
        : 'Available via /qa-api when you have API tests or OpenAPI',
      recommended: rest,
    },
    {
      id: 'graphql',
      label: 'GraphQL Validation',
      reason: graphql
        ? 'GraphQL detected — /qa-api covers GraphQL operations'
        : 'Enable when GraphQL appears in the project',
      recommended: graphql,
    },
    {
      id: 'generation',
      label: 'Test Generation',
      reason: hasPw
        ? 'Extend or bootstrap Playwright suites with /qa-generate'
        : 'Bootstrap Playwright automation with /qa-generate',
      recommended: true,
    },
    {
      id: 'engine',
      label: 'Deterministic Engine',
      reason: 'Bundles analysis/diagnostics libraries used by debug, fix, and report',
      recommended: true,
    },
  ];

  return items;
}

/** Capabilities that should always be installed (the full skill pack). */
export function alwaysInstallIds() {
  return ['skills', 'engine', 'repo-analysis', 'generation'];
}
