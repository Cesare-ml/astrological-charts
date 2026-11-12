/**
 * Fail-closed validation for privately owned VirgoStars Astro v0.3 glyph masks.
 * Only 22 approved image files are eligible, no font files or source artwork.
 * Reads private files locally and never uploads or modifies them.
 */
import { createHash } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import { readSafeAsset } from './verified-asset-pack.mjs';

const ZODIAC = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const BODIES = [
  'sun', 'moon', 'mercury', 'venus', 'mars',
  'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
];
const GLYPHS = new Set([...ZODIAC, ...BODIES]);
const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const SHA256 = /^[a-f0-9]{64}$/;

function nonempty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Verify a private pack's own manifest together with explicit preview-only
 * owner authorization. Not a public release license or legal certification.
 */
export function verifyPrivateAstroOverlay(rootPath, manifest, approval) {
  if (!nonempty(rootPath)) throw new Error('Private Astro overlay root required');
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets)
      || manifest.assets.length !== GLYPHS.size) {
    throw new Error('Private Astro overlay requires exactly 22 manifest records');
  }
  if (!approval || approval.scope !== 'local-preview-only'
      || !nonempty(approval.rightsHolder)
      || !nonempty(approval.permissionBasis)
      || !nonempty(approval.approvalEvidence)) {
    throw new Error('Explicit preview-only authorization record required');
  }
  // Reject root symlinks. Existing readSafeAsset rejects symlinks in each path.
  if (lstatSync(rootPath).isSymbolicLink()) throw new Error('Private Astro overlay root symlink forbidden');
  const root = realpathSync(rootPath);
  if (!lstatSync(root).isDirectory()) throw new Error('Private Astro overlay root must be a directory');
  const paths = new Map();
  const seen = new Set();
  let totalBytes = 0;
  for (const record of manifest.assets) {
    const id = record?.id;
    if (!GLYPHS.has(id) || seen.has(id)) {
      throw new Error('Unexpected or duplicate Astro glyph: ' + String(id));
    }
    seen.add(id);
    const path = 'img/virgostars-astro/masks/' + id + '.png';
    if (record.maskPath !== path || !SHA256.test(record.maskSha256)
        || !SHA256.test(record.sourceSha256)
        || !Array.isArray(record.dimensions) || record.dimensions.length !== 2
        || record.dimensions[0] !== 512 || record.dimensions[1] !== 512
        || !Number.isSafeInteger(record.coveragePixels)
        || record.coveragePixels <= 0 || record.coveragePixels > 512 * 512) {
      throw new Error('Invalid Astro mask manifest record: ' + id);
    }
    const bytes = readSafeAsset(root, path);
    if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)
        || bytes.toString('ascii', 12, 16) !== 'IHDR'
        || bytes.readUInt32BE(16) !== 512 || bytes.readUInt32BE(20) !== 512
        || bytes[25] !== 6 || bytes[24] !== 8) {
      throw new Error('Astro mask must be 512x512 8-bit RGBA PNG: ' + id);
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (sha256 !== record.maskSha256) {
      throw new Error('Astro mask differs from private manifest: ' + id);
    }
    paths.set(path, { bytes: bytes.length, sha256 });
    totalBytes += bytes.length;
  }
  return { root, paths, totalBytes, count: paths.size, scope: approval.scope };
}
