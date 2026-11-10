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
  type: 'enter' | 'leave' | 'click';
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
  return aspects.filter(a => sameChartPlanet(planet, a.from) || sameChartPlanet(planet, a.to));
}
