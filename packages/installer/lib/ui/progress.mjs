// Install progress step labels for the polished install experience.

export const INSTALL_STEPS = [
  { id: 'skills', label: 'Installing skills' },
  { id: 'knowledge', label: 'Synchronizing shared knowledge' },
  { id: 'engine', label: 'Bundling deterministic engine' },
  { id: 'contracts', label: 'Validating contracts' },
  { id: 'eval', label: 'Installing evaluation platform' },
  { id: 'config', label: 'Configuration complete' },
];

/**
 * Run labeled progress steps around an async install body.
 * @param {{ start: Function, stop: Function, message?: Function }} spinner
 * @param {(step: { id: string, label: string }) => Promise<void>|void} [onStep]
 */
export async function runProgressSteps(spinner, onStep) {
  for (const step of INSTALL_STEPS) {
    spinner.message?.(step.label);
    spinner.start?.(step.label);
    if (onStep) await onStep(step);
    spinner.stop?.(step.label);
  }
}

/** Simple text progress bar for non-Clack contexts. */
export function progressBar(done, total, width = 18) {
  const ratio = total === 0 ? 1 : Math.min(1, done / total);
  const filled = Math.round(ratio * width);
  const bar = `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
  return `${bar} ${Math.round(ratio * 100)}%`;
}
