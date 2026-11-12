import * as THREE from 'three';
import { chartPlanetKey, isChartPlanetRef, sameChartPlanet } from './planet-interaction.types';
import type { ChartPlanetRef } from './planet-interaction.types';

/** Read-only data captured by the wheel from the upstream coordinate. */
export interface ChartBodyLayoutSnapshot {
  readonly coordinate: string;
  readonly original: number;
  readonly adjusted: number;
  /** Render rotation provenance, never a new astronomical calculation. */
  readonly ascendant: number;
  readonly degreesOffset: number;
  readonly tickDegrees: number;
  readonly glyphDisplacementDegrees: number;
  /** Optional parts are required only when enabled for this chart. */
  readonly outerLeaderEnabled: boolean;
  readonly moonMarkerEnabled: boolean;
}

export type ChartBodyVisualRole =
  | 'glyph' | 'inner-leader' | 'outer-leader'
  | 'moon-ring' | 'moon-ring-leader'
  | 'dodecatemore' | 'dodecatemore-arc';

const roles = new Set<string>([
  'glyph','inner-leader','outer-leader',
  'moon-ring','moon-ring-leader','dodecatemore','dodecatemore-arc'
]);

export interface ChartBodyOwner {
  readonly ref: ChartPlanetRef;
  readonly group: THREE.Group;
  readonly glyph: THREE.Mesh;
  readonly innerLeader: THREE.Object3D;
  readonly outerLeader?: THREE.Object3D;
  readonly extras: ReadonlyMap<ChartBodyVisualRole, THREE.Object3D>;
  /** Value snapshot, not the host's mutable scene.userData object. */
  readonly layout: ChartBodyLayoutSnapshot;
}

export interface ChartBodyOwnerInspection {
  readonly complete: boolean;
  /** Empty if any body is malformed: callers must never use a partial index. */
  readonly owners: ReadonlyMap<string, ChartBodyOwner>;
  readonly issues: readonly string[];
}

function isLayout(value: unknown): value is ChartBodyLayoutSnapshot {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<ChartBodyLayoutSnapshot>;
  return typeof v.coordinate === 'string' && v.coordinate.length > 0
    && typeof v.original === 'number' && Number.isFinite(v.original)
    && typeof v.adjusted === 'number' && Number.isFinite(v.adjusted)
    && typeof v.ascendant === 'number' && Number.isFinite(v.ascendant)
    && typeof v.degreesOffset === 'number' && Number.isFinite(v.degreesOffset)
    && typeof v.tickDegrees === 'number' && Number.isFinite(v.tickDegrees)
    && v.tickDegrees === 75 - v.ascendant + 15 + v.original + v.degreesOffset
    && typeof v.glyphDisplacementDegrees === 'number'
    && Number.isFinite(v.glyphDisplacementDegrees)
    && v.glyphDisplacementDegrees === v.adjusted - v.original
    && typeof v.outerLeaderEnabled === 'boolean'
    && typeof v.moonMarkerEnabled === 'boolean';
}

/**
 * Inspect per-body Three.js ownership without touching matrices, resources,
 * positions, active focus, or WebGL state. Mirrors belong to the wheel, not
 * the identity-transform body group, and do not invalidate the index.
 *
 * This is only a structural prerequisite, NEVER permission to reposition
 * glyphs: native aspects, houses, Arabic parts, decorative spokes and
 * collision layout still require a coordinated full rebuild.
 */
export function inspectChartBodyOwners(root: THREE.Object3D): ChartBodyOwnerInspection {
  const issues: string[] = [];
  const candidates = new Map<string, ChartBodyOwner>();
  let seen = 0;

  root.traverse(object => {
    if (!Object.prototype.hasOwnProperty.call(object.userData,'chartPlanetBody')) return;
    seen++;
    const ref: unknown = object.userData['chartPlanetBody'];
    if (!(object instanceof THREE.Group) || !isChartPlanetRef(ref)) {
      issues.push('invalid-body-group');
      return;
    }
    const key = chartPlanetKey(ref);
    if (candidates.has(key)) {
      issues.push('duplicate-body:'+key);
      return;
    }
    const identity = object.position.x === 0 && object.position.y === 0
      && object.position.z === 0
      && object.quaternion.x === 0 && object.quaternion.y === 0
      && object.quaternion.z === 0 && object.quaternion.w === 1
      && object.scale.x === 1 && object.scale.y === 1 && object.scale.z === 1
      && (object.matrixAutoUpdate || object.matrix.equals(new THREE.Matrix4()));
    if (!identity) issues.push('nonidentity-body:'+key);

    const rawLayout: unknown = object.userData['chartBodyLayout'];
    if (!isLayout(rawLayout)) issues.push('invalid-layout:'+key);

    const parts = new Map<ChartBodyVisualRole, THREE.Object3D>();
    for (const child of object.children) {
      const role: unknown = child.userData['chartBodyVisualRole'];
      if (typeof role !== 'string' || !roles.has(role)) {
        issues.push('unrecognized-part:'+key);
        continue;
      }
      const typedRole = role as ChartBodyVisualRole;
      if (parts.has(typedRole)) issues.push('duplicate-part:'+key+':'+role);
      parts.set(typedRole,child);
    }
    const glyph = parts.get('glyph');
    const leader = parts.get('inner-leader');
    if (!(glyph instanceof THREE.Mesh) ||
        !sameChartPlanet(glyph.userData['chartPlanet'] ?? null,ref)) {
      issues.push('invalid-glyph:'+key);
    }
    if (!leader) issues.push('missing-inner-leader:'+key);
    if (isLayout(rawLayout)) {
      if (parts.has('outer-leader') !== rawLayout.outerLeaderEnabled)
        issues.push('outer-leader-option-mismatch:'+key);
      if (parts.has('moon-ring') !== rawLayout.moonMarkerEnabled ||
          parts.has('moon-ring-leader') !== rawLayout.moonMarkerEnabled)
        issues.push('moon-marker-option-mismatch:'+key);
    } else if (parts.has('moon-ring') !== parts.has('moon-ring-leader')) {
      issues.push('incomplete-moon-marker:'+key);
    }
    if (parts.has('dodecatemore-arc') && !parts.has('dodecatemore'))
      issues.push('incomplete-dodecatemore:'+key);
    if (isLayout(rawLayout) && rawLayout.coordinate === 'longitude'
        && glyph instanceof THREE.Mesh) {
      const angle: unknown = glyph.userData['chartAspectAngle'];
      if (typeof angle !== 'number' || !Number.isFinite(angle) ||
          angle !== THREE.MathUtils.degToRad(rawLayout.tickDegrees)) {
        issues.push('mismatched-aspect-angle:'+key);
      }
    }
    if (object instanceof THREE.Group && glyph instanceof THREE.Mesh
        && leader && isLayout(rawLayout)) {
      const extras = new Map(parts);
      extras.delete('glyph');
      extras.delete('inner-leader');
      extras.delete('outer-leader');
      candidates.set(key,{
        ref:{...ref},group:object,glyph,innerLeader:leader,
        outerLeader:parts.get('outer-leader'),extras,
        // userData is mutable across host redraws. A report must not
        // silently change after inspection if the host edits its layout.
        layout:Object.freeze({
          coordinate:rawLayout.coordinate,
          original:rawLayout.original,
          adjusted:rawLayout.adjusted,
          ascendant:rawLayout.ascendant,
          degreesOffset:rawLayout.degreesOffset,
          tickDegrees:rawLayout.tickDegrees,
          glyphDisplacementDegrees:rawLayout.glyphDisplacementDegrees,
          outerLeaderEnabled:rawLayout.outerLeaderEnabled,
          moonMarkerEnabled:rawLayout.moonMarkerEnabled
        })
      });
    }
  });
  if (!seen) issues.push('no-body-groups');
  return issues.length
    ? {complete:false,owners:new Map(),issues}
    : {complete:true,owners:candidates,issues:[]};
}
