#!/usr/bin/env node
// Live-agent evaluation runner.
//
// Runs a real (or replayed) AI agent against evaluation *scenarios*, feeds each
// produced output into the **frozen deterministic scorer** (run-evals.mjs), and
// reports behavioral quality with regression detection. This is the live layer that
// sits on top of the deterministic gate; it does not modify or replace it —
// `scoreCase` is imported and used unchanged.
//
// Design (see docs/evaluation-platform.md):
//
//   - **Provider-agnostic.** A *provider* turns a scenario into an output artifact.
//     Two ship here, neither vendor-locked:
//       replay   — read a recorded output from captures/<set>/. Deterministic, needs
//                  no API keys, runs in CI, and makes every run reproducible.
//       command  — run any agent CLI (--command "..."), templated with the scenario,
//                  and read its JSON output. This is how a real agent (Claude Code
//                  headless, Codex, Gemini, …) plugs in.
//   - **Deterministic vs judgment, separated.** The gate is the deterministic score
//     (contract validity + assertions), computed by the frozen scorer. Model-judgment
//     metrics would be advisory only and never gate; no judge ships here.
//   - **Reproducible artifacts.** Every run can write a full record via --report. The
//     committed baseline holds only the pass/score per scenario, so regression
//     comparison is deterministic.
//   - **Regression detection.** --baseline fails if any scenario that passed in the
//     baseline now fails, or any score drops.
//
//   node tests/evals/run-live.mjs
//   node tests/evals/run-live.mjs --baseline tests/evals/baselines/reference.json
//   node tests/evals/run-live.mjs --provider command --command 'my-agent --skill {skill} --request {request}'
//   node tests/evals/run-live.mjs --emit-baseline tests/evals/baselines/reference.json

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { scoreCase } from './run-evals.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// Floating-point scores are compared for *drops*, so an exact `<` would flag a
// scenario whose score is arithmetically identical but differently rounded.
const SCORE_EPSILON = 1e-9;

// --- providers ---------------------------------------------------------------

/** Read a recorded output for this scenario. Deterministic and key-free. */
function providerReplay(scenario, capturesSet) {
  const relative = `${scenario.id}.json`;
  const file = path.join(here, 'captures', capturesSet, relative);
  if (!fs.existsSync(file)) {
    return [null, `no capture at captures/${capturesSet}/${relative}`];
  }
  try {
    return [JSON.parse(fs.readFileSync(file, 'utf8')), `replay:${capturesSet}`];
  } catch (error) {
    return [null, `capture is not valid JSON: ${error.message}`];
  }
}

/**
 * Run any agent CLI, templated with the scenario, and parse its JSON output.
 *
 * Tokens: {skill} {id} {request} {fixture} {contract} {prompt}. The command must
 * print the skill's output artifact as JSON to stdout.
 */
function providerCommand(scenario, template) {
  const input = scenario.input ?? {};
  const substitutions = {
    skill: scenario.skill ?? '',
    id: scenario.id ?? '',
    request: input.request ?? '',
    fixture: input.fixture ?? '',
    contract: scenario.contract ?? '',
    prompt: input.prompt ?? input.request ?? '',
  };

  let argv;
  try {
    argv = splitCommand(template).map((segment) =>
      segment.replace(/\{(\w+)\}/g, (whole, token) => {
        if (!(token in substitutions)) throw new Error(`unknown token {${token}}`);
        return substitutions[token];
      }),
    );
  } catch (error) {
    return [null, `bad --command template: ${error.message}`];
  }
  if (argv.length === 0) return [null, 'bad --command template: empty'];

  // No shell: the template is expanded here and the arguments are passed through
  // directly, so a scenario's request text cannot become a shell command.
  const run = spawnSync(argv[0], argv.slice(1), { encoding: 'utf8', timeout: 600_000 });
  if (run.error) return [null, `agent command failed to run: ${run.error.message}`];
  if (run.status !== 0) {
    return [null, `agent command exited ${run.status}: ${(run.stderr ?? '').trim().slice(0, 200)}`];
  }
  try {
    return [JSON.parse(run.stdout), 'command'];
  } catch {
    return [null, 'agent output was not valid JSON on stdout'];
  }
}

/** `shlex.split` for the subset a command template uses: quotes and whitespace. */
function splitCommand(template) {
  const segments = [];
  let current = '';
  let quote = null;
  let started = false;
  for (const char of String(template)) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started || current) segments.push(current);
      current = '';
      started = false;
    } else {
      current += char;
    }
  }
  if (quote) throw new Error('unbalanced quote');
  if (started || current) segments.push(current);
  return segments;
}

// --- scenario running --------------------------------------------------------

function discoverScenarios(skillFilter = null) {
  const dir = path.join(here, 'scenarios');
  if (!fs.existsSync(dir)) return [];
  const scenarios = [];
  for (const group of fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const groupDir = path.join(dir, group.name);
    for (const file of fs.readdirSync(groupDir).filter((f) => f.endsWith('.scenario.json')).sort()) {
      const scenario = JSON.parse(fs.readFileSync(path.join(groupDir, file), 'utf8'));
      scenario.id ??= `${group.name}/${file.replace(/\.scenario\.json$/, '')}`;
      if (skillFilter && scenario.skill !== skillFilter) continue;
      scenarios.push(scenario);
    }
  }
  return scenarios.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Produce an output via the provider and score it with the frozen scorer. */
function runScenario(scenario, produce) {
  const [output, note] = produce(scenario);
  if (output === null) {
    return {
      id: scenario.id,
      skill: scenario.skill,
      category: scenario.category ?? 'golden',
      passed: false,
      errored: true,
      score: 0,
      contractValid: false,
      assertions: '0/0',
      detail: [note],
      provider: note,
    };
  }

  // A live scenario always expects a GOOD output (kind=golden): the agent must
  // produce a contract-valid result that satisfies the good-behaviour assertions —
  // including when the request is a temptation to misbehave.
  const testCase = {
    id: scenario.id,
    skill: scenario.skill,
    kind: 'golden',
    contract: scenario.contract,
    assertions: scenario.assertions ?? [],
    output,
  };
  if (scenario.minConfidence !== undefined && scenario.minConfidence !== null) {
    testCase.minConfidence = scenario.minConfidence;
  }

  const scored = scoreCase(testCase);
  scored.category = scenario.category ?? 'golden';
  scored.errored = false;
  scored.provider = note;
  return scored;
}

function buildReport(results, providerLabel) {
  const bySkill = {};
  for (const result of results) {
    bySkill[result.skill] ??= { passed: 0, total: 0 };
    bySkill[result.skill].total += 1;
    if (result.passed) bySkill[result.skill].passed += 1;
  }
  const passed = results.filter((r) => r.passed).length;
  return {
    provider: providerLabel,
    totals: {
      scenarios: results.length,
      passed,
      failed: results.length - passed,
      errored: results.filter((r) => r.errored).length,
      golden: results.filter((r) => r.category === 'golden').length,
      adversarial: results.filter((r) => r.category === 'adversarial').length,
    },
    bySkill,
    scenarios: results.map((r) => ({
      id: r.id,
      skill: r.skill,
      category: r.category,
      passed: r.passed,
      score: r.score,
      contractValid: r.contractValid,
      assertions: r.assertions,
      detail: r.detail,
    })),
  };
}

/** Regressions against a baseline; an empty list means none. */
function compareBaseline(report, baseline) {
  const base = new Map((baseline.scenarios ?? []).map((s) => [s.id, s]));
  const regressions = [];
  for (const scenario of report.scenarios) {
    const before = base.get(scenario.id);
    if (!before) continue; // a new scenario is not a regression
    if (before.passed && !scenario.passed) {
      regressions.push(
        `${scenario.id}: passed in baseline, now FAILS (${scenario.detail.join('; ') || 'assertion/contract'})`,
      );
    } else if (scenario.score + SCORE_EPSILON < before.score) {
      regressions.push(`${scenario.id}: score dropped ${before.score} -> ${scenario.score}`);
    }
  }
  return regressions;
}

/** The minimal, timestamp-free baseline: pass and score per scenario. */
function baselineShape(report) {
  return {
    provider: report.provider,
    scenarios: report.scenarios.map((s) => ({ id: s.id, passed: s.passed, score: s.score })),
  };
}

function flag(argv, name) {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? undefined : argv[index + 1];
}

function main(argv) {
  const providerName = flag(argv, 'provider') ?? 'replay';
  const captures = flag(argv, 'captures') ?? 'reference';
  const command = flag(argv, 'command');
  const skill = flag(argv, 'skill');
  const baselineFile = flag(argv, 'baseline');
  const emitBaseline = flag(argv, 'emit-baseline');
  const reportFile = flag(argv, 'report');
  const asJson = argv.includes('--json');

  let produce;
  let providerLabel;
  if (providerName === 'command') {
    if (!command) {
      process.stderr.write('error: --provider command requires --command\n');
      return 2;
    }
    providerLabel = 'command';
    produce = (scenario) => providerCommand(scenario, command);
  } else if (providerName === 'replay') {
    providerLabel = `replay:${captures}`;
    produce = (scenario) => providerReplay(scenario, captures);
  } else {
    process.stderr.write(`error: unknown --provider ${providerName} (replay | command)\n`);
    return 2;
  }

  const results = discoverScenarios(skill).map((scenario) => runScenario(scenario, produce));
  const report = buildReport(results, providerLabel);

  if (reportFile) fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  if (emitBaseline) {
    fs.writeFileSync(emitBaseline, `${JSON.stringify(baselineShape(report), null, 2)}\n`);
    process.stdout.write(`wrote baseline: ${emitBaseline}\n`);
  }

  let regressions = [];
  if (baselineFile) {
    regressions = compareBaseline(report, JSON.parse(fs.readFileSync(baselineFile, 'utf8')));
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    for (const result of results) {
      const mark = result.passed ? 'ok  ' : (result.errored ? 'ERR ' : 'FAIL');
      process.stdout.write(
        `  ${mark} [${result.category.padEnd(11)}] ${result.id.padEnd(34)} ` +
          `provider=${String(result.provider).padEnd(16)} assertions=${result.assertions}\n`,
      );
      for (const line of result.detail) process.stdout.write(`         - ${line}\n`);
    }
    const totals = report.totals;
    process.stdout.write(
      `\nrun-live [${providerLabel}]: ${totals.passed}/${totals.scenarios} scenarios passed ` +
        `(${totals.golden} golden, ${totals.adversarial} adversarial, ${totals.errored} errored)\n`,
    );
    if (baselineFile) {
      if (regressions.length > 0) {
        process.stdout.write(`\nREGRESSIONS vs baseline (${regressions.length}):\n`);
        for (const line of regressions) process.stdout.write(`  - ${line}\n`);
      } else {
        process.stdout.write('no regressions vs baseline.\n');
      }
    }
  }

  return report.totals.failed > 0 || regressions.length > 0 ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
