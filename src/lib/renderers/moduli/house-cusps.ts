/**
 * Unwrap twelve house cusp longitudes into a nondecreasing sequence.
 * Preserve the first cusp's angular frame; do not mutate source ephemeris data.
 */
export function unwrapHouseCusps(house: readonly number[]): number[] {
  if (!Array.isArray(house) || house.length !== 12 || Array.from({ length: 12 }, (_, index) => house[index]).some(value => !Number.isFinite(value))) {
    throw new TypeError('House cusps must contain exactly twelve finite longitudes.');
  }

  const result = [house[0]];
  for (let index = 1; index < house.length; index++) {
    const previous = result[index - 1];
    // A caller may supply longitudes with a different 360-degree offset.
    // Shift in either direction: normalized and already-unwrapped inputs may
    // coexist, while the final result still spans at most one revolution.
    const revolutions = Math.ceil((previous - house[index]) / 360);
    const cusp = house[index] + revolutions * 360;
    // An astrological wheel contains one revolution. Inputs requiring multiple
    // revolutions or overflowing arithmetic cannot form valid house sectors.
    if (!Number.isFinite(cusp) || cusp < previous || cusp - result[0] > 360) {
      throw new RangeError('House cusps must fit within one finite 360-degree revolution.');
    }
    result.push(cusp);
  }
  return result;
}
