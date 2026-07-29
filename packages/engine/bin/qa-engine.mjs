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
import * as network from '../lib/analysis/network.mjs';
import * as discovery from '../lib/analysis/discovery.mjs';
import * as diffGuard from '../lib/analysis/diff-guard.mjs';
import * as redaction from '../lib/analysis/redaction.mjs';
import * as contracts from '../lib/analysis/contracts.mjs';
import * as taxonomy from '../lib/analysis/taxonomy.mjs';
import * as contextModule from '../lib/analysis/context.mjs';
import * as branding from '../lib/analysis/branding.mjs';
import * as reportHtml from '../lib/analysis/report-html.mjs';
import * as markdownExport from '../lib/report/export/markdown.mjs';
import * as machineExport from '../lib/report/export/machine.mjs';
import * as bundleExport from '../lib/report/export/bundle.mjs';
import * as artifacts from '../lib/artifacts/manager.mjs';
import { SchemaError } from '../lib/report/core/normalize.mjs';
import * as diagnostics from '../lib/diagnostics/engine.mjs';
import {
  InternalContractError, validateAnalysisResult, validateExecutionResultMin, validateDiagnosis,
} from '../lib/diagnostics/internal-contracts.mjs';
import * as playwright from '../lib/frameworks/playwright.mjs';
import * as junitFrameworks from '../lib/frameworks/junit-frameworks.mjs';

const USAGE = `usage: qa-engine <tool> <subcommand> [args]

  analysis     parse artifacts, classify errors, validate contracts, diff-guard,
              read .qa/context.md, render a report, print the footer
  artifacts    check that the evidence a result points at is really on disk
  diagnostics  root cause, timeline, priority, repair plans, release readiness
  playwright   normalize a Playwright report or summarize a trace

analysis subcommands
  junit <report.xml>                        normalized {tests, executed}
  har <file.har> [--slow-ms N]              redacted network summary
  network <file.har> [--slow-ms N]          the report's network block: totals,
            [--large-bytes N]               per-endpoint timings, and an issue flag
  discover [--root DIR] [--path P ...]      artifacts found, by state
  diff-guard <diff-file>                    {issues, safe} — safe:false blocks a change
  redact <file>                             the file's text with secrets masked
  validate <instance.json> <schema.json>    {valid, errors}; exit 1 when invalid
  classify "<message>" [--http-status N]    {classification, confidence, reason}
  context [--root DIR] [--path P]           parsed, schema-checked project context
  report-html <result.json> [--out FILE]    a self-contained HTML report
            [--embed] [--mode M]           --embed inlines images as data URIs
                                            M: full executive developer artifact
                                            (artifact = body only, for an embedding host)
  report-export <result.json> --format F    F: html markdown sarif junit csv json bundle
            [--out FILE] [--embed]
            [--mode M]
  report-bundle <result.json> [--out DIR]   a portable folder — index.html + assets/ —
            [--zip] [--zip-out FILE]        with every link verified to resolve inside
            [--mode M] [--force]            it. The canonical local output.
  report-schema [--out FILE]                the canonical producer-neutral contract
  report-versions                           schema / theme / renderer versions in force
  branding [--format html|markdown|text]    the exact footer bytes for a report

artifacts subcommands
  verify <result.json> [--base-dir D]       {ok, stats, missing}; exit 1 when a file
            [--out-dir D]                  a finding points at is not there
  scan <directory> [--root D]               every file found, with size and type
  hash <file>                               the file's SHA-256

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
  qa-engine artifacts verify qa-artifacts/explore-R/explore-result.json
  qa-engine analysis report-html qa-artifacts/explore-R/explore-result.json \\
    --out qa-artifacts/explore-R/explore-report.html
  qa-engine analysis report-export qa-artifacts/explore-R/explore-result.json \\
    --format sarif --out qa-artifacts/explore-R/findings.sarif
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

/**
 * Flags, parsed the way the Python argparse CLIs accepted them.
 *
 * `boolean` names matter: without them a switch consumes the token after it, so
 * `--embed --out report.html` set `embed` to `"--out"` and left the output path as a
 * stray positional. The report then went to stdout and the flag did nothing — a
 * failure that looks like the feature is broken rather than the parser.
 */
function parseFlags(argv, { repeatable = [], boolean = [] } = {}) {
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
    if (boolean.includes(camel)) {
      flags[camel] = inline === undefined ? true : inline !== 'false' && inline !== '0';
      continue;
    }
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

// Switches that take no value. Declared per subcommand so `--embed --out f.html` reads
// as two flags rather than one flag whose value is the word "--out".
const BOOLEAN = {
  'report-html': ['embed'],
  'report-export': ['embed'],
  // `--zip` is a switch and `--zip-out` carries the path. One flag doing both would
  // need a third parser mode that guesses from the next token, and a guess here writes
  // the archive to a filename taken from an unrelated flag.
  'report-bundle': ['force', 'zip', 'markdown'],
  branding: ['metadata'],
};

function analysis(argv) {
  const [subcommand, ...rest] = argv;
  const { flags, positional } = parseFlags(rest, {
    repeatable: REPEATABLE[subcommand] ?? [],
    boolean: BOOLEAN[subcommand] ?? [],
  });

  switch (subcommand) {
    case 'junit':
      requirePositional(positional, 1, 'junit <report.xml>');
      emit(junit.parseJUnit(positional[0]));
      return 0;

    case 'har':
      requirePositional(positional, 1, 'har <file.har>');
      emit(har.parseHar(positional[0], { slowMs: Number(flags.slowMs ?? 1000) }));
      return 0;

    case 'network': {
      // The report contract's `network` block, ready to paste into a result and
      // validate. `har` gives the raw entries; this gives the counted, flagged,
      // report-shaped answer, so no skill has to count requests by eye.
      requirePositional(positional, 1, 'network <file.har>');
      const options = {};
      if (flags.slowMs !== undefined) options.slowMs = Number(flags.slowMs);
      if (flags.largeBytes !== undefined) options.largeBytes = Number(flags.largeBytes);
      emit(network.analyzeHar(positional[0], options));
      return 0;
    }

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
      // The output path is handed to the renderer, not just used to write the file:
      // every evidence href is computed relative to it. Rendering to stdout falls back
      // to the result's own directory, which is where a report normally lands.
      const outPath = flags.out ? path.resolve(flags.out) : null;
      const document = reportHtml.renderFile(positional[0], {
        title: flags.title ?? null,
        outPath,
        // --embed inlines every image as a data URI, producing one file that survives
        // being forwarded without its screenshots folder.
        embed: flags.embed === true,
        // --mode picks the audience: full, executive, developer, or artifact (the
        // body-only rendering a host page supplies its own <head> for).
        mode: flags.mode ?? 'full',
      });
      if (outPath) {
        fs.writeFileSync(outPath, document);
        emit({ written: flags.out, bytes: document.length });
      } else {
        process.stdout.write(document);
      }
      return 0;
    }

    case 'report-export': {
      requirePositional(positional, 1, 'report-export <result.json> --format <format>');
      return reportExport(positional[0], flags);
    }

    case 'report-bundle': {
      requirePositional(positional, 1, 'report-bundle <result.json> [--out DIR]');
      const file = path.resolve(positional[0]);
      const summary = bundleExport.writeBundle(readJson(file), {
        resultPath: file,
        outDir: flags.out ? path.resolve(flags.out) : undefined,
        mode: flags.mode ?? 'full',
        zip: flags.zipOut ?? flags.zip === true,
        markdown: flags.markdown !== false,
        force: flags.force === true,
      });
      emit(summary);
      return 0;
    }

    case 'report-schema': {
      // Any agent can fetch the canonical contract and validate against it before it
      // hands anything over. Emitting it from the engine rather than documenting it in
      // prose is what keeps the schema an agent writes to and the schema the renderer
      // reads the same object.
      const schema = readJson(
        new URL('../lib/report/schemas/qa-report.schema.json', import.meta.url).pathname,
      );
      if (flags.out) {
        fs.writeFileSync(flags.out, `${JSON.stringify(schema, null, 2)}\n`);
        emit({ written: flags.out });
      } else {
        process.stdout.write(`${JSON.stringify(schema, null, 2)}\n`);
      }
      return 0;
    }

    case 'report-versions':
      // What this renderer is: schema it reads, theme it paints, code that did it.
      emit({
        ...reportHtml.versionStamp(),
        supportedContracts: reportHtml.supportedContracts(),
        supportedModes: reportHtml.supportedModes(),
      });
      return 0;

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

// Every non-HTML rendering of a validated result. Text formats go to stdout or a file
// verbatim; JSON formats are emitted through the same sorted serializer as everything
// else, so a diff of two runs is a diff of the findings and not of key ordering.
const EXPORT_FORMATS = {
  html: { text: true, render: (result, options) => reportHtml.render(result, options) },
  markdown: { text: true, render: (result, options) => markdownExport.renderMarkdown(result, options) },
  md: { text: true, render: (result, options) => markdownExport.renderMarkdown(result, options) },
  sarif: { text: false, render: (result, options) => machineExport.renderSarif(result, options) },
  junit: { text: true, render: (result, options) => machineExport.renderJUnit(result, options) },
  csv: { text: true, render: (result, options) => machineExport.renderCsv(result, options) },
  json: { text: false, render: (result) => result },
  bundle: { text: false, render: (result, options) => machineExport.bundleManifest(result, options) },
};

function reportExport(file, flags) {
  const format = String(flags.format ?? 'markdown').toLowerCase();
  const exporter = EXPORT_FORMATS[format];
  if (!exporter) {
    throw new UsageError(
      `unknown export format '${format}'; expected one of: ${Object.keys(EXPORT_FORMATS).sort().join(', ')}`,
    );
  }

  const result = readJson(file);
  const outPath = flags.out ? path.resolve(flags.out) : null;
  const rendered = exporter.render(result, {
    resultPath: path.resolve(file),
    outPath,
    embed: flags.embed === true,
    mode: flags.mode ?? 'full',
  });
  const body = exporter.text ? rendered : `${JSON.stringify(rendered, sortedReplacer(), 2)}\n`;

  if (outPath) {
    fs.writeFileSync(outPath, body);
    emit({ written: flags.out, format, bytes: body.length });
  } else {
    process.stdout.write(body);
  }
  return 0;
}

/**
 * The artifact tool group: does the evidence this result points at actually exist?
 *
 * Separate from `analysis` because it answers a question about the *filesystem* rather
 * than about a document, and because a skill runs it at a different moment — after
 * capture and before rendering, as the gate that stops a report full of broken images
 * from being written at all.
 */
function artifactsCommand(argv) {
  const [subcommand, ...rest] = argv;
  const { flags, positional } = parseFlags(rest);

  switch (subcommand) {
    case 'verify': {
      requirePositional(positional, 1, 'verify <result.json>');
      const file = path.resolve(positional[0]);
      const report = artifacts.verify(readJson(file), {
        baseDir: flags.baseDir ? path.resolve(flags.baseDir) : path.dirname(file),
        outDir: flags.outDir ? path.resolve(flags.outDir) : undefined,
      });
      emit(report);
      // Exit 1, matching `validate`: the document was readable and did not hold up.
      return report.ok ? 0 : 1;
    }

    case 'scan': {
      requirePositional(positional, 1, 'scan <directory>');
      const found = artifacts.scan(positional[0], { root: flags.root ?? positional[0] });
      emit({
        directory: positional[0],
        count: found.length,
        empty: found.filter((entry) => entry.empty).length,
        bytes: found.reduce((sum, entry) => sum + entry.bytes, 0),
        files: found,
      });
      return 0;
    }

    case 'hash': {
      requirePositional(positional, 1, 'hash <file>');
      emit({ path: positional[0], sha256: artifacts.hashFile(path.resolve(positional[0])) });
      return 0;
    }

    default:
      throw new UsageError(`unknown artifacts subcommand: ${subcommand ?? '(none)'}`);
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
    if (tool === 'artifacts') return artifactsCommand(rest);
    if (tool === 'diagnostics') return diagnosticsCommand(rest);
    if (tool === 'playwright') return playwrightCommand(rest);
    process.stderr.write(USAGE);
    return fail('usage-error', `unknown tool: ${tool}`);
  } catch (error) {
    if (error instanceof junit.MalformedArtifact) return fail('malformed-artifact', error.message);
    if (error instanceof contextModule.MalformedContext) return fail('malformed-context', error.message);
    if (error instanceof reportHtml.ReportError) return fail('report-error', error.message);
    // The non-HTML exporters go through the normalizer directly, so its refusals
    // surface here rather than wrapped as a ReportError.
    if (error instanceof SchemaError) return fail('schema-error', error.message);
    if (error instanceof bundleExport.BundleError) return fail('bundle-error', error.message);
    if (error instanceof artifacts.ArtifactError) return fail('artifact-error', error.message);
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
