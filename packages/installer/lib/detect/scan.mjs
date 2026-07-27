// Full project scan: agents + environment + frameworks + project + recommendations.

import path from 'node:path';
import { AGENTS, resolveInstallTargets } from '../agents/registry.mjs';
import { detectEnvironment } from './environment.mjs';
import { detectFrameworks } from './frameworks.mjs';
import { detectProject } from './project.mjs';
import { recommendCapabilities } from './recommend.mjs';

/**
 * @param {string} projectRoot
 * @param {string[]} [explicitAgentIds]
 */
export function scanProject(projectRoot, explicitAgentIds = []) {
  const root = path.resolve(projectRoot);
  const environment = detectEnvironment(root);
  const frameworks = detectFrameworks(root);
  const project = detectProject(root);
  const detectedAgents = AGENTS.filter((a) => a.detect(root)).map((a) => ({
    id: a.id,
    name: a.name,
  }));
  const installTargets = resolveInstallTargets(root, explicitAgentIds).map((a) => ({
    id: a.id,
    name: a.name,
    skillsDir: a.skillsDir,
  }));

  const recommendations = recommendCapabilities({
    frameworks: frameworks.frameworks,
    languages: frameworks.languages,
    project,
    agents: detectedAgents.map((a) => a.id),
  });

  return {
    projectRoot: root,
    projectName: project.name,
    environment,
    frameworks: frameworks.frameworks,
    languages: frameworks.languages,
    frameworkDetails: frameworks.details,
    project,
    detectedAgents,
    installTargets,
    recommendations,
  };
}
