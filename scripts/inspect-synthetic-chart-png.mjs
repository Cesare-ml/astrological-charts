import { createHash } from 'node:crypto';
import sharp from 'sharp';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Validate a synthetic demo PNG, including visible image content.
 * Uniform or fully transparent results are not valid chart render evidence.
 * This does not prove astrology, asset provenance, or pixel parity.
 */
export async function inspectSyntheticChartPng(dataUrl, { width = 1600, height = 1600 } = {}) {
  if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1)
    throw new Error('Expected PNG dimensions must be positive integers');
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,'))
    throw new Error('Expected a PNG base64 data URL');

  const encoded = dataUrl.slice('data:image/png;base64,'.length);
  if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
    throw new Error('Malformed PNG base64 data');
  const input = Buffer.from(encoded, 'base64');
  if (input.length < 24 || !input.subarray(0, 8).equals(SIGNATURE))
    throw new Error('Missing PNG signature');

  const metadata = await sharp(input, { limitInputPixels: 16000000 }).metadata();
  if (metadata.format !== 'png' || metadata.width !== width || metadata.height !== height)
    throw new Error('Unexpected PNG format or dimensions');

  // Flatten alpha before counting *visible* RGB colors. Otherwise, a fully
  // transparent image with varied hidden RGB channels would pass incorrectly.
  const { data, info } = await sharp(input, { limitInputPixels: 16000000 })
    .resize(100, 100)
    .flatten({ background: '#ffffff' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) throw new Error('Expected 3-channel RGB sample');
  const colors = new Set();
  for (let i = 0; i < data.length; i += 3)
    colors.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
  if (colors.size <= 10)
    throw new Error('Exported PNG is blank or visually uniform');

  return {
    width: metadata.width,
    height: metadata.height,
    sampledVisibleColors: colors.size,
    pngSha256: createHash('sha256').update(input).digest('hex'),
  };
}
