/** Pixel-only metrics for the synthetic axis focus browser regression.
 * No canvas/DOM/Angular dependency, so these comparisons have their own
 * deterministic Node tests in addition to the real Playwright browser test.
 */
export function pixelDifference(before, after, tolerance = 12) {
  if (!before?.info || !after?.info) throw new TypeError('Both frames need image info');
  const { width, height, channels } = before.info;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      !Number.isSafeInteger(channels) || width <= 0 || height <= 0 ||
      channels < 3 || channels > 4) throw new RangeError('Invalid canvas image metadata');
  if (width !== after.info.width || height !== after.info.height ||
      channels !== after.info.channels) throw new Error('Canvas screenshot dimensions/channels changed');
  if (before.data?.length !== width * height * channels ||
      after.data?.length !== width * height * channels ||
      !Number.isFinite(tolerance) || tolerance < 0 || tolerance > 255) {
    throw new RangeError('Invalid canvas pixel payload or tolerance');
  }
  let changed = 0;
  let centralChanged = 0;
  const xMin = Math.floor(width * 0.18), xMax = Math.ceil(width * 0.82);
  const yMin = Math.floor(height * 0.18), yMax = Math.ceil(height * 0.82);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * channels;
      let different = false;
      for (let c = 0; c < 3; c++) {
        if (Math.abs(before.data[index + c] - after.data[index + c]) > tolerance) {
          different = true;
          break;
        }
      }
      if (different) {
        changed++;
        if (x >= xMin && x < xMax && y >= yMin && y < yMax) centralChanged++;
      }
    }
  }
  return { changed, centralChanged };
}
