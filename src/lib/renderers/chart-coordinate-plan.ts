import * as THREE from 'three';
import { inspectChartBodyOwners } from './chart-body-ownership';
import type { ChartBodyOwner } from './chart-body-ownership';
import { chartBodyRenderAngles, layoutChartGlyphLongitudes } from './planet-layout';
import { chartPlanetKey, isChartPlanetRef } from './planet-interaction.types';
import type { ChartPlanetRef } from './planet-interaction.types';

/** Full, layer-qualified upstream snapshot; NEVER computed from glyph positions. */
export interface ChartCoordinateTarget {
  readonly ref: ChartPlanetRef;
  readonly longitude: number;
}
export interface ChartCoordinateImpact {
  readonly ref: ChartPlanetRef;
  readonly previousLongitude: number;
  readonly nextLongitude: number;
  readonly previousAdjusted: number;
  readonly nextAdjusted: number;
  readonly previousTickDegrees: number;
  readonly nextTickDegrees: number;
  readonly previousGlyphDegrees: number;
  readonly nextGlyphDegrees: number;
  /** This body actually changed ephemeris input. */
  readonly trueLongitudeChanged: boolean;
  /** This body's collision position changed (possibly due to a neighbor). */
  readonly collisionPlacementChanged: boolean;
  /** All linked group parts may need rebuilding; no direct mutation is done. */
  readonly affectedVisuals: readonly string[];
}
export interface ChartCoordinatePlan {
  readonly decision: 'unchanged' | 'full-rebuild' | 'unsupported';
  readonly impacts: readonly ChartCoordinateImpact[];
  readonly issues: readonly string[];
}

const unsupported = (issues: string[]): ChartCoordinatePlan =>
  ({decision:'unsupported',impacts:[],issues});

/**
 * Produce a read-only dependency report for a complete new longitude set.
 *
 * This is NOT a geometry patcher. Every changed longitude or collision
 * neighbor still requires a complete `disegnaScena()` because native
 * aspects, houses and derived decorative parts live outside body groups.
 * The full input set prevents silently overlooking an affected neighbor.
 *
 * Rebuild requests from this report are informational; callers must also
 * compare houses, style/options, aspects, and other source dependencies.
 */
export function planChartCoordinateEffects(
  root: THREE.Object3D,
  targets: readonly ChartCoordinateTarget[]
): ChartCoordinatePlan {
  const inspection = inspectChartBodyOwners(root);
  if (!inspection.complete) return unsupported([...inspection.issues]);
  if (!Array.isArray(targets)) return unsupported(['invalid-target-list']);
  const requested = new Map<string,number>();
  const issues: string[] = [];
  for (const target of targets) {
    if (!target || !isChartPlanetRef(target.ref) ||
        typeof target.longitude !== 'number' || !Number.isFinite(target.longitude)) {
      issues.push('invalid-target');
      continue;
    }
    const key = chartPlanetKey(target.ref);
    if (requested.has(key)) issues.push('duplicate-target:'+key);
    requested.set(key,target.longitude);
    if (!inspection.owners.has(key)) issues.push('unknown-target:'+key);
  }
  for (const key of inspection.owners.keys())
    if (!requested.has(key)) issues.push('missing-target:'+key);
  if (issues.length) return unsupported(issues);

  // Per-wheel separation must be recomputed for *every* body in the
  // ring; changing Sun can also reposition a stationary Moon glyph.
  const wheels = new Map<THREE.Object3D,ChartBodyOwner[]>();
  for (const [key,owner] of inspection.owners) {
    if (owner.layout.coordinate !== 'longitude') {
      issues.push('unsupported-coordinate:'+key);
      continue;
    }
    const parent = owner.group.parent;
    if (!parent) {
      issues.push('detached-owner:'+key);
      continue;
    }
    const members = wheels.get(parent) ?? [];
    members.push(owner);
    wheels.set(parent,members);
  }
  if (issues.length) return unsupported(issues);

  const impacts: ChartCoordinateImpact[] = [];
  for (const members of wheels.values()) {
    // Avoid inherited properties in the legacy name-keyed collision inputs.
    // '__proto__' is also unsafe for the legacy output's plain-object
    // assignment: it changes the result prototype instead of adding a key.
    // Reject it rather than produce a partially trustworthy impact plan.
    const baseline: Record<string,{longitude:number}> = Object.create(null);
    const next: Record<string,{longitude:number}> = Object.create(null);
    for (const owner of members) {
      const name = owner.ref.name;
      if (name === '__proto__') {
        issues.push('unsafe-wheel-name:'+chartPlanetKey(owner.ref));
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(baseline,name)) {
        // Same body name under multiple layers in one ring cannot be
        // represented by the legacy name-keyed collision algorithm.
        issues.push('ambiguous-wheel-name:'+name);
        continue;
      }
      baseline[name] = {longitude:owner.layout.original};
      next[name] = {longitude:requested.get(chartPlanetKey(owner.ref))!};
    }
    if (issues.length) continue;
    const oldLayout = layoutChartGlyphLongitudes(baseline,'longitude');
    const newLayout = layoutChartGlyphLongitudes(next,'longitude');
    for (const owner of members) {
      const key = chartPlanetKey(owner.ref);
      const old = owner.layout;
      const previousAdjusted = oldLayout[owner.ref.name]?.longitude;
      const nextAdjusted = newLayout[owner.ref.name]?.longitude;
      if (!Number.isFinite(previousAdjusted) || !Number.isFinite(nextAdjusted) ||
          !Object.is(previousAdjusted,old.adjusted)) {
        issues.push('stale-collision-layout:'+key);
        continue;
      }
      const longitude = requested.get(key)!;
      const nextAngles = chartBodyRenderAngles(longitude,nextAdjusted,
        old.ascendant,old.degreesOffset);
      const beforeAngles = chartBodyRenderAngles(old.original,old.adjusted,
        old.ascendant,old.degreesOffset);
      const trueLongitudeChanged = !Object.is(longitude,old.original);
      const collisionPlacementChanged =
        !Object.is(nextAdjusted,old.adjusted);
      if (!trueLongitudeChanged && !collisionPlacementChanged) continue;
      // Native lines/house decorations live outside this body wrapper:
      // these labels are dependencies, not instructions for mutation.
      const affectedVisuals = ['glyph','inner-leader'];
      if (old.outerLeaderEnabled) affectedVisuals.push('outer-leader');
      if (old.moonMarkerEnabled) affectedVisuals.push('moon-ring','moon-ring-leader');
      if (trueLongitudeChanged) {
        affectedVisuals.push('native-aspects','cross-chart-guides','derived-decorations');
      }
      impacts.push({
        ref:{...owner.ref},
        previousLongitude:old.original,nextLongitude:longitude,
        previousAdjusted:old.adjusted,nextAdjusted,
        previousTickDegrees:beforeAngles.tickDegrees,
        nextTickDegrees:nextAngles.tickDegrees,
        previousGlyphDegrees:beforeAngles.glyphDegrees,
        nextGlyphDegrees:nextAngles.glyphDegrees,
        trueLongitudeChanged,collisionPlacementChanged,
        affectedVisuals
      });
    }
  }
  if (issues.length) return unsupported(issues);
  return {
    decision:impacts.length?'full-rebuild':'unchanged',
    impacts,issues:[]
  };
}
