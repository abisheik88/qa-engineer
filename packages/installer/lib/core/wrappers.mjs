// Generating per-agent invocation wrappers. A wrapper is a thin companion file
// that gives an agent a slash command mapping to a skill, for agents whose
// slash ergonomics need one. Per ADR-0002 a wrapper is rendered from skill
// frontmatter ALONE, contains no knowledge, and is at most 15 lines. Agents
// that invoke skills natively (Claude Code, Codex CLI, Cursor) get no wrapper.

import { GENERATED_MARKER } from '../constants.mjs';
import { oneLineDescription } from './skill-meta.mjs';

const MAX_WRAPPER_LINES = 15;

// YAML/TOML-safe double-quoted string.
function quote(value) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// Each renderer forwards the user's trailing text using the target agent's own
// documented argument convention, resolving open question #4 (trailing args)
// for the agents that need a wrapper.
const RENDERERS = {
  // Gemini CLI custom command (TOML). {{args}} injects the trailing text.
  'command-toml': (name, desc) => ({
    filename: `${name}.toml`,
    content:
      `# ${GENERATED_MARKER}\n` +
      `description = ${quote(desc)}\n` +
      'prompt = """\n' +
      `Apply the ${name} skill from the QA Automation Pack skills, following its procedure.\n` +
      'Treat the following as the user request:\n\n' +
      '{{args}}\n' +
      '"""\n',
  }),

  // OpenCode custom command (Markdown). $ARGUMENTS injects the trailing text.
  'command-md': (name, desc) => ({
    filename: `${name}.md`,
    content:
      '---\n' +
      `description: ${quote(desc)}\n` +
      '---\n' +
      `<!-- ${GENERATED_MARKER} -->\n\n` +
      `Apply the \`${name}\` skill from the QA Automation Pack to the request below, following its procedure.\n\n` +
      '$ARGUMENTS\n',
  }),

  // GitHub Copilot prompt file. Copilot supplies the chat request as context.
  'prompt-md': (name, desc) => ({
    filename: `${name}.prompt.md`,
    content:
      '---\n' +
      `description: ${quote(desc)}\n` +
      '---\n' +
      `<!-- ${GENERATED_MARKER} -->\n\n` +
      `Apply the \`${name}\` skill from the QA Automation Pack to the current request, following its procedure.\n`,
  }),

  // Antigravity workflow (Markdown). Format is not yet verified against primary
  // documentation (ADR-0002 open question #3), so this is generated only on
  // explicit opt-in; the default is auto-activation.
  'workflow-md': (name, desc) => ({
    filename: `${name}.md`,
    content:
      '---\n' +
      `description: ${quote(desc)}\n` +
      '---\n' +
      `<!-- ${GENERATED_MARKER} -->\n\n` +
      `Apply the \`${name}\` skill from the QA Automation Pack to the request below, following its procedure.\n\n` +
      '$ARGUMENTS\n',
  }),
};

export function supportsFormat(format) {
  return Object.prototype.hasOwnProperty.call(RENDERERS, format);
}

/**
 * Render one wrapper. Returns { filename, content }. Throws if the result would
 * exceed the 15-line ceiling — a guard against a wrapper accreting knowledge.
 */
export function renderWrapper(format, meta) {
  const render = RENDERERS[format];
  if (!render) throw new Error(`unknown wrapper format: ${format}`);
  const out = render(meta.name, oneLineDescription(meta.description));
  const lines = out.content.replace(/\n$/, '').split('\n').length;
  if (lines > MAX_WRAPPER_LINES) {
    throw new Error(`wrapper for ${meta.name} is ${lines} lines (max ${MAX_WRAPPER_LINES})`);
  }
  return out;
}

export { MAX_WRAPPER_LINES };
