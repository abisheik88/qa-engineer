// Reading the handful of frontmatter fields the installer needs from a
// SKILL.md: name, description, and the optional argument-hint. Parses the same
// restricted YAML subset the skill specification allows (plain scalars, folded
// ">-"/">" blocks, one flat metadata map). Self-contained so the installer can
// publish without the repository's dev tooling.

import fs from 'node:fs';

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

/** Parse a SKILL.md string; returns { name, description, argumentHint } or throws. */
export function parseSkillMeta(text) {
  const lines = text.split('\n');
  if (lines[0] !== '---') throw new Error('SKILL.md frontmatter must open with "---"');
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) throw new Error('SKILL.md frontmatter is not closed');

  const data = {};
  let i = 1;
  while (i < end) {
    const line = lines[i];
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    const top = line.match(/^([A-Za-z][A-Za-z0-9-]*):(?:[ \t]+(.*))?$/);
    if (!top) {
      i += 1;
      continue;
    }
    const key = top[1];
    const raw = (top[2] ?? '').trim();
    i += 1;
    if (raw === '>-' || raw === '>') {
      const parts = [];
      while (i < end && (lines[i].startsWith('  ') || lines[i].trim() === '')) {
        if (lines[i].trim() !== '') parts.push(lines[i].trim());
        i += 1;
      }
      data[key] = parts.join(' ');
    } else if (raw === '' && key === 'metadata') {
      while (i < end && /^ {2}\S/.test(lines[i])) i += 1; // skip the metadata map; not needed here
    } else if (raw !== '') {
      data[key] = stripQuotes(raw);
    }
  }
  return {
    name: data.name,
    description: data.description ?? '',
    argumentHint: data['argument-hint'] ?? null,
  };
}

export function readSkillMeta(skillMdPath) {
  return parseSkillMeta(fs.readFileSync(skillMdPath, 'utf8'));
}

/** A single-line summary for a wrapper: first sentence, whitespace-collapsed, capped. */
export function oneLineDescription(description, cap = 220) {
  const collapsed = description.replace(/\s+/g, ' ').trim();
  const firstSentence = collapsed.match(/^(.*?\.)(\s|$)/);
  const text = firstSentence ? firstSentence[1] : collapsed;
  return text.length > cap ? `${text.slice(0, cap - 1).trimEnd()}…` : text;
}
