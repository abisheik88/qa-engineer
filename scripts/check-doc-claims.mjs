#!/usr/bin/env node
// Documentation ⇄ skill-behavior consistency.
//
// The capability matrix and README describe what each command does. Nothing
// compared those descriptions to the skills themselves, so they drifted: the
// README advertised `/qa-fix` as "writing fixes to source" and `/qa-review` as
// applying improvements, while both SKILL.md files state plainly that they never
// edit a file. check-capability-matrix.mjs could not catch it — it compares two
// documents to each other, not a claim to an implementation.
//
// This check derives facts from the skills and holds the docs to them:
//
//   1. write capability — a skill whose guardrails say it never edits must not be
//      described with a verb that promises edits.
//   2. contract coverage — a document may only claim every command ships an
//      output contract if every command actually has one.
//   3. tooling claims — a skill that names a bundled engine must document how to
//      invoke it, and must actually be in the bundle manifest.
//
// Run: node scripts/check-doc-claims.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUNDLE_MANIFEST } from '../packages/installer/lib/core/manifest.mjs';
import { AGENTS, UNKNOWN_AGENT_ID } from '../packages/installer/lib/agents/registry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const skillsDir = path.join(root, 'skills');

const skills = fs
  .readdirSync(skillsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(skillsDir, e.name, 'SKILL.md')))
  .map((e) => e.name)
  .sort();

// Phrases by which a skill declares it does not modify code. Kept explicit
// rather than inferred: a skill states its own guardrail, and this check quotes
// it back at the documentation.
const READ_ONLY_MARKERS = [
  /never edits?\b/i,
  /never modif(?:y|ies)/i,
  /edits nothing/i,
  /changes no code/i,
  /no code changes/i,
  /applies nothing/i,
  /does not (?:write|apply) code/i,
];

// Verbs that promise the command changes the user's files.
const WRITE_CLAIMS = [
  /writing fixes to source/i,
  /applies improvements/i,
  /applies fixes/i,
  /writes? fixes/i,
  /edits? (?:the )?(?:source|tests?|files?)/i,
  /repairs tests and heals locators, writing/i,
];

const DOCS_WITH_CLAIMS = ['README.md', 'docs/capability-matrix.md'];

/** The row(s) of a Markdown table mentioning `/<skill>` or `` `<skill>` ``. */
function claimLines(text, skill) {
  return text
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .filter((line) => new RegExp(`\`/?${skill}\``).test(line));
}

const readOnlySkills = [];
for (const skill of skills) {
  const body = read(`skills/${skill}/SKILL.md`);
  if (READ_ONLY_MARKERS.some((re) => re.test(body))) readOnlySkills.push(skill);
}

for (const doc of DOCS_WITH_CLAIMS) {
  const text = read(doc);
  for (const skill of readOnlySkills) {
    for (const line of claimLines(text, skill)) {
      for (const claim of WRITE_CLAIMS) {
        if (claim.test(line)) {
          problems.push(
            `${doc}: describes ${skill} as changing code ("${line.match(claim)[0]}"), ` +
              `but skills/${skill}/SKILL.md states it never edits`,
          );
        }
      }
    }
  }
}

// --- contract coverage ------------------------------------------------------
const withContracts = new Set(
  skills.filter((s) => {
    const dir = path.join(skillsDir, s, 'contracts');
    return fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith('.schema.json'));
  }),
);
const withoutContracts = skills.filter((s) => !withContracts.has(s));

// A blanket "every command ships a contract" claim must be true.
const BLANKET_CONTRACT_CLAIM =
  /(?:all|every) (?:twelve|12)?\s*(?:user-facing\s*)?commands?[^.]*ships? a machine-readable output contract/i;
for (const doc of DOCS_WITH_CLAIMS) {
  const text = read(doc);
  const match = text.match(BLANKET_CONTRACT_CLAIM);
  if (match && withoutContracts.length > 0) {
    problems.push(
      `${doc}: claims every command ships an output contract, but ${withoutContracts.join(', ')} ` +
        `have no contracts/ directory ("${match[0].slice(0, 80)}…")`,
    );
  }
}

// --- tooling claims ---------------------------------------------------------
for (const skill of skills) {
  const body = read(`skills/${skill}/SKILL.md`);
  const claimsBundle = /bundled|scripts\/lib|qa_analysis|qa_diagnostics|playwright_analysis/.test(body);
  const inManifest = Object.prototype.hasOwnProperty.call(BUNDLE_MANIFEST, skill);

  if (claimsBundle && !inManifest) {
    problems.push(
      `skills/${skill}/SKILL.md references bundled tooling, but ${skill} is not in BUNDLE_MANIFEST — ` +
        'the invocation would fail in an installed project',
    );
  }
  if (inManifest && !/^## Tooling$/m.test(body)) {
    problems.push(
      `skills/${skill}/SKILL.md bundles deterministic tooling but has no "## Tooling" section ` +
        'documenting how to invoke it',
    );
  }
  if (inManifest) {
    // The invocation must be concrete AND portable: an agent should never have to
    // guess, and the command must not depend on POSIX shell features. The previous
    // recipe used `$(ls -d …)` and a `PYTHONPATH=` prefix, which failed on Windows
    // and silently pushed every skill onto its manual fallback.
    if (!/node <SKILL_DIR>\/scripts\/qa-tool\.mjs /.test(body)) {
      problems.push(
        `skills/${skill}/SKILL.md must document a concrete, portable invocation ` +
          '(node <SKILL_DIR>/scripts/qa-tool.mjs …), not a prose reference or a shell recipe',
      );
    }
    // Two invocation contracts have already failed this way. A POSIX-only shell
    // recipe failed outright on Windows, and a Python one needed an interpreter the
    // user never agreed to install; in both cases the skill fell back to guesswork
    // and said nothing. Neither may come back.
    if (/QA_LIB|PYTHONPATH=/.test(body)) {
      problems.push(
        `skills/${skill}/SKILL.md uses a POSIX-only shell recipe (QA_LIB / PYTHONPATH=) — ` +
          'it fails on Windows, where a failed tool call degrades the skill silently',
      );
    }
    if (/python3? /.test(body)) {
      problems.push(
        `skills/${skill}/SKILL.md invokes Python — the engine is Node (ADR-0012), and a ` +
          'second runtime the install never provided is a silent degradation waiting to happen',
      );
    }
    if (!/references\/deterministic-tooling\.md/.test(body)) {
      problems.push(
        `skills/${skill}/SKILL.md must link references/deterministic-tooling.md so every skill ` +
          'shares one invocation contract',
      );
    }
  }
}

// --- a skill's own instructions must produce a valid artifact ----------------
// Every skill with a ## Tooling section tells the agent to run a deterministic
// tool and cite its output as evidence. If the skill's contract has no `command`
// evidence type, following the instruction yields a contract-invalid result.
// Found by a real agent run, not by review: 9 of 11 contracts were missing it.
for (const skill of skills) {
  const body = read(`skills/${skill}/SKILL.md`);
  if (!/^## Tooling$/m.test(body)) continue;
  const contractsDir = path.join(skillsDir, skill, 'contracts');
  if (!fs.existsSync(contractsDir)) continue;
  for (const file of fs.readdirSync(contractsDir).filter((f) => f.endsWith('.schema.json'))) {
    const schema = JSON.parse(fs.readFileSync(path.join(contractsDir, file), 'utf8'));
    const enumValues = schema.properties?.evidence?.items?.properties?.type?.enum;
    if (Array.isArray(enumValues) && !enumValues.includes('command')) {
      problems.push(
        `${skill}/contracts/${file}: evidence type enum has no "command", but the skill's ` +
          'Tooling section tells the agent to run a tool and cite it — following the skill ' +
          'would produce an invalid artifact',
      );
    }
  }
}

// --- security guarantee: untrusted input ------------------------------------
// SECURITY.md states that artifact and repository content is treated as
// untrusted data. That guarantee only holds if each skill says so where the
// agent will read it, so it is checked per skill rather than assumed from the
// policy document. Four skills that read external content were missing it.
const UNTRUSTED_MARKER =
  /untrusted data|as data to classify|never as instructions|never be treated as instructions/i;
for (const skill of skills) {
  const body = read(`skills/${skill}/SKILL.md`);
  const audience = /audience:\s*user/.test(body) ? 'user' : 'model';
  if (audience !== 'user') continue;
  if (!UNTRUSTED_MARKER.test(body)) {
    problems.push(
      `skills/${skill}/SKILL.md has no untrusted-input guardrail — SECURITY.md promises that ` +
        'artifact and repository content is treated as data, never as instructions',
    );
  }
}
if (!/untrusted/i.test(read('SECURITY.md'))) {
  problems.push('SECURITY.md no longer states the untrusted-input guarantee the skills rely on');
}

// --- diff-guard claims ------------------------------------------------------
// qa-fix is the guard's consumer; if it promises the guard gates a change, the
// guard must be reachable from that skill.
const fixBody = read('skills/qa-fix/SKILL.md');
if (/diff guard/i.test(fixBody) && !/qa-tool\.mjs analysis diff-guard/.test(fixBody)) {
  problems.push(
    'skills/qa-fix/SKILL.md claims the diff guard gates changes but never documents ' +
      'how to run it (qa-tool.mjs analysis diff-guard)',
  );
}

// --- agent compatibility claims ---------------------------------------------
// COMPATIBILITY.md is the document a user reads to decide whether their editor is
// supported; the registry is what the installer actually does. When those two
// disagree, the document wins in the user's head and loses in practice — they
// install, see nothing, and file a bug against a host the matrix promised.
//
// Every registered host must therefore appear in the matrix with the path the
// installer really writes to and the documentation the path was read from. Adding
// a host to the registry without documenting it now fails here.
const compatibility = read('COMPATIBILITY.md');
for (const agent of AGENTS) {
  if (agent.id === UNKNOWN_AGENT_ID) continue; // not a product; it names no host
  if (!compatibility.includes(agent.name)) {
    problems.push(
      `COMPATIBILITY.md does not mention "${agent.name}", which the installer supports — ` +
        'a user cannot discover a host the matrix omits',
    );
    continue;
  }
  if (!compatibility.includes(`${agent.skillsDir}/`)) {
    problems.push(
      `COMPATIBILITY.md must state ${agent.skillsDir}/ — the path the installer writes ` +
        `for ${agent.name}`,
    );
  }
  if (agent.docs && !compatibility.includes(agent.docs)) {
    problems.push(
      `COMPATIBILITY.md must cite ${agent.docs} for ${agent.name}, so a reader can ` +
        'check the discovery paths against the vendor rather than trusting this table',
    );
  }
}

if (problems.length) {
  console.error('doc⇄skill claim check failed:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(
  `doc⇄skill claims OK (${skills.length} skills, ${readOnlySkills.length} read-only, ` +
    `${Object.keys(BUNDLE_MANIFEST).length} bundling)`,
);
