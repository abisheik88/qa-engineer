// A dependency-free XML reader for the subset the pack's artifacts use.
//
// Node has no built-in XML parser, and taking one as a dependency is ruled out:
// this code is bundled into skills that run in other people's repositories, where
// every dependency is attack surface and an install burden (ADR-0009). So the
// subset we actually need is parsed here — element tags, attributes, text,
// nesting, comments, CDATA, and the five predefined entities.
//
// Deliberately NOT supported, because no artifact the pack reads uses them:
// namespaces (a prefixed tag is treated as an opaque name), DTD entity
// definitions, and processing instructions beyond being skipped. Anything
// unsupported raises — the parser never guesses its way past a document it does
// not understand, because a fabricated parse becomes a fabricated test result.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export class XmlError extends Error {}

function decode(text) {
  if (!text.includes('&')) return text;
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    }
    return Object.prototype.hasOwnProperty.call(ENTITIES, body) ? ENTITIES[body] : whole;
  });
}

/**
 * Parse an XML document into a node tree.
 *
 * A node is `{ tag, attrs, children, text }`. Text is the concatenation of the
 * element's own character data, matching what `xml.etree` exposes closely enough
 * for the artifacts the pack reads (which never mix text and children
 * meaningfully).
 *
 * @param {string} source
 * @returns {{tag: string, attrs: Record<string,string>, children: object[], text: string}}
 */
export function parseXml(source) {
  if (typeof source !== 'string') throw new XmlError('XML source must be a string');

  let cursor = 0;
  const root = { tag: null, attrs: {}, children: [], text: '' };
  const stack = [root];
  const top = () => stack[stack.length - 1];

  // Reported against the position of the offending markup, not the cursor: when a
  // mismatched close tag is found, the cursor still sits at the end of the last
  // *good* tag, so using it points a reader at the wrong line of a large report.
  const fail = (why, at = cursor) => {
    const line = source.slice(0, at).split('\n').length;
    throw new XmlError(`${why} (line ${line})`);
  };

  while (cursor < source.length) {
    const open = source.indexOf('<', cursor);
    if (open === -1) {
      top().text += decode(source.slice(cursor));
      break;
    }
    if (open > cursor) top().text += decode(source.slice(cursor, open));

    if (source.startsWith('<?', open)) {
      const end = source.indexOf('?>', open);
      if (end === -1) fail('unterminated processing instruction', open);
      cursor = end + 2;
      continue;
    }
    if (source.startsWith('<!--', open)) {
      const end = source.indexOf('-->', open);
      if (end === -1) fail('unterminated comment', open);
      cursor = end + 3;
      continue;
    }
    if (source.startsWith('<![CDATA[', open)) {
      const end = source.indexOf(']]>', open);
      if (end === -1) fail('unterminated CDATA section', open);
      // CDATA is literal: no entity decoding.
      top().text += source.slice(open + 9, end);
      cursor = end + 3;
      continue;
    }
    if (source.startsWith('<!', open)) {
      const end = source.indexOf('>', open);
      if (end === -1) fail('unterminated declaration', open);
      cursor = end + 1;
      continue;
    }

    const close = source.indexOf('>', open);
    if (close === -1) fail('unterminated tag', open);
    const raw = source.slice(open + 1, close);
    if (raw.length === 0) fail('empty tag', open);

    if (raw[0] === '/') {
      const name = raw.slice(1).trim();
      if (stack.length === 1) fail(`closing tag </${name}> with no open element`, open);
      const node = stack.pop();
      if (node.tag !== name) fail(`expected </${node.tag}> but found </${name}>`, open);
      cursor = close + 1;
      continue;
    }

    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const firstSpace = body.search(/\s/);
    const tag = (firstSpace === -1 ? body : body.slice(0, firstSpace)).trim();
    if (!tag) fail('empty tag name', open);

    const attrs = {};
    if (firstSpace !== -1) {
      const attrSource = body.slice(firstSpace);
      // Quoted values only. An unquoted attribute value is not valid XML, and
      // accepting one would mean guessing where it ends.
      const pattern = /([^\s=/]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let match;
      let consumed = 0;
      while ((match = pattern.exec(attrSource)) !== null) {
        attrs[match[1]] = decode(match[3] ?? match[4] ?? '');
        consumed = match.index + match[0].length;
      }
      if (attrSource.slice(consumed).trim().length > 0) {
        fail(`unparsable attributes in <${tag}>: ${attrSource.slice(consumed).trim()}`, open);
      }
    }

    const node = { tag, attrs, children: [], text: '' };
    top().children.push(node);
    if (!selfClosing) stack.push(node);
    cursor = close + 1;
  }

  if (stack.length !== 1) fail(`unclosed element <${top().tag}>`);
  if (root.children.length === 0) throw new XmlError('document has no root element');
  if (root.children.length > 1) throw new XmlError('document must have exactly one root element');
  return root.children[0];
}

/** First child element with this tag, or null — `Element.find` in xml.etree. */
export function find(node, tag) {
  return node.children.find((child) => child.tag === tag) ?? null;
}

/** Every child element with this tag — `Element.findall` in xml.etree. */
export function findAll(node, tag) {
  return node.children.filter((child) => child.tag === tag);
}
