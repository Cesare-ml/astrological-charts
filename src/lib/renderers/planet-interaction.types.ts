/** Stable IDs; a natal Sun and a transit Sun must not be conflated. */
export type ChartPlanetLayer = 'natal' | 'transit' | 'synastry';
export interface ChartPlanetRef { layer: ChartPlanetLayer; name: string; }
export interface ChartAspectRelation {
  from: ChartPlanetRef;
  to: ChartPlanetRef;
  type: string;
  orb?: number;
}
export interface ChartPlanetInteractionEvent {
  type: 'enter' | 'leave' | 'click' | 'update';
  planet: ChartPlanetRef;
  aspects: readonly ChartAspectRelation[];
}
export function chartPlanetKey(planet: ChartPlanetRef): string {
  return planet.layer + ':' + planet.name;
}
export function isChartPlanetRef(value: unknown): value is ChartPlanetRef {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<ChartPlanetRef>;
  return (p.layer === 'natal' || p.layer === 'transit' || p.layer === 'synastry')
    && typeof p.name === 'string' && p.name.length > 0;
}
export function sameChartPlanet(a: ChartPlanetRef | null, b: ChartPlanetRef | null): boolean {
  return a === b || (!!a && !!b && a.layer === b.layer && a.name === b.name);
}
export function relatedChartAspects(
  planet: ChartPlanetRef, aspects: readonly ChartAspectRelation[]
): ChartAspectRelation[] {
  // Frontends may provide aspect links from JSON or other untyped sources.
  // A malformed opposite endpoint must never reach glyph lookup and crash a
  // hover/update, even when the selected planet's endpoint is valid.
  return aspects.filter(a => !!a && isChartPlanetRef(a.from) && isChartPlanetRef(a.to)
    && (sameChartPlanet(planet, a.from) || sameChartPlanet(planet, a.to)));
}

/** Take a value snapshot at the host/controller boundary.
 * Live transit state stores often reuse and mutate aspect objects in place;
 * keeping their references would silently change active hover overlays.
 * Drop malformed API records rather than allowing them into renderer state.
 */
export function snapshotChartAspects(aspects: readonly ChartAspectRelation[]): ChartAspectRelation[] {
  if (!Array.isArray(aspects)) return [];
  return aspects.filter(a => !!a && isChartPlanetRef(a.from) && isChartPlanetRef(a.to)
    && typeof a.type === 'string' && a.type.length > 0).map(a => ({
    ...a, from: { ...a.from }, to: { ...a.to }
  }));
}


/**
 * Cheap equality for consecutive, validated aspect snapshots.
 * Compare only the known public DTO fields. When an untyped host supplies
 * extra metadata, conservatively force a refresh rather than hiding changes
 * to a tooltip or custom event consumer.
 */
export function sameChartAspects(
  previous: readonly ChartAspectRelation[], next: readonly ChartAspectRelation[]
): boolean {
  if (previous.length !== next.length) return false;
  const knownRelationKeys = ['from', 'to', 'type', 'orb'];
  const knownEndpointKeys = ['layer', 'name'];
  for (let i = 0; i < previous.length; i++) {
    const a = previous[i], b = next[i];
    if (!a || !b || !isChartPlanetRef(a.from) || !isChartPlanetRef(a.to) ||
        !isChartPlanetRef(b.from) || !isChartPlanetRef(b.to)) return false;
    const knownFieldsOnly = (value: object, keys: readonly string[]) =>
      Object.keys(value).every(key => keys.includes(key));
    if (![a, b].every(relation => knownFieldsOnly(relation, knownRelationKeys)) ||
        ![a.from, a.to, b.from, b.to].every(ref => knownFieldsOnly(ref, knownEndpointKeys))) {
      return false;
    }
    if (!sameChartPlanet(a.from, b.from) || !sameChartPlanet(a.to, b.to) ||
        a.type !== b.type || !Object.is(a.orb, b.orb) ||
        Object.hasOwn(a, 'orb') !== Object.hasOwn(b, 'orb')) return false;
  }
  return true;
}
