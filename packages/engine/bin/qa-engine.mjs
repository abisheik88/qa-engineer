#!/usr/bin/env node
// The deterministic engine's command line — how a skill reaches it.
//
// One entry point for all three tool groups, replacing three Python CLIs and a
// launcher. Every subcommand writes JSON to stdout, so an agent never has to invent
// glue code, and the shapes are checked rather than assumed.
//
//   qa-engine analysis    <subcommand> [args]
//   qa-engine diagnostics <subcommand> [args]
//   qa-engine playwright  <subcommand> [args]
//
// Exit codes are the contract, not an implementation detail. A skill's fallback
// logic reads them:
//
//   0  success
//   1  a document was read fine but failed its contract (`validate`, `context`)
//   2  unreadable input, malformed JSON, a failed seam contract, or bad usage
//
// Nothing here reasons: it reads files, calls the engine, prints the result. That
// separation is the whole architecture — deterministic code owns the facts, the
// model owns the explanation.

import fs from 'node:fs';
import path from 'node:path';

import * as junit from '../lib/analysis/junit.mjs';
import * as har from '../lib/analysis/har.mjs';
import * as discovery from '../lib/analysis/discovery.mjs';
import * as diffGuard from '../lib/analysis/diff-guard.mjs';
import * as redaction from '../lib/analysis/redaction.mjs';
import * as contracts from '../lib/analysis/contracts.mjs';
import * as taxonomy from '../lib/analysis/taxonomy.mjs';
import * as contextModule from '../lib/analysis/context.mjs';
import * as branding from '../lib/analysis/branding.mjs';
import * as reportHtml from '../lib/analysis/report-html.mjs';
import * as diagnostics from '../lib/diagnostics/engine.mjs';
import {
  InternalContractError, validateAnalysisResult, validateExecutionResultMin, validateDiagnosis,
} from '../lib/diagnostics/internal-contracts.mjs';
import * as playwright from '../lib/frameworks/playwright.mjs';
import * as junitFrameworks from '../lib/frameworks/junit-frameworks.mjs';

const USAGE = `usage: qa-engine <tool> <subcommand> [args]

  analysis     parse artifacts, classify errors, validate contracts, diff-guard,
               read .qa/context.md, render an HTML report, print the footer
  diagnostics  root cause, timeline, priority, repair plans, release readiness
  playwright   normalize a Playwright report or summarize a trace

analysis subcommands
  junit <report.xml>                        normalized {tests, executed}
  har <file.har> [--slow-ms N]              redacted network summary
  discover [--root DIR] [--path P ...]      artifacts found, by state
  diff-guard <diff-file>                    {issues, safe} — safe:false blocks a change
  redact <file>                             the file's text with secrets masked
  validate <instance.json> <schema.json>    {valid, errors}; exit 1 when invalid
  classify "<message>" [--http-status N]    {classification, confidence, reason}
  context [--root DIR] [--path P]           parsed, schema-checked project context
  report-html <result.json> [--out FILE]    a self-contained HTML report
  branding [--format html|markdown|text]    the exact footer bytes for a report

diagnostics subcommands
  diagnose --execution-result P [--analysis-result P]
  plan-repairs --diagnosis P
  summarize --execution-result P --diagnosis P
  report --execution-result P [--analysis-result P]     all three in one call

playwright subcommands
  report <results.json>                     the same shape as analysis junit
  trace <trace.zip>                         actions, errors, and a classification

examples
  qa-engine analysis junit test-results/results.xml
  qa-engine analysis report-html qa-artifacts/explore-result.json --out report.html
  qa-engine diagnostics report --execution-result qa-artifacts/run.json
`;

function emit(value) {
  process.stdout.write(`${JSON.stringify(value, sortedReplacer(), 2)}\n`);
}

/**
 * Keys are emitted in sorted order, matching the Python CLIs' `sort_keys=True`.
 * The output is read by people and diffed in CI, so a stable order is part of it.
 */
function sortedReplacer() {
  return function replacer(key, value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  };
}

function fail(error, detail) {
  emit({ error, detail });
  return 2;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Flags, parsed the way the Python argparse CLIs accepted them. */
function parseFlags(argv, { repeatable = [] } = {}) {
  const flags = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const [name, inline] = token.slice(2).split('=', 2);
    const camel = name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = inline !== undefined ? inline : argv[++index];
    if (repeatable.includes(camel)) {
      flags[camel] = [...(flags[camel] ?? []), value];
    } else {
      flags[camel] = value;
    }
  }
  return { flags, positional };
}

// Which flags may appear more than once, per subcommand. `discover` accepts a list
// of explicit paths; `context` names one file. Treating `--path` as repeatable
// everywhere handed `context` an array and it failed on "path must be a string".
const REPEATABLE = { discover: ['path'] };

function analysis(argv) {
  const [subcommand, ...rest] = argv;
  const { flags, positional } = parseFlags(rest, { repeatable: REPEATABLE[subcommand] ?? [] });

  switch (subcommand) {
    case 'junit':
      requirePositional(positional, 1, 'junit <report.xml>');
      emit(junit.parseJUnit(positional[0]));
      return 0;

    case 'har':
      requirePositional(positional, 1, 'har <file.har>');
      emit(har.parseHar(positional[0], { slowMs: Number(flags.slowMs ?? 1000) }));
      return 0;

    case 'discover':
      emit(discovery.discover({ root: flags.root ?? '.', explicit: flags.path ?? null }));
      return 0;

    case 'diff-guard': {
      requirePositional(positional, 1, 'diff-guard <diff-file>');
      const issues = diffGuard.checkDiff(fs.readFileSync(positional[0], 'utf8'));
      emit({ issues, safe: !issues.some((issue) => issue.severity === 'high') });
      return 0;
    }

    case 'redact':
      requirePositional(positional, 1, 'redact <file>');
      process.stdout.write(redaction.redactText(fs.readFileSync(positional[0], 'utf8')));
      return 0;

    case 'validate': {
      requirePositional(positional, 2, 'validate <instance.json> <schema.json>');
      const errors = contracts.validate(readJson(positional[0]), readJson(positional[1]));
      emit({ valid: errors.length === 0, errors });
      return errors.length === 0 ? 0 : 1;
    }

    case 'classify': {
      requirePositional(positional, 1, 'classify "<message>"');
      const status = flags.httpStatus === undefined ? null : Number(flags.httpStatus);
      emit(taxonomy.classify(positional[0], status));
      return 0;
    }

    case 'context': {
      const file = flags.path ?? path.join(flags.root ?? '.', '.qa', 'context.md');
      const schema = contextSchema();
      const parsed = contextModule.parseFile(file, { schema });
      emit({
        path: file,
        context: parsed.context,
        valid: parsed.valid,
        errors: parsed.errors,
        schemaChecked: schema !== null,
      });
      return parsed.valid ? 0 : 1;
    }

    case 'report-html': {
      requirePositional(positional, 1, 'report-html <result.json>');
      const document = reportHtml.renderFile(positional[0], { title: flags.title ?? null });
      if (flags.out) {
        fs.writeFileSync(flags.out, document);
        emit({ written: flags.out, bytes: document.length });
      } else {
        process.stdout.write(document);
      }
      return 0;
    }

    case 'branding':
      // Written to stdout verbatim, not as JSON: the caller embeds these exact
      // bytes in a rendered report.
      if (flags.metadata !== undefined) emit(branding.metadata());
      else process.stdout.write(branding.footer(flags.format ?? 'text'));
      return 0;

    default:
      throw new UsageError(`unknown analysis subcommand: ${subcommand ?? '(none)'}`);
  }
}

function diagnosticsCommand(argv) {
  const [subcommand, ...rest] = argv;
  const { flags } = parseFlags(rest);

  const execution = () => {
    if (!flags.executionResult) throw new UsageError('--execution-result is required');
    return validateExecutionResultMin(readJson(flags.executionResult));
  };
  const analysisResult = () =>
    flags.analysisResult ? validateAnalysisResult(readJson(flags.analysisResult)) : null;
  // A diagnosis handed back in is held to the same seam contract it was emitted
  // under, so a hand-edited file is refused rather than half-understood.
  const diagnosisInput = () => {
    if (!flags.diagnosis) throw new UsageError('--diagnosis is required');
    return validateDiagnosis(readJson(flags.diagnosis));
  };

  switch (subcommand) {
    case 'diagnose':
      emit(diagnostics.diagnose(execution(), { analysisResult: analysisResult() }));
      return 0;

    case 'plan-repairs':
      // Wrapped in {plans}, matching the shape skills already parse. A bare array
      // would be tidier and would break every caller.
      emit({ plans: diagnostics.planRepairs(diagnosisInput()) });
      return 0;

    case 'summarize': {
      const result = execution();
      emit(diagnostics.summarize(result, diagnosisInput()));
      return 0;
    }

    case 'report': {
      // The one-shot path: diagnose, plan, and summarize in a single call, so the
      // common case is one command instead of three.
      const result = execution();
      const diagnosis = diagnostics.diagnose(result, { analysisResult: analysisResult() });
      emit({
        diagnosis,
        plans: diagnostics.planRepairs(diagnosis),
        summary: diagnostics.summarize(result, diagnosis),
      });
      return 0;
    }

    default:
      throw new UsageError(`unknown diagnostics subcommand: ${subcommand ?? '(none)'}`);
  }
}

function playwrightCommand(argv) {
  const [subcommand, ...rest] = argv;
  const { positional } = parseFlags(rest);
  if (subcommand === 'report') {
    requirePositional(positional, 1, 'report <results.json>');
    emit(playwright.parseReport(positional[0]));
    return 0;
  }
  if (subcommand === 'trace') {
    requirePositional(positional, 1, 'trace <trace.zip>');
    emit(playwright.analyzeTrace(positional[0]));
    return 0;
  }
  throw new UsageError(`unknown playwright subcommand: ${subcommand ?? '(none)'}`);
}

class UsageError extends Error {}

function requirePositional(positional, count, shape) {
  if (positional.length < count) throw new UsageError(`usage: qa-engine analysis ${shape}`);
}

/** The context contract, in whichever layout the engine is running from. */
function contextSchema() {
  const candidates = [new URL('../lib/analysis/schemas/context.schema.json', import.meta.url)];
  for (const candidate of candidates) {
    const file = candidate.pathname;
    if (fs.existsSync(file)) return readJson(file);
  }
  return null;
}

export function main(argv = process.argv.slice(2)) {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    process.stdout.write(USAGE);
    return argv.length === 0 ? 2 : 0;
  }
  if (argv[0] === '--version') {
    process.stdout.write(`${engineVersion()}\n`);
    return 0;
  }

  const [tool, ...rest] = argv;
  try {
    if (tool === 'analysis') return analysis(rest);
    if (tool === 'diagnostics') return diagnosticsCommand(rest);
    if (tool === 'playwright') return playwrightCommand(rest);
    process.stderr.write(USAGE);
    return fail('usage-error', `unknown tool: ${tool}`);
  } catch (error) {
    if (error instanceof junit.MalformedArtifact) return fail('malformed-artifact', error.message);
    if (error instanceof contextModule.MalformedContext) return fail('malformed-context', error.message);
    if (error instanceof reportHtml.ReportError) return fail('report-error', error.message);
    if (error instanceof branding.BrandingError) return fail('branding-error', error.message);
    if (error instanceof InternalContractError) return fail('invalid-payload', error.message);
    if (error instanceof UsageError) return fail('usage-error', error.message);
    if (error instanceof SyntaxError) return fail('io-error', error.message);
    if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EISDIR') {
      return fail('io-error', error.message);
    }
    throw error;
  }
}

function engineVersion() {
  try {
    return readJson(new URL('../package.json', import.meta.url).pathname).version;
  } catch {
    return '0.0.0';
  }
}

process.exitCode = main();
