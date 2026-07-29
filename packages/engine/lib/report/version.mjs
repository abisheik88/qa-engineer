// The three versions a report is stamped with, and why there are three.
//
// A report outlives the code that made it. Someone opens a two-year-old QA report and
// needs to know what they are looking at; someone else needs to re-render an archived
// artifact and needs to know whether today's renderer still understands it. One
// version number cannot answer both, because the three things move independently:
//
//   SCHEMA    the shape of the JSON an agent produces.
//             Bumping it can break an old renderer. Major bump = breaking.
//   THEME     the visual identity — colour, type, spacing, components.
//             Bumping it changes how a report *looks*, never what it *says*.
//   RENDERER  the code that turns schema into documents.
//             Bumping it can change output for the same input; a fixed bug counts.
//
// A theme change must never require a schema bump, and a renderer fix must never
// invalidate an archived artifact. Keeping them apart is what makes that true.
//
// ## The identity claim
//
// THEME_NAME is the part a reader recognises without being told — the thing that makes
// a report from Claude Code and a report from Cursor look like the same document,
// because they *are* the same document rendered by the same code. Changing it is a
// deliberate act of rebranding, not a routine edit.

/** The canonical report schema this renderer reads and this pack's skills emit. */
export const SCHEMA_VERSION = '2.0';

/** The visual identity. Bump the minor for refinements, the major for a redesign. */
export const THEME_NAME = 'Enterprise';
export const THEME_VERSION = '1.0';

/** The rendering code itself. Bump on any change to the produced output. */
export const RENDERER_VERSION = '1.0';

/**
 * Schema versions this renderer accepts.
 *
 * Listed rather than range-checked so that adding support for a version is a
 * deliberate edit with a test behind it, and so an unknown future version fails with a
 * message naming what *is* supported instead of rendering something half-understood.
 */
export const SUPPORTED_SCHEMA_VERSIONS = Object.freeze(['1.0', '1.1', '2.0']);

/** The block stamped into every rendered document and every JSON export. */
export function versionStamp() {
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    themeName: THEME_NAME,
    themeVersion: THEME_VERSION,
    rendererVersion: RENDERER_VERSION,
  });
}

/** "Enterprise v1.0 · renderer 1.0 · schema 2.0" — the one-line form for a footer. */
export function versionLine() {
  return `${THEME_NAME} v${THEME_VERSION} · renderer ${RENDERER_VERSION} · schema ${SCHEMA_VERSION}`;
}

/**
 * The schema version a result declares, whichever contract it uses.
 *
 * A canonical report says so directly. A per-skill contract carries its version in
 * `contract.version`, of which only major.minor is meaningful for compatibility — a
 * patch bump to a contract has never changed its shape.
 */
export function schemaVersionOf(result) {
  if (result?.schemaVersion) return String(result.schemaVersion);
  const declared = result?.contract?.version;
  if (!declared) return null;
  const [major, minor] = String(declared).split('.');
  return minor === undefined ? major : `${major}.${minor}`;
}

/** True when this renderer understands the result's schema version. */
export function isSupportedSchema(result) {
  const version = schemaVersionOf(result);
  return version === null || SUPPORTED_SCHEMA_VERSIONS.includes(version);
}
