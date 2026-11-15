/**
 * Pure longitude transforms used by the natal-chart overlay.
 *
 * Regolo Alpha Leonis defines the three reflection axes with reference
 * endpoints at 270° / 300° / 330°. These are display transforms of
 * precomputed zodiacal longitudes, NOT astronomical ephemerides.
 */
export type ZodiacProjectionKind = 'antisci' | 'contrantisci';
export type ZodiacReflectionAxis = 'Cardinale' | 'Fissa' | 'Mutevole';
export type ZodiacalPlanet = 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars' | 'Jupiter' | 'Saturn';
export type ZodiacalSelection = 'tutti' | ZodiacalPlanet;

export interface ZodiacProjectionSelection {
  tipo?: ZodiacProjectionKind;
  asse?: ZodiacReflectionAxis;
  pianeta?: ZodiacalSelection;
}

export const ZODIAC_REFLECTION_AXES: Readonly<Record<ZodiacReflectionAxis, number>> = Object.freeze({
  Cardinale: 270, // Cancer / Capricorn
  Fissa: 300,     // Leo / Aquarius
  Mutevole: 330   // Virgo / Pisces
});

export const ZODIAC_TRADITIONAL_PLANETS: readonly ZodiacalPlanet[] = Object.freeze([
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'
]);

export function wrapLongitude(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function mirroredLongitude(
  longitude: number,
  kind: ZodiacProjectionKind,
  axis: ZodiacReflectionAxis = 'Cardinale'
): number | null {
  if (!Number.isFinite(longitude) || (kind !== 'antisci' && kind !== 'contrantisci')) return null;
  const pole = ZODIAC_REFLECTION_AXES[axis];
  if (!Number.isFinite(pole)) return null;
  const antiscion = wrapLongitude(2 * pole - wrapLongitude(longitude));
  return kind === 'antisci' ? antiscion : wrapLongitude(antiscion + 180);
}

/** Returns an existing, backend-computed ×13 longitude, never fabricates it. */
export function storedDodecatemorion(body: {dodecatemoria?: {longitude?: number}} | null | undefined): number | null {
  const longitude = body?.dodecatemoria?.longitude;
  return typeof longitude === 'number' && Number.isFinite(longitude) ? wrapLongitude(longitude) : null;
}
