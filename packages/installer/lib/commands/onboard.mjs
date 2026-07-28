// Interactive onboarding wizard — default bare `qa` command.

import { EXIT } from '../constants.mjs';
import { resolveProjectRoot } from '../core/paths.mjs';
import { parseCommonFlags, wantsNonInteractive } from '../cli/flags.mjs';
import { scanProject } from '../detect/scan.mjs';
import { executeInstall } from './install.mjs';
import { createUi, isCancel } from '../ui/theme.mjs';
import { createLogger } from '../core/logger.mjs';
import { listAgentIds } from '../agents/registry.mjs';

function formatScanNote(scan) {
  const lines = [];
  if (scan.detectedAgents.length) {
    for (const a of scan.detectedAgents) lines.push(`✓ ${a.name} detected`);
  } else {
    lines.push('· No AI coding assistant markers found (will install shared .agents/skills)');
  }
  for (const fw of scan.frameworks) {
    lines.push(`✓ ${fw[0].toUpperCase()}${fw.slice(1)} project detected`);
  }
  for (const lang of scan.languages) {
    lines.push(`✓ ${lang[0].toUpperCase()}${lang.slice(1)} detected`);
  }
  if (scan.environment.git) lines.push('✓ Git repository detected');
  else lines.push('· Not a git repository');
  if (scan.environment.packageManager) {
    lines.push(`✓ Package manager: ${scan.environment.packageManager}`);
  }
  return lines.join('\n');
}

function formatRecommendations(scan) {
  const recommended = scan.recommendations.filter((r) => r.recommended);
  return recommended.map((r) => `✓ ${r.label}\n  ${r.reason}`).join('\n\n');
}

async function guidedFirstRun(ui, { skip }) {
  if (skip) {
    ui.note(
      [
        'Open your AI coding assistant and try:',
        '  /qa-init',
        '  Analyze this repository.',
        '  Find bugs on the Login page.   (or /qa-explore <url>)',
      ].join('\n'),
      'Next steps',
    );
    return;
  }

  ui.note('Open your AI coding assistant (Cursor, Claude Code, OpenCode, …).', 'Step 1');
  const ready = await ui.confirm('Press Enter / confirm when ready', { initialValue: true });
  if (isCancel(ready) || !ready) {
    ui.warn('Skipped guided first-run. Run qa self-test anytime.');
    return;
  }

  ui.note('Ask your assistant:\n\n  Analyze this repository.\n\n  (or type /qa-init)', 'Step 2');
  await ui.confirm('Continue when done', { initialValue: true });

  ui.note(
    'Ask your assistant:\n\n  Find bugs in the Login page.\n\n  (or /qa-explore <url>)',
    'Step 3',
  );
  await ui.confirm('Continue when done', { initialValue: true });

  ui.success('Your QA Engineer Pack is fully operational.');
}

export async function runOnboard(argv, { log } = {}) {
  const opts = parseCommonFlags(argv);
  const logger = log ?? createLogger();
  if (opts.help) {
    logger.result(`Usage: qa [--yes] [--project <dir>] [--agent <id>]...

Interactive installer and guided first-run. Same as: qa onboard

Options:
  --yes / --ci   Skip prompts; install with detected defaults
  --json         Machine-readable result on stdout
  --force        Overwrite conflicting files
  --project <d>  Project root (default: cwd)
  --agent <id>   Target agent (repeatable). Known: ${listAgentIds().join(', ')}`);
    return EXIT.OK;
  }

  const projectRoot = resolveProjectRoot(opts.project ?? process.cwd());
  const nonInteractive = wantsNonInteractive(opts);
  const ui = createUi({ quiet: nonInteractive && !opts.json, json: opts.json });

  if (!nonInteractive) {
    ui.intro('Welcome to QA Engineer Pack');
    ui.logLine('Scanning your environment...');
  } else if (!opts.json) {
    logger.step('Scanning environment (non-interactive)...');
  }

  const scan = scanProject(projectRoot, opts.agents);

  if (!nonInteractive) {
    ui.note(formatScanNote(scan), 'Environment');
    ui.note(`Project: ${scan.projectName}`, 'Project');
    ui.note(formatRecommendations(scan), 'Recommended components');

    const proceed = await ui.confirm('Continue with installation?', { initialValue: true });
    if (isCancel(proceed) || !proceed) {
      ui.cancel('Installation cancelled.');
      return EXIT.OK;
    }

    if (scan.detectedAgents.length > 1 && opts.agents.length === 0) {
      const picked = await ui.multiselect(
        'Which assistants should we install for?',
        scan.detectedAgents.map((a) => ({ value: a.id, label: a.name })),
        { required: true },
      );
      if (isCancel(picked)) {
        ui.cancel('Installation cancelled.');
        return EXIT.OK;
      }
      opts.agents = picked;
    }
  } else if (!opts.json) {
    for (const line of formatScanNote(scan).split('\n')) logger.ok(line.replace(/^[✓·]\s*/, ''));
  }

  const spinner = ui.spinner();
  if (!nonInteractive) spinner.start('Installing...');

  const result = await executeInstall({
    projectRoot,
    agentIds: opts.agents,
    force: opts.force,
    dryRun: opts.dryRun,
    json: opts.json,
    log: createLogger({ level: opts.json || !nonInteractive ? 'error' : 'info' }),
    onProgress: (label) => {
      if (!nonInteractive) spinner.message(label);
      else if (!opts.json) logger.step(label);
    },
  });

  if (!nonInteractive) spinner.stop('Installation complete');

  if (!opts.dryRun && !opts.json) {
    await guidedFirstRun(ui, { skip: nonInteractive });
  }

  if (!nonInteractive) {
    ui.outro('Installation complete — you are ready to QA.');
  } else if (!opts.json) {
    logger.ok('Installation complete');
  }

  logger.result({
    ...result,
    projectName: scan.projectName,
    detectedAgents: scan.detectedAgents.map((a) => a.id),
    recommendations: scan.recommendations.filter((r) => r.recommended).map((r) => r.id),
  });
  return EXIT.OK;
}
