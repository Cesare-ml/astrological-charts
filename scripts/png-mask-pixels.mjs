import { crc32, inflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const WIDTH = 512;
const HEIGHT = 512;
const BPP = 4;
const STRIDE = WIDTH * BPP;
const DECODED_LENGTH = HEIGHT * (STRIDE + 1);
const MAX_PNG_BYTES = 2 * 1024 * 1024;
const MAX_PNG_CHUNKS = 64;

/**
 * Inspect a tightly scoped, 512x512, 8-bit RGBA PNG without writing files.
 * Reject dark/colored RGB including fully transparent pixels to prevent
 * filtering halos when Three.js samples along antialiased glyph edges.
 * Reject uncompressed / interlaced / indexed formats and excessive decompression.
 */
export function verifyWhiteAlphaPng(buffer, expectedCoverage) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 57 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Astro mask must be a valid PNG buffer');
  }
  if (buffer.length > MAX_PNG_BYTES) throw new Error('Astro PNG exceeds the safe 2 MiB size limit');
  if (!Number.isSafeInteger(expectedCoverage) || expectedCoverage <= 0 || expectedCoverage > WIDTH * HEIGHT) {
    throw new Error('Invalid expected Astro alpha coverage');
  }
  let offset = 8;
  let sawHeader = false;
  let sawEnd = false;
  let sawData = false;
  let chunkCount = 0;
  const chunks = [];
  while (offset < buffer.length) {
    if (++chunkCount > MAX_PNG_CHUNKS) throw new Error('Astro PNG has too many chunks');
    if (offset + 12 > buffer.length) throw new Error('Truncated Astro PNG chunk');
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > buffer.length) throw new Error('Truncated Astro PNG payload');
    if (crc32(buffer.subarray(offset + 4, end)) !== buffer.readUInt32BE(end)) {
      throw new Error('Astro PNG has an invalid chunk CRC: ' + type);
    }
    if (!sawHeader && type !== 'IHDR') throw new Error('Astro PNG must start with IHDR');
    if (type === 'IHDR') {
      if (sawHeader || length !== 13 || buffer.readUInt32BE(start) !== WIDTH ||
        buffer.readUInt32BE(start + 4) !== HEIGHT || buffer[start + 8] !== 8 ||
        buffer[start + 9] !== 6 || buffer[start + 10] !== 0 ||
        buffer[start + 11] !== 0 || buffer[start + 12] !== 0) {
        throw new Error('Astro PNG must be non-interlaced 512x512 8-bit RGBA');
      }
      sawHeader = true;
    } else if (type === 'IDAT') {
      if (sawEnd) throw new Error('Unexpected PNG data after IEND');
      chunks.push(buffer.subarray(start, end));
      sawData = true;
    } else if (type === 'IEND') {
      if (!sawData || sawEnd || length !== 0 || end + 4 !== buffer.length) {
        throw new Error('Invalid Astro PNG end marker');
      }
      sawEnd = true;
    } else if (!['sRGB','gAMA','cHRM','iCCP','pHYs','tEXt','zTXt','iTXt','tIME'].includes(type)) {
      throw new Error('Unexpected Astro PNG chunk: ' + type);
    }
    offset = end + 4;
  }
  if (!sawHeader || !sawData || !sawEnd) throw new Error('Incomplete Astro PNG');

  let raster;
  try {
    raster = inflateSync(Buffer.concat(chunks), { maxOutputLength: DECODED_LENGTH });
  } catch (error) {
    throw new Error('Invalid or oversized compressed Astro PNG raster: ' + error.message);
  }
  if (raster.length !== DECODED_LENGTH) throw new Error('Unexpected Astro PNG raster length');
  let previous = Buffer.alloc(STRIDE);
  let visible = 0;
  for (let y = 0; y < HEIGHT; y++) {
    const start = y * (STRIDE + 1);
    const filter = raster[start];
    if (filter > 4) throw new Error('Unsupported Astro PNG row filter');
    const row = Buffer.from(raster.subarray(start + 1, start + 1 + STRIDE));
    for (let x = 0; x < STRIDE; x++) {
      const left = x >= BPP ? row[x - BPP] : 0;
      const above = previous[x];
      const topLeft = x >= BPP ? previous[x - BPP] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = above;
      else if (filter === 3) predictor = Math.floor((left + above) / 2);
      else if (filter === 4) {
        const p = left + above - topLeft;
        const a = Math.abs(p - left), b = Math.abs(p - above), c = Math.abs(p - topLeft);
        predictor = a <= b && a <= c ? left : b <= c ? above : topLeft;
      }
      row[x] = (row[x] + predictor) & 255;
    }
    for (let x = 0; x < STRIDE; x += BPP) {
      if (row[x] !== 255 || row[x + 1] !== 255 || row[x + 2] !== 255) {
        throw new Error('Astro PNG has nonwhite RGB pixels, including transparent areas');
      }
      if (row[x + 3] > 0) visible++;
    }
    previous = row;
  }
  if (visible !== expectedCoverage) {
    throw new Error('Astro alpha coverage differs from private manifest: expected ' + expectedCoverage + ', got ' + visible);
  }
  return { width: WIDTH, height: HEIGHT, visiblePixels: visible, whiteVisiblePixels: visible };
}
