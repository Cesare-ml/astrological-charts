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
