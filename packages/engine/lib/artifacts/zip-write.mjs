// Writing a ZIP, with no dependencies.
//
// `lib/analysis/zip.mjs` reads them (Playwright traces); this writes them, so a report
// folder can leave as one file a stakeholder can actually receive. Every mail system,
// ticket tracker, and chat tool accepts a `.zip`; none of them accept a directory.
//
// ## Scope
//
// The minimum format that every extractor understands: local headers, deflate or
// store, a central directory, and an end-of-central-directory record. No ZIP64, no
// encryption, no multi-disk — a QA report is megabytes, not gigabytes, and the
// simplest file that opens everywhere is the right one.
//
// ## Reproducibility
//
// Timestamps come from the caller, defaulting to the report's own `generatedAt`.
// Re-zipping the same report therefore produces the same bytes, so a bundle can be
// checksummed and a diff between two runs is a diff of the content.

import zlib from 'node:zlib';

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;

// Deflate is only worth its CPU on compressible bytes. A PNG or an MP4 is already
// compressed, and re-deflating it costs time to make the file marginally larger.
const ALREADY_COMPRESSED = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.mp4', '.webm', '.ogv', '.zip', '.gz',
]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time, the only clock a ZIP header understands. */
function dosStamp(date) {
  // The format cannot represent anything before 1980; clamp rather than wrap, so a
  // missing or nonsense timestamp produces a valid archive.
  const year = Math.max(1980, date.getFullYear());
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time: time & 0xffff, date: day & 0xffff };
}

function shouldStore(name) {
  const dot = name.lastIndexOf('.');
  return dot > 0 && ALREADY_COMPRESSED.has(name.slice(dot).toLowerCase());
}

/**
 * Build a ZIP from `[{ name, data }]`.
 *
 * `name` is the path inside the archive and always uses forward slashes — a backslash
 * here produces an archive that extracts into one long filename on Unix.
 */
export function createZip(entries, { modifiedAt = new Date(0) } = {}) {
  const stamp = dosStamp(modifiedAt.getFullYear() >= 1980 ? modifiedAt : new Date('1980-01-01T00:00:00Z'));
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(String(entry.name).split('\\').join('/'), 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const store = shouldStore(entry.name);
    const compressed = store ? data : zlib.deflateRawSync(data, { level: 9 });
    // Deflate can inflate small or incompressible input; storing it is then both
    // smaller and faster to read back.
    const useStore = store || compressed.length >= data.length;
    const body = useStore ? data : compressed;
    const method = useStore ? 0 : 8;
    const checksum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_SIGNATURE, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_SIGNATURE, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    // 0o644 in the high 16 bits, so extraction on Unix produces readable files rather
    // than mode 000.
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + body.length;
  }

  const centralBuffer = Buffer.concat(centrals);
  // End of central directory. The field offsets are 4/6/8/10/12/16/20 — writing the
  // directory size and its offset two bytes late produces a file that every extractor
  // reads as truncated by roughly a gigabyte, because it takes the tail of one field
  // and the head of the next as a length.
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIGNATURE, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuffer, eocd]);
}
