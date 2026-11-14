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

// A non-finite or negative separation silently produces NaN glyph angles,
// or disables collision spacing. Keep the allowed range to one full turn.
function assertGlyphSeparation(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 360) {
    throw new RangeError('Glyph separation must be finite and between 0 and 360 degrees');
  }
}

/** Historical mutating collision pass; use on PRIVATE working copies only. */
export function relaxChartGlyphCycle<T extends ChartGlyphAngle>(
  planets: T[], minSeparation = 7
): T[] {
  // Validate before sorting: invalid options must not mutate a caller's array.
  assertGlyphSeparation(minSeparation);
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
  assertGlyphSeparation(minSeparation);
  const original: ChartGlyphAngle[] = [];
  // Only actual chart bodies belong in this ring: enumerable prototype
  // properties must not become ghost planets.
  for (const name of Object.keys(bodies ?? {})) {
    original.push({key:name,deg:bodies[name][coordinate] % 360});
  }
  // Match the former JSON working-copy semantics for odd nonfinite
  // legacy inputs; the layout is display-only, never an ephemeris validator.
  const working = JSON.parse(JSON.stringify(original)) as ChartGlyphAngle[];
  relaxChartGlyphCycle(working,minSeparation);
  relaxChartGlyphCycle(working,minSeparation);
  // Object.fromEntries creates own data properties even for names such as
  // "__proto__". Plain-object assignment would silently change the result's
  // prototype and omit that body from Object.keys/scene iteration.
  return Object.fromEntries(
    working.map(body => [body.key, {[coordinate]:body.deg}])
  ) as Record<string,Record<string,number>>;
}

/**
 * True zodiac angle and collision-shifted GLYPH angle are separate.
 * Tick lines, central aspect endpoints and transit guides must always
 * follow the original longitude, not the adjusted symbol position.
 * Retain legacy expression order for exact floating-point compatibility.
 */
export interface ChartBodyRenderAngles {
  readonly tickDegrees: number;
  readonly glyphDisplacementDegrees: number;
  readonly glyphDegrees: number;
}
export function chartBodyRenderAngles(
  originalCoordinate: number,
  collisionAdjustedCoordinate: number,
  ascendant: number,
  degreesOffset: number
): ChartBodyRenderAngles {
  // The four values come from upstream chart data. Never pass nonfinite
  // coordinates to a Three.js rotation, vertex or tick-line transform.
  if (![originalCoordinate, collisionAdjustedCoordinate, ascendant, degreesOffset]
      .every(Number.isFinite)) {
    throw new RangeError('Glyph render angles require finite numeric inputs');
  }
  const tickDegrees = 75 - ascendant + 15 + originalCoordinate + degreesOffset;
  const glyphDisplacementDegrees = collisionAdjustedCoordinate - originalCoordinate;
  const glyphDegrees = tickDegrees + glyphDisplacementDegrees;
  // Finite operands can still overflow during subtraction/addition.
  if (![tickDegrees, glyphDisplacementDegrees, glyphDegrees].every(Number.isFinite)) {
    throw new RangeError('Glyph render angle arithmetic overflowed');
  }
  return {tickDegrees,glyphDisplacementDegrees,glyphDegrees};
}
