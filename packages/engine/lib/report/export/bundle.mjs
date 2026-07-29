// The portable report bundle: a folder that is the whole report, and nothing outside it.
//
// ## Why a folder and not just the single file
//
// `report-html --embed` already produces one self-contained page, and that is the right
// artifact for an email attachment. It is the wrong artifact for a run with forty
// screenshots and a video: base64 inflates by a third, and a 60 MB HTML file is not a
// thing anyone opens twice.
//
// So the bundle is the canonical *local* output. It copies every piece of evidence into
// its own `assets/` tree, rewrites every link to point at the copy, and then verifies
// that no link escapes the folder. What comes out is a directory — or one `.zip` — that
// opens in any browser, on any machine, with no network, no CDN, and no AI platform
// involved. Six months later it still opens, because there is nothing left outside it
// to go missing.
//
//   qa-report/
//     index.html          the report
//     report.json         the artifact it was rendered from
//     manifest.json       every file, with its SHA-256
//     assets/
//       css/report.css    the theme
//       js/report.js      the behaviour
//       screenshots/ videos/ traces/ network/ dom/ console/ logs/ other/
//
// ## The guarantee, and how it is kept
//
// Nothing in `index.html` may point outside the bundle. That is checked *after* writing
// by re-reading the emitted HTML, extracting every `src` and `href`, and resolving each
// one against the bundle root. A link that resolves to a file that is not there fails
// the write rather than shipping a report with a hole in it.

import fs from 'node:fs';
import path from 'node:path';

import { createRegistry, hashFile } from '../../artifacts/manager.mjs';
import { createZip } from '../../artifacts/zip-write.mjs';
import { stylesheet } from '../theme/css.mjs';
import { runtimeScript } from '../components/runtime.mjs';
import { render } from './html.mjs';
import { renderMarkdown } from './markdown.mjs';
import { versionStamp } from '../version.mjs';

export class BundleError extends Error {
  name = 'BundleError';
}

// Where each artifact kind lands. Grouping by kind rather than dumping everything in
// one directory is what makes a 200-file bundle navigable when someone opens the folder
// instead of the report.
const BUCKET = Object.freeze({
  screenshot: 'screenshots',
  video: 'videos',
  trace: 'traces',
  har: 'network',
  network: 'network',
  dom: 'dom',
  console: 'console',
  log: 'logs',
  performance: 'metrics',
  accessibility: 'metrics',
  security: 'metrics',
  api: 'metrics',
  coverage: 'metrics',
  diff: 'diffs',
  report: 'reports',
  file: 'other',
});

/** A filename that is safe on every filesystem and cannot escape its directory. */
function safeName(input, fallback) {
  const base = path.basename(String(input ?? '')).replace(/[^A-Za-z0-9._-]/g, '-').replace(/^-+/, '');
  return base && base !== '.' && base !== '..' ? base.slice(0, 120) : fallback;
}

/** Plan where every present artifact is copied to, keeping names unique. */
function planAssets(records) {
  const plan = new Map();
  const taken = new Set();
  let counter = 0;

  for (const record of records) {
    if (!record.exists || record.external || !record.absolutePath) continue;
    if (plan.has(record.absolutePath)) continue;

    const bucket = BUCKET[record.kind] ?? 'other';
    counter += 1;
    let name = safeName(record.declaredPath, `artifact-${counter}`);
    let target = `assets/${bucket}/${name}`;
    // Two runs can capture `screenshot.png` in different folders; the bundle flattens
    // them into one directory, so a collision has to be resolved rather than silently
    // overwriting the earlier file.
    if (taken.has(target)) {
      const dot = name.lastIndexOf('.');
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const extension = dot > 0 ? name.slice(dot) : '';
      name = `${stem}-${counter}${extension}`;
      target = `assets/${bucket}/${name}`;
    }
    taken.add(target);
    plan.set(record.absolutePath, target);
  }
  return plan;
}

/**
 * Every evidence entry in a result, wherever it lives.
 *
 * Both contract families keep evidence in two places: a run-level index and one array
 * per finding. Missing either leaves files uncopied and links dangling, so both are
 * walked here rather than at each call site.
 */
function collectEvidence(result) {
  const entries = [...(result?.evidence ?? [])];
  for (const finding of result?.findings ?? result?.issues ?? []) {
    entries.push(...(finding?.evidence ?? []));
  }
  return entries.filter((entry) => entry && typeof entry === 'object');
}

/** Every `src=` and `href=` in the document, for the completeness check. */
function referencedPaths(html) {
  const found = new Set();
  const pattern = /(?:src|href)="([^"]+)"/g;
  let match = pattern.exec(html);
  while (match !== null) {
    const reference = match[1];
    // External links, in-page anchors, and inlined data are not bundle files.
    if (!/^(https?:|mailto:|data:|#)/i.test(reference)) found.add(reference);
    match = pattern.exec(html);
  }
  return [...found];
}

function writeFile(root, relative, contents) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

/**
 * Write the bundle.
 *
 * Returns the manifest: what was written, what it hashes to, and whether every link
 * resolves. `zip` additionally emits `<outDir>.zip` beside the folder.
 */
export function writeBundle(result, options = {}) {
  const resultPath = options.resultPath ? path.resolve(options.resultPath) : null;
  const outDir = path.resolve(
    options.outDir ?? (resultPath ? path.join(path.dirname(resultPath), 'report') : 'qa-report'),
  );
  const baseDir = resultPath ? path.dirname(resultPath) : process.cwd();
  const mode = options.mode ?? 'full';

  if (fs.existsSync(outDir) && !options.force) {
    const entries = fs.readdirSync(outDir);
    // Refuse to write into a directory holding something else. A bundle owns its
    // folder — it deletes and rewrites `assets/` — and doing that to a directory the
    // user chose for another reason is not recoverable.
    const foreign = entries.filter((name) => !['index.html', 'report.json', 'manifest.json', 'assets', 'report.md'].includes(name));
    if (foreign.length > 0) {
      throw new BundleError(
        `refusing to write a bundle into ${outDir}: it holds ${foreign.length} unrelated ` +
          `file(s) (${foreign.slice(0, 3).join(', ')}). Choose an empty directory or pass force.`,
      );
    }
  }

  // Pass one: resolve everything against the filesystem so `exists` is known.
  //
  // The registry resolves `artifacts[]` eagerly but evidence entries only when the
  // renderer asks for them, so surveying `list()` straight away sees an empty set for
  // any result that never registered an artifacts block — and the bundle then copies
  // nothing while the page still links at the originals. Touching every evidence entry
  // first is what makes the survey complete.
  const survey = createRegistry(result, { baseDir, outDir, hash: false });
  for (const entry of collectEvidence(result)) survey.forEvidence(entry);
  const plan = planAssets(survey.list());

  // Pass two: render with every href redirected at the bundle's own copy.
  const hrefMap = new Map([...plan].map(([absolute, target]) => [absolute, `./${target}`]));
  const renderOptions = {
    ...options,
    resultPath,
    baseDir,
    outDir,
    mode,
    embed: false,
    hrefMap,
    assets: { css: './assets/css/report.css', js: './assets/js/report.js' },
  };

  const html = render(result, renderOptions);

  fs.mkdirSync(outDir, { recursive: true });
  // A rewritten bundle must not keep a screenshot the new run no longer references.
  fs.rmSync(path.join(outDir, 'assets'), { recursive: true, force: true });

  const written = [];
  const record = (relative, bytes) => written.push({ path: relative, bytes });

  writeFile(outDir, 'assets/css/report.css', stylesheet());
  record('assets/css/report.css', Buffer.byteLength(stylesheet()));
  writeFile(outDir, 'assets/js/report.js', runtimeScript());
  record('assets/js/report.js', Buffer.byteLength(runtimeScript()));

  for (const [absolute, target] of plan) {
    fs.mkdirSync(path.dirname(path.join(outDir, target)), { recursive: true });
    fs.copyFileSync(absolute, path.join(outDir, target));
    record(target, fs.statSync(path.join(outDir, target)).size);
  }

  writeFile(outDir, 'index.html', html);
  record('index.html', Buffer.byteLength(html));

  // The source artifact travels with the report: a bundle that cannot be re-rendered is
  // a dead end, and the JSON is what every other format is produced from.
  const sourceJson = `${JSON.stringify(result, null, 2)}\n`;
  writeFile(outDir, 'report.json', sourceJson);
  record('report.json', Buffer.byteLength(sourceJson));

  if (options.markdown !== false) {
    const markdown = renderMarkdown(result, { ...renderOptions });
    writeFile(outDir, 'report.md', markdown);
    record('report.md', Buffer.byteLength(markdown));
  }

  // The completeness check: re-read what was actually emitted rather than trusting the
  // plan, and resolve every link against the bundle root.
  const emitted = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
  const broken = [];
  for (const reference of referencedPaths(emitted)) {
    const decoded = decodeURI(reference.split('?')[0].split('#')[0]);
    const resolved = path.resolve(outDir, decoded);
    const relative = path.relative(outDir, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      broken.push({ reference, reason: 'points outside the bundle' });
    } else if (!fs.existsSync(resolved)) {
      broken.push({ reference, reason: 'file not present in the bundle' });
    }
  }

  const manifest = {
    ...versionStamp(),
    generatedAt: result?.generatedAt ?? result?.metadata?.generatedAt ?? null,
    mode,
    complete: broken.length === 0,
    brokenReferences: broken,
    missingArtifacts: survey.missing().map((entry) => ({
      id: entry.id,
      declaredPath: entry.declaredPath,
      reason: entry.missingReason,
    })),
    files: written
      .sort((a, b) => (a.path < b.path ? -1 : 1))
      .map((entry) => ({
        ...entry,
        sha256: hashFile(path.join(outDir, entry.path)),
      })),
    totalBytes: written.reduce((sum, entry) => sum + entry.bytes, 0),
  };

  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  writeFile(outDir, 'manifest.json', manifestJson);

  if (broken.length > 0) {
    throw new BundleError(
      `bundle written to ${outDir} but ${broken.length} reference(s) do not resolve inside it: ` +
        broken.slice(0, 3).map((entry) => `${entry.reference} (${entry.reason})`).join('; '),
    );
  }

  let zipPath = null;
  if (options.zip) {
    zipPath = typeof options.zip === 'string' ? path.resolve(options.zip) : `${outDir}.zip`;
    const stamp = manifest.generatedAt ? new Date(manifest.generatedAt) : new Date(0);
    const entries = [
      ...manifest.files.map((entry) => ({
        name: `${path.basename(outDir)}/${entry.path}`,
        data: fs.readFileSync(path.join(outDir, entry.path)),
      })),
      { name: `${path.basename(outDir)}/manifest.json`, data: manifestJson },
    ];
    fs.writeFileSync(zipPath, createZip(entries, { modifiedAt: stamp }));
  }

  return {
    outDir,
    zipPath,
    entry: path.join(outDir, 'index.html'),
    ...manifest,
  };
}
