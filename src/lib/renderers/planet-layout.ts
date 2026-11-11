/**
 * Pure, render-only zodiac glyph collision layout.
 *
 * Astronomical longitudes, houses, aspects and orbs are supplied upstream.
 * This preserves the existing two-pass angular separation algorithm (even
 * its +/-180 degree rotation and insertion-order tie behavior), allowing a
 * future incremental chart updater to share the exact layout calculation.
 * No Three.js objects, textures, singleton render state or input mutations.
 */
export interface ChartGlyphAngle {
  key: string;
  deg: number;
}

/** Historical mutating collision pass; use on PRIVATE working copies only. */
export function relaxChartGlyphCycle<T extends ChartGlyphAngle>(
  planets: T[], minSeparation = 7
): T[] {
  planets.sort((a,b) => a.deg - b.deg);
  for (let i = 1; i < planets.length; i++) {
    const a = planets[i-1].deg;
    let b = planets[i].deg;
    if (b - a < minSeparation) b += minSeparation - (b - a);
    planets[i].deg = b;
  }
  for (const planet of planets) planet.deg = (planet.deg + 180) % 360;
  return planets;
}

/**
 * Return the same render-only glyph angles as the original
 * ElementiCelestiRender.getRenderPosPianeti, without mutating ephemerides.
 * Object key order is kept: when planets share the same longitude the
 * historical stable sort determines the collision resolution order.
 */
export function layoutChartGlyphLongitudes(
  bodies: Record<string,Record<string,number>>,
  coordinate: string,
  minSeparation = 7
): Record<string,Record<string,number>> {
  const original: ChartGlyphAngle[] = [];
  for (const name in bodies) {
    original.push({key:name,deg:bodies[name][coordinate] % 360});
  }
  // Match the former JSON working-copy semantics for odd nonfinite
  // legacy inputs; the layout is display-only, never an ephemeris validator.
  const working = JSON.parse(JSON.stringify(original)) as ChartGlyphAngle[];
  relaxChartGlyphCycle(working,minSeparation);
  relaxChartGlyphCycle(working,minSeparation);
  const result: Record<string,Record<string,number>> = {};
  for (const body of working) result[body.key] = {[coordinate]:body.deg};
  return result;
}
