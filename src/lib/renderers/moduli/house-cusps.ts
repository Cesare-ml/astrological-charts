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
    // Adding only one revolution fails if the preceding cusp exceeds 720°.
    const revolutions = Math.max(0, Math.ceil((previous - house[index]) / 360));
    result.push(house[index] + revolutions * 360);
  }
  return result;
}
