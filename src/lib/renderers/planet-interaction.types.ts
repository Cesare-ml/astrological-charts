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

/**
 * A transit planet may participate in multiple displayed relationships, but
 * it needs only one dashed radial guide. Choose the relationship with the
 * smallest finite absolute orb; on equal/unknown orbs, break ties by stable
 * aspect type and layer-qualified endpoint keys, not API input order.
 *
 * This selects a VISUAL guide color only. It does not calculate aspects,
 * alter orb values, filter the central aspect lines or rank interpretations.
 */
export function preferredTransitConnectorAspect(
  current: ChartAspectRelation,
  candidate: ChartAspectRelation
): ChartAspectRelation {
  const orbRank = (link: ChartAspectRelation): number =>
    typeof link.orb === 'number' && Number.isFinite(link.orb)
      ? Math.abs(link.orb) : Number.POSITIVE_INFINITY;
  const a = orbRank(current);
  const b = orbRank(candidate);
  if (a !== b) return b < a ? candidate : current;
  const stableKey = (link: ChartAspectRelation): string =>
    [link.type, chartPlanetKey(link.from), chartPlanetKey(link.to)].join('\\u0000');
  return stableKey(candidate) < stableKey(current) ? candidate : current;
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


/**
 * Equality for on-screen geometry and tint, not for emitted aspect metadata.
 * Orbs normally affect only tooltip details; however the chosen color of a
 * shared transit radial guide depends on the tightest absolute orb.
 * Therefore an orb-only update can skip WebGL work only when every transit
 * guide still selects the same aspect type.
 */
export function sameChartAspectVisuals(
  previous: readonly ChartAspectRelation[], next: readonly ChartAspectRelation[]
): boolean {
  const withoutOrbs = (links: readonly ChartAspectRelation[]) =>
    links.map(link => {
      if (!link || typeof link !== 'object') return link;
      const {orb: _unused, ...rest} = link;
      return rest;
    });
  // The original equality guard also rejects unknown host fields and bad
  // endpoints: never skip painting custom visual changes optimistically.
  if (!sameChartAspects(withoutOrbs(previous), withoutOrbs(next))) return false;

  const guideTypes = (links: readonly ChartAspectRelation[]): Map<string,string> | null => {
    const winners = new Map<string,ChartAspectRelation>();
    const lineIds = new Set<string>();
    for (const link of links) {
      // Keep any duplicates on the conservative redraw path: the visual
      // controller deduplicates central strokes before choosing guide colors.
      const lineId = [chartPlanetKey(link.from),chartPlanetKey(link.to),link.type].join('|');
      if (lineIds.has(lineId)) return null;
      lineIds.add(lineId);
      for (const ref of [link.from,link.to]) {
        if (ref.layer !== 'transit') continue;
        const key = chartPlanetKey(ref);
        const winner = winners.get(key);
        winners.set(key,winner ? preferredTransitConnectorAspect(winner,link) : link);
      }
    }
    return new Map([...winners].map(([key,link]) => [key,link.type]));
  };
  const before = guideTypes(previous), after = guideTypes(next);
  if (!before || !after || before.size !== after.size) return false;
  for (const [key,type] of before) if (after.get(key) !== type) return false;
  return true;
}
